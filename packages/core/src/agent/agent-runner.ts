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

/**
 * Extract human-readable text from a single stream-json NDJSON line.
 * Returns the text to emit, or null if the line should be suppressed.
 * Falls back to the raw line if it is not valid JSON (e.g. stderr noise).
 */
function extractStreamJsonText(line: string): string | null {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    // Not JSON — pass raw (e.g. stderr lines from subprocesses)
    return line;
  }

  if (typeof event !== 'object' || event === null || !('type' in event)) {
    return null;
  }

  const { type } = event as Record<string, unknown>;

  if (type === 'assistant') {
    const message = (event as Record<string, unknown>).message;
    if (typeof message === 'object' && message !== null && 'content' in message) {
      const content = (message as Record<string, unknown>).content;
      if (Array.isArray(content)) {
        const texts = content
          .filter((b): b is { type: string; text: string } => b?.type === 'text' && typeof b?.text === 'string')
          .map((b) => b.text);
        return texts.length > 0 ? texts.join('') : null;
      }
    }
    return null;
  }

  if (type === 'result') {
    const result = (event as Record<string, unknown>).result;
    if (typeof result === 'string' && result.trim()) {
      return result;
    }
    return null;
  }

  // Suppress system/init/tool events — not useful for display
  return null;
}

/**
 * Attach NDJSON-parsing stream handlers to a child process.
 * Each complete JSON line is parsed and the extracted text forwarded to `sink`.
 * stderr lines are forwarded raw (they are not stream-json).
 */
function pipeWithNdjsonParsing(
  child: ChildProcess,
  sink: (text: string) => void,
): void {
  if (child.stdout) {
    let buf = '';
    child.stdout.on('data', (data: Buffer) => {
      buf += data.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const text = extractStreamJsonText(line);
        if (text) sink(text);
      }
    });
    child.stdout.on('end', () => {
      if (buf.trim()) {
        const text = extractStreamJsonText(buf);
        if (text) sink(text);
      }
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (data: Buffer) => sink(data.toString()));
  }
}

async function prepareAgent(options: AgentRunnerOptions): Promise<{ command: string; tmpFile: string; isClaudeAgent: boolean }> {
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

  // For the claude CLI: switch to stream-json output for real-time streaming.
  // --verbose is required alongside --output-format stream-json when using -p.
  const isClaudeAgent = command.trimStart().startsWith('claude');
  if (isClaudeAgent) {
    // Ensure --verbose is present (required by stream-json in print mode)
    if (!command.includes('--verbose')) {
      command = command.trimEnd() + ' --verbose';
    }
    command = command.trimEnd() + ' --output-format stream-json';
  }

  return { command, tmpFile, isClaudeAgent };
}

export async function runAgent(options: AgentRunnerOptions): Promise<number> {
  const { root, onOutput } = options;
  const { command, tmpFile, isClaudeAgent } = await prepareAgent(options);

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      // For claude with stream-json we always pipe stdout so we can parse NDJSON.
      // For other agents we inherit stdio when no onOutput is provided.
      const usesPipe = isClaudeAgent || !!onOutput;
      const child = spawn(command, {
        cwd: root,
        shell: true,
        stdio: usesPipe ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      });

      if (usesPipe) {
        const sink = onOutput ?? ((text: string) => process.stdout.write(text));
        if (isClaudeAgent) {
          pipeWithNdjsonParsing(child, sink);
        } else {
          if (child.stdout) child.stdout.on('data', (data: Buffer) => sink(data.toString()));
          if (child.stderr) child.stderr.on('data', (data: Buffer) => sink(data.toString()));
        }
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
  const { command, tmpFile, isClaudeAgent } = await prepareAgent(options);

  const child: ChildProcess = spawn(command, {
    cwd: root,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const sink = onOutput ?? ((text: string) => process.stdout.write(text));
  if (isClaudeAgent) {
    pipeWithNdjsonParsing(child, sink);
  } else {
    if (child.stdout) child.stdout.on('data', (data: Buffer) => sink(data.toString()));
    if (child.stderr) child.stderr.on('data', (data: Buffer) => sink(data.toString()));
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
