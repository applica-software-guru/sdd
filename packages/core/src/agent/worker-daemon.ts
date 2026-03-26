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
import { checkoutBranch, getCurrentCommit, getJobChangedFiles } from '../git/git.js';

export interface WorkerDaemonOptions {
  root: string;
  name?: string;
  agent: string;
  branch?: string;
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
  const { root, agent, branch, agents, apiConfig, onLog, renderPrompt } = options;
  const workerName = options.name ?? hostname();
  const sddDir = join(root, '.sdd');
  const stateFile = join(sddDir, WORKER_STATE_FILE);

  const log = onLog ?? ((msg: string) => process.stderr.write(`[worker] ${msg}\n`));

  // --- Checkout working branch if configured ---
  if (branch) {
    log(`Checking out working branch "${branch}"...`);
    try {
      checkoutBranch(root, branch);
    } catch (err) {
      log(`Warning: could not checkout branch "${branch}": ${(err as Error).message}`);
    }
  }

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
  log(`Registered as worker ${registration.id}`);

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
        log(`Heartbeat error: ${(err as Error).message}`);
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
    log(`Received job ${job.job_id} (${jobDesc})`);
    log(`  Agent:  ${job.agent}`);
    if (job.model) log(`  Model:  ${job.model}`);
    if (job.branch) log(`  Branch: ${job.branch}`);
    const rendered = renderPrompt ? renderPrompt(job.prompt) : job.prompt;
    log(`─── Prompt ───\n${rendered}\n──────────────`);

    // Checkout working branch before each job
    const jobBranch = job.branch ?? branch;
    if (jobBranch) {
      log(`Checking out branch "${jobBranch}" for job ${job.job_id}...`);
      try {
        checkoutBranch(root, jobBranch);
      } catch (err) {
        log(`Warning: could not checkout branch "${jobBranch}": ${(err as Error).message}`);
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

      log(`Job ${job.job_id} finished with exit code ${exitCode}`);
      const changedFiles = getJobChangedFiles(root, baseCommit);
      if (changedFiles.length > 0) {
        log(`Job ${job.job_id} changed ${changedFiles.length} file(s)`);
      }
      await workerJobCompleted(apiConfig, job.job_id, exitCode, changedFiles);
    } catch (err) {
      log(`Job execution error: ${(err as Error).message}`);
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
  log(`Worker "${workerName}" is online. Waiting for jobs...`);
  await Promise.all([heartbeatLoop(), pollLoop()]);
  log('Worker stopped.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
