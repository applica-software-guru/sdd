import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRemoteState, writeRemoteState } from '../src/remote/state.js';
import type { RemoteState } from '../src/remote/types.js';

describe('Remote state manager', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-remote-state-'));
    await mkdir(join(tempDir, '.sdd'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('returns empty state when file does not exist', async () => {
    const state = await readRemoteState(tempDir);
    expect(state).toEqual({ documents: {}, changeRequests: {}, bugs: {} });
  });

  it('round-trips state correctly', async () => {
    const state: RemoteState = {
      lastPull: '2026-01-01T00:00:00.000Z',
      lastPush: '2026-01-01T00:00:00.000Z',
      documents: {
        'product/vision.md': {
          remoteId: 'abc-123',
          remoteVersion: 3,
          localHash: 'deadbeef',
          lastSynced: '2026-01-01T00:00:00.000Z',
        },
      },
    };

    await writeRemoteState(tempDir, state);
    const result = await readRemoteState(tempDir);
    expect(result).toEqual(state);
  });

  it('creates .sdd directory if missing', async () => {
    const freshDir = await mkdtemp(join(tmpdir(), 'sdd-fresh-'));
    const state: RemoteState = { documents: {} };

    await writeRemoteState(freshDir, state);
    expect(existsSync(join(freshDir, '.sdd', 'remote-state.json'))).toBe(true);

    await rm(freshDir, { recursive: true });
  });

  it('handles corrupt JSON gracefully', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(tempDir, '.sdd', 'remote-state.json'), 'not valid json', 'utf-8');

    const state = await readRemoteState(tempDir);
    expect(state).toEqual({ documents: {}, changeRequests: {}, bugs: {} });
  });

  it('updates individual document entries', async () => {
    const state: RemoteState = {
      documents: {
        'product/vision.md': {
          remoteId: 'a',
          remoteVersion: 1,
          localHash: 'hash1',
          lastSynced: '2026-01-01T00:00:00.000Z',
        },
      },
    };

    await writeRemoteState(tempDir, state);

    // Add a new document
    state.documents['system/entities.md'] = {
      remoteId: 'b',
      remoteVersion: 2,
      localHash: 'hash2',
      lastSynced: '2026-01-02T00:00:00.000Z',
    };

    await writeRemoteState(tempDir, state);
    const result = await readRemoteState(tempDir);
    expect(Object.keys(result.documents)).toHaveLength(2);
    expect(result.documents['system/entities.md'].remoteVersion).toBe(2);
  });
});
