import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { SDD } from '../src/sdd.js';
import { readRemoteState } from '../src/remote/state.js';
import type { RemoteDocResponse, RemoteDocBulkResponse, RemoteCRResponse, RemoteBugResponse } from '../src/remote/types.js';

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

const VISION_MD = `---
title: "Product Vision"
status: new
author: "user"
last-modified: "2024-01-01T00:00:00.000Z"
version: "1.0"
---

# Product Vision

A test project.
`;

const VISION_SYNCED = VISION_MD.replace('status: new', 'status: synced');

function makeDocResponse(overrides: Partial<RemoteDocResponse> = {}): RemoteDocResponse {
  return {
    id: 'doc-001',
    project_id: 'proj-001',
    path: 'product/vision.md',
    title: 'Product Vision',
    status: 'synced',
    version: 1,
    content: '# Product Vision\n\nA test project.\n',
    last_modified_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Sync engine - push', () => {
  let tempDir: string;
  let sdd: SDD;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-sync-push-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
    git('config user.email "test@test.com"', tempDir);
    git('config user.name "Test"', tempDir);
    // Write remote config
    const { writeConfig, readConfig } = await import('../src/config/config-manager.js');
    const config = await readConfig(tempDir);
    config.remote = { url: 'http://test.local/api/v1', 'api-key': 'test-key' };
    await writeConfig(tempDir, config);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true });
  });

  it('pushes pending files and marks them synced', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), VISION_MD, 'utf-8');

    const pushResponse: RemoteDocBulkResponse = {
      created: 1,
      updated: 0,
      documents: [makeDocResponse()],
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pushResponse,
    });

    const result = await sdd.push();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.pushed).toContain('product/vision.md');

    // Local file should now be synced
    const content = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    expect(content).toContain('status: synced');

    // Remote state should be updated
    const state = await readRemoteState(tempDir);
    expect(state.documents['product/vision.md']).toBeDefined();
    expect(state.documents['product/vision.md'].remoteId).toBe('doc-001');
    expect(state.lastPush).toBeDefined();
  });

  it('skips synced files when no paths specified', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), VISION_SYNCED, 'utf-8');

    const result = await sdd.push();
    expect(result.pushed).toHaveLength(0);
  });

  it('pushes specific paths when provided', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), VISION_SYNCED, 'utf-8');

    const pushResponse: RemoteDocBulkResponse = {
      created: 0,
      updated: 1,
      documents: [makeDocResponse({ version: 2 })],
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pushResponse,
    });

    const result = await sdd.push(['product/vision.md']);
    expect(result.pushed).toContain('product/vision.md');
    expect(result.updated).toBe(1);
  });
});

describe('Sync engine - pull', () => {
  let tempDir: string;
  let sdd: SDD;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-sync-pull-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
    git('config user.email "test@test.com"', tempDir);
    git('config user.name "Test"', tempDir);
    const { writeConfig, readConfig } = await import('../src/config/config-manager.js');
    const config = await readConfig(tempDir);
    config.remote = { url: 'http://test.local/api/v1', 'api-key': 'test-key' };
    await writeConfig(tempDir, config);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true });
  });

  it('creates new local files from remote docs', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [makeDocResponse({ path: 'product/new-feature.md', title: 'New Feature' })],
    });

    const result = await sdd.pull();

    expect(result.created).toContain('product/new-feature.md');
    expect(existsSync(join(tempDir, 'product/new-feature.md'))).toBe(true);

    const content = await readFile(join(tempDir, 'product/new-feature.md'), 'utf-8');
    expect(content).toContain('title: New Feature');
    expect(content).toContain('status: synced');
  });

  it('detects conflicts when local and remote both changed', async () => {
    // Write a file and set up remote state
    await writeFile(join(tempDir, 'product/vision.md'), VISION_MD, 'utf-8');
    const { writeRemoteState } = await import('../src/remote/state.js');
    await writeRemoteState(tempDir, {
      documents: {
        'product/vision.md': {
          remoteId: 'doc-001',
          remoteVersion: 1,
          localHash: 'different-hash-from-current',
          lastSynced: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    // Remote has DIFFERENT body content to trigger a real conflict
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [makeDocResponse({ version: 2, content: '# Product Vision\n\nUpdated on remote.\n' })],
    });

    const result = await sdd.pull();

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].path).toBe('product/vision.md');
    expect(result.conflicts[0].remoteVersion).toBe(2);
    // File should NOT be overwritten
    const content = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    expect(content).toContain('status: new');
  });

  it('updates local files when no local changes detected', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), VISION_SYNCED, 'utf-8');

    // Compute correct hash for the current content
    const { createHash } = await import('node:crypto');
    const currentContent = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    const hash = createHash('sha256').update(currentContent, 'utf-8').digest('hex');

    const { writeRemoteState } = await import('../src/remote/state.js');
    await writeRemoteState(tempDir, {
      documents: {
        'product/vision.md': {
          remoteId: 'doc-001',
          remoteVersion: 1,
          localHash: hash,
          lastSynced: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [makeDocResponse({ version: 2, content: '# Updated Vision\n\nNew content.\n' })],
    });

    const result = await sdd.pull();

    expect(result.updated).toContain('product/vision.md');
    const content = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    expect(content).toContain('Updated Vision');
  });
});

describe('Sync engine - pull CRs', () => {
  let tempDir: string;
  let sdd: SDD;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-sync-crs-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
    const { writeConfig, readConfig } = await import('../src/config/config-manager.js');
    const config = await readConfig(tempDir);
    config.remote = { url: 'http://test.local/api/v1', 'api-key': 'test-key' };
    await writeConfig(tempDir, config);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true });
  });

  it('creates local CR files from remote', async () => {
    const cr: RemoteCRResponse = {
      id: 'abcdef01-1234-5678-abcd-ef0123456789',
      project_id: 'proj-001',
      title: 'Add auth flow',
      body: '## Description\n\nAdd JWT authentication.',
      status: 'draft',
      author_id: 'user-1',
      assignee_id: null,
      target_files: null,
      closed_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [cr],
    });

    const result = await sdd.pullCRs();
    expect(result.created).toBe(1);

    const filePath = join(tempDir, 'change-requests', 'CR-abcdef01.md');
    expect(existsSync(filePath)).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('title: Add auth flow');
    expect(content).toContain('status: draft');
    expect(content).toContain('JWT authentication');
  });
});

describe('Sync engine - pull bugs', () => {
  let tempDir: string;
  let sdd: SDD;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-sync-bugs-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
    const { writeConfig, readConfig } = await import('../src/config/config-manager.js');
    const config = await readConfig(tempDir);
    config.remote = { url: 'http://test.local/api/v1', 'api-key': 'test-key' };
    await writeConfig(tempDir, config);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true });
  });

  it('creates local bug files from remote', async () => {
    const bug: RemoteBugResponse = {
      id: '12345678-abcd-ef01-2345-678901234567',
      project_id: 'proj-001',
      title: 'Search returns stale results',
      body: '## Steps\n\n1. Search for a term\n2. Results are outdated',
      status: 'open',
      severity: 'major',
      author_id: 'user-1',
      assignee_id: null,
      closed_at: null,
      created_at: '2026-02-01T00:00:00.000Z',
      updated_at: '2026-02-01T00:00:00.000Z',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [bug],
    });

    const result = await sdd.pullBugs();
    expect(result.created).toBe(1);

    const filePath = join(tempDir, 'bugs', 'BUG-12345678.md');
    expect(existsSync(filePath)).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('title: Search returns stale results');
    expect(content).toContain('status: open');
    expect(content).toContain('Results are outdated');
  });
});
