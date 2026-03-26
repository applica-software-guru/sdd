import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { resolveAgentCommand } from './agent-defaults.js';

export interface AgentRunnerOptions {
  root: string;
  prompt: string;
  agent: string;
  model?: string;
  agents?: Record<string, string>;
  onOutput?: (data: string) => void;
}

/** Handle returned by startAgent() for interactive worker mode. */
export interface AgentRunnerHandle {
  /** Resolves with the exit code when the agent process exits. */
  exitPromise: Promise<number>;
  /** Write data to the agent's stdin (for Q&A relay). */
  writeStdin: (data: string) => void;
  /** Kill the agent process. */
  kill: () => void;
  /** Path to the temp prompt file (cleaned up on exit). */
  promptFile: string;
}

async function prepareAgent(options: AgentRunnerOptions): Promise<{ command: string; tmpFile: string }> {
  const { prompt, agent, model, agents } = options;

  const template = resolveAgentCommand(agent, agents);
  if (!template) {
    throw new Error(`Unknown agent "${agent}". Available: ${Object.keys(agents ?? {}).join(', ') || 'claude, codex, opencode'}`);
  }

  const tmpFile = join(tmpdir(), `sdd-prompt-${randomBytes(6).toString('hex')}.md`);
  await writeFile(tmpFile, prompt, 'utf-8');

  let command = template.replace(/\$PROMPT_FILE/g, tmpFile);
  if (model) {
    command = command.replace(/\$MODEL/g, model);
    // If template doesn't have $MODEL but model is specified, inject --model flag
    if (!template.includes('$MODEL')) {
      command = command.replace(/^(\S+)/, `$1 --model ${model}`);
    }
  } else {
    // Remove $MODEL placeholder and surrounding flags if not provided
    command = command.replace(/--model\s+\$MODEL\s*/g, '');
    command = command.replace(/\$MODEL\s*/g, '');
  }
  return { command, tmpFile };
}

export async function runAgent(options: AgentRunnerOptions): Promise<number> {
  const { root, onOutput } = options;
  const { command, tmpFile } = await prepareAgent(options);

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(command, {
        cwd: root,
        shell: true,
        stdio: onOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      });

      if (onOutput && child.stdout) {
        child.stdout.on('data', (data: Buffer) => onOutput(data.toString()));
      }
      if (onOutput && child.stderr) {
        child.stderr.on('data', (data: Buffer) => onOutput(data.toString()));
      }

      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 1));
    });

    return exitCode;
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/**
 * Start an agent in interactive mode (stdin piped for Q&A).
 * Returns a handle for writing to stdin, killing the process, and awaiting exit.
 */
export async function startAgent(options: AgentRunnerOptions): Promise<AgentRunnerHandle> {
  const { root, onOutput } = options;
  const { command, tmpFile } = await prepareAgent(options);

  const child: ChildProcess = spawn(command, {
    cwd: root,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (child.stdout) {
    child.stdout.on('data', (data: Buffer) => {
      if (onOutput) onOutput(data.toString());
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (data: Buffer) => {
      if (onOutput) onOutput(data.toString());
    });
  }

  const exitPromise = new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      unlink(tmpFile).catch(() => {});
      resolve(code ?? 1);
    });
  });

  return {
    exitPromise,
    writeStdin: (data: string) => {
      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.write(data);
      }
    },
    kill: () => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    },
    promptFile: tmpFile,
  };
}
