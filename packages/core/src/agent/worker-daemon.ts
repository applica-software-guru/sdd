import { hostname } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApiClientConfig } from '../remote/api-client.js';
import type { WorkerState, WorkerJobAssignment } from '../remote/worker-types.js';
import {
  registerWorker,
  workerHeartbeat,
  workerPoll,
  workerJobStarted,
  workerJobOutput,
  workerJobQuestion,
  workerJobAnswers,
  workerJobCompleted,
} from '../remote/worker-client.js';
import { startAgent } from './agent-runner.js';
import { checkoutBranch, getCurrentBranch, getCurrentCommit, getJobChangedFiles } from '../git/git.js';

export interface WorkerDaemonOptions {
  root: string;
  name?: string;
  agent: string;
  agents?: Record<string, string>;
  apiConfig: ApiClientConfig;
  onLog?: (message: string) => void;
  renderPrompt?: (prompt: string) => string;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const OUTPUT_FLUSH_INTERVAL_MS = 2_000;
const QA_POLL_INTERVAL_MS = 2_000;
const WORKER_STATE_FILE = 'worker.json';

export async function startWorkerDaemon(options: WorkerDaemonOptions): Promise<void> {
  const { root, agent, agents, apiConfig, onLog, renderPrompt } = options;
  const workerName = options.name ?? hostname();
  const sddDir = join(root, '.sdd');
  const stateFile = join(sddDir, WORKER_STATE_FILE);

  const log = onLog ?? ((msg: string) => process.stderr.write(`[worker] ${msg}\n`));
  const shortId = (id: string) => id.slice(0, 8);

  // --- Read current branch (informational — no checkout) ---
  const branch = getCurrentBranch(root) ?? undefined;

  // --- Register ---
  log(`Registering worker "${workerName}" with agent "${agent}"${branch ? ` (branch: ${branch})` : ''}...`);
  const registration = await registerWorker(apiConfig, workerName, agent, branch, {
    hostname: hostname(),
    platform: process.platform,
    arch: process.arch,
  });

  const state: WorkerState = {
    workerId: registration.id,
    name: workerName,
    registeredAt: registration.registered_at,
  };
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  log(`Registered as worker ${shortId(registration.id)}`);

  let running = true;
  let currentJobKill: (() => void) | null = null;

  // --- Graceful shutdown ---
  const shutdown = async () => {
    log('Shutting down...');
    running = false;
    if (currentJobKill) {
      currentJobKill();
    }
    try {
      await workerHeartbeat(apiConfig, registration.id, 'online');
    } catch {
      // best effort
    }
  };

  process.on('SIGINT', () => { shutdown(); });
  process.on('SIGTERM', () => { shutdown(); });

  // --- Heartbeat loop ---
  const heartbeatLoop = async () => {
    while (running) {
      try {
        await workerHeartbeat(apiConfig, registration.id, currentJobKill ? 'busy' : 'online');
      } catch (err) {
        const msg = (err as Error).message;
        if (!msg.includes('abort')) {
          log(`Heartbeat error: ${msg}`);
        }
      }
      await sleep(HEARTBEAT_INTERVAL_MS);
    }
  };

  // --- Poll & execute loop ---
  const pollLoop = async () => {
    while (running) {
      try {
        const job = await workerPoll(apiConfig, registration.id);
        if (job && running) {
          await executeJob(job);
        }
      } catch (err) {
        if (!running) break;
        const msg = (err as Error).message;
        // Don't log abort errors during shutdown
        if (!msg.includes('abort')) {
          log(`Poll error: ${msg}`);
        }
        await sleep(3_000);
      }
    }
  };

  // --- Job execution ---
  const executeJob = async (job: WorkerJobAssignment) => {
    const jobDesc = job.entity_type ? `${job.entity_type}/${job.entity_id}` : 'sync';
    const jid = shortId(job.job_id);
    log(`┌─ Job ${jid} (${jobDesc})`);
    log(`│  Agent: ${job.agent}${job.model ? `  Model: ${job.model}` : ''}${job.branch ? `  Branch: ${job.branch}` : ''}`);
    const promptPreview = job.prompt.split('\n').find(l => l.trim().length > 0) ?? '';
    log(`└─ ${promptPreview.length > 80 ? promptPreview.slice(0, 80) + '…' : promptPreview}`);

    // Checkout branch if the job explicitly requests one different from the current
    if (job.branch && job.branch !== getCurrentBranch(root)) {
      log(`Checking out branch "${job.branch}" for job ${job.job_id}...`);
      try {
        checkoutBranch(root, job.branch);
      } catch (err) {
        log(`Warning: could not checkout branch "${job.branch}": ${(err as Error).message}`);
      }
    }

    // Capture git state before the job starts so we can diff at the end
    const baseCommit = getCurrentCommit(root);

    try {
      await workerJobStarted(apiConfig, job.job_id);
    } catch (err) {
      log(`Failed to notify job start: ${(err as Error).message}`);
    }

    // Buffer for batched output
    let outputBuffer: string[] = [];
    let lastFlush = Date.now();
    let lastAnswerSequence = 0;
    let waitingForAnswer = false;

    const flushOutput = async () => {
      if (outputBuffer.length === 0) return;
      const lines = outputBuffer.splice(0);
      try {
        await workerJobOutput(apiConfig, job.job_id, lines);
      } catch (err) {
        log(`Output flush error: ${(err as Error).message}`);
      }
    };

    // Start the agent with interactive mode
    const handle = await startAgent({
      root,
      prompt: job.prompt,
      agent: job.agent,
      model: job.model,
      agents,
      onOutput: (data: string) => {
        // Split into lines but preserve partial lines
        const lines = data.split('\n');
        for (const line of lines) {
          // Suppress the Claude CLI stdin warning — prompt is passed via -p flag,
          // stdin is kept open only for Q&A relay and does not need initial data.
          if (line.includes('no stdin data received') || line.includes('redirect stdin explicitly')) {
            continue;
          }
          if (line.length > 0) {
            outputBuffer.push(line);
          }
        }

        // Flush if enough time has passed
        if (Date.now() - lastFlush >= OUTPUT_FLUSH_INTERVAL_MS) {
          lastFlush = Date.now();
          flushOutput();
        }
      },
    });

    currentJobKill = handle.kill;

    // Periodic output flush + answer polling loop
    const flushAndPollLoop = async () => {
      while (running) {
        // Flush pending output
        await flushOutput();
        lastFlush = Date.now();

        // If we detected a question, poll for answers
        if (waitingForAnswer) {
          try {
            const answers = await workerJobAnswers(apiConfig, job.job_id, lastAnswerSequence);
            if (answers.length > 0) {
              for (const ans of answers) {
                handle.writeStdin(ans.content + '\n');
                lastAnswerSequence = ans.sequence;
              }
              waitingForAnswer = false;
            }
          } catch (err) {
            log(`Answer poll error: ${(err as Error).message}`);
          }
        }

        await sleep(QA_POLL_INTERVAL_MS);
      }
    };

    // Run the flush/poll loop concurrently with the agent
    const flushPromise = flushAndPollLoop();

    try {
      const exitCode = await handle.exitPromise;

      // Final flush
      running = true; // temporarily re-enable to allow final flush
      await flushOutput();

      const changedFiles = getJobChangedFiles(root, baseCommit);
      const filesMsg = changedFiles.length > 0 ? `, ${changedFiles.length} file(s) changed` : '';
      log(`Job ${jid} done — exit ${exitCode}${filesMsg}`);
      await workerJobCompleted(apiConfig, job.job_id, exitCode, changedFiles);
    } catch (err) {
      log(`Job ${jid} error: ${(err as Error).message}`);
      try {
        const changedFiles = getJobChangedFiles(root, baseCommit);
        await workerJobCompleted(apiConfig, job.job_id, 1, changedFiles);
      } catch {
        // best effort
      }
    } finally {
      currentJobKill = null;
    }
  };

  // --- Start concurrent loops ---
  log(`Worker "${workerName}" is online. Waiting for jobs… (id: ${shortId(registration.id)})`);
  await Promise.all([heartbeatLoop(), pollLoop()]);
  log('Worker stopped.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
