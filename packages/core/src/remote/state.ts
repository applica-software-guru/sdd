import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RemoteState } from './types.js';

const REMOTE_STATE_FILE = 'remote-state.json';

function stateFilePath(root: string): string {
  return resolve(root, '.sdd', REMOTE_STATE_FILE);
}

function emptyState(): RemoteState {
  return { documents: {} };
}

export async function readRemoteState(root: string): Promise<RemoteState> {
  const path = stateFilePath(root);
  if (!existsSync(path)) {
    return emptyState();
  }
  const content = await readFile(path, 'utf-8');
  try {
    return JSON.parse(content) as RemoteState;
  } catch {
    return emptyState();
  }
}

export async function writeRemoteState(root: string, state: RemoteState): Promise<void> {
  const dir = resolve(root, '.sdd');
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(stateFilePath(root), JSON.stringify(state, null, 2), 'utf-8');
}
