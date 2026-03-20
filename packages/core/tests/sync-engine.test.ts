import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { SDD } from '../src/sdd.js';
import { readRemoteState } from '../src/remote/state.js';
import type { RemoteDocResponse, RemoteDocBulkResponse, RemoteCRResponse, RemoteBugResponse } from '../src/remote/types.js';

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
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

function makeCRResponse(overrides: Partial<RemoteCRResponse> = {}): RemoteCRResponse {
  return {
    id: 'cr-001',
    project_id: 'proj-001',
    path: 'change-requests/CR-001.md',
    title: 'Add auth flow',
    body: '## Description\n\nAdd JWT authentication.\n',
    status: 'pending',
    author_id: 'user-1',
    assignee_id: null,
    target_files: null,
    closed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBugResponse(overrides: Partial<RemoteBugResponse> = {}): RemoteBugResponse {
  return {
    id: 'bug-001',
    project_id: 'proj-001',
    path: 'bugs/BUG-001.md',
    title: 'Search returns stale results',
    body: '## Steps\n\n1. Search for a term\n2. Results are outdated\n',
    status: 'open',
    severity: 'major',
    author_id: 'user-1',
    assignee_id: null,
    closed_at: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

const APPLIED_CR = `---
title: "Add auth flow"
status: applied
author: "user"
created-at: "2026-01-01T00:00:00.000Z"
---

## Description

Add JWT authentication.
`;

const RESOLVED_BUG = `---
title: "Search returns stale results"
status: resolved
author: "user"
created-at: "2026-02-01T00:00:00.000Z"
---

## Steps

1. Search for a term
2. Results are outdated
`;

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

  it('pushes pending files and preserves local frontmatter status', async () => {
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

    // Push should not mutate markdown frontmatter status
    const content = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    expect(content).toContain('status: new');

    // Remote state should be updated
    const state = await readRemoteState(tempDir);
    expect(state.documents['product/vision.md']).toBeDefined();
    expect(state.documents['product/vision.md'].remoteId).toBe('doc-001');
    expect(state.lastPush).toBeDefined();
  });

  it('skips synced files when no paths specified', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), VISION_SYNCED, 'utf-8');

    const { writeRemoteState } = await import('../src/remote/state.js');
    await writeRemoteState(tempDir, {
      documents: {
        'product/vision.md': {
          remoteId: 'doc-001',
          remoteVersion: 1,
          localHash: sha256(VISION_SYNCED),
          lastSynced: '2026-01-01T00:00:00.000Z',
        },
      },
      changeRequests: {},
      bugs: {},
    });

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

  it('repopulates remote from local files after a remote reset', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), VISION_SYNCED, 'utf-8');
    await mkdir(join(tempDir, 'change-requests'), { recursive: true });
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), APPLIED_CR, 'utf-8');
    await mkdir(join(tempDir, 'bugs'), { recursive: true });
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), RESOLVED_BUG, 'utf-8');

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Remote project reset.',
          deleted_documents: 4,
          deleted_change_requests: 2,
          deleted_bugs: 1,
          deleted_comments: 0,
          deleted_notifications: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          created: 1,
          updated: 0,
          documents: [makeDocResponse()],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          created: 1,
          updated: 0,
          change_requests: [makeCRResponse()],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          created: 1,
          updated: 0,
          bugs: [makeBugResponse()],
        }),
      });

    await sdd.remoteReset('test-project');

    const resetState = await readRemoteState(tempDir);
    expect(resetState.needsReseed).toBe(true);
    expect(resetState.documents).toEqual({});
    expect(resetState.changeRequests).toEqual({});
    expect(resetState.bugs).toEqual({});

    const result = await sdd.push();

    expect(result.created).toBe(3);
    expect(result.updated).toBe(0);
    expect(result.pushed).toContain('product/vision.md');
    expect(result.pushed).toContain('change-requests/CR-001.md');
    expect(result.pushed).toContain('bugs/BUG-001.md');

    const state = await readRemoteState(tempDir);
    expect(state.needsReseed).toBe(false);
    expect(state.documents['product/vision.md']?.remoteId).toBe('doc-001');
    expect(state.changeRequests?.['change-requests/CR-001.md']?.remoteId).toBe('cr-001');
    expect(state.bugs?.['bugs/BUG-001.md']?.remoteId).toBe('bug-001');
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

  it('creates local CR files from remote (no path — fallback to ID)', async () => {
    const cr: RemoteCRResponse = {
      id: 'abcdef01-1234-5678-abcd-ef0123456789',
      project_id: 'proj-001',
      path: null,
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

  it('uses remote path field to create CR at correct location', async () => {
    const cr: RemoteCRResponse = {
      id: 'abcdef01-1234-5678-abcd-ef0123456789',
      project_id: 'proj-001',
      path: 'change-requests/001-add-auth-flow.md',
      title: 'Add auth flow',
      body: '## Description\n\nAdd JWT authentication.',
      status: 'pending',
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

    // Should use path from remote, NOT CR-abcdef01.md
    const correctPath = join(tempDir, 'change-requests', '001-add-auth-flow.md');
    const wrongPath = join(tempDir, 'change-requests', 'CR-abcdef01.md');
    expect(existsSync(correctPath)).toBe(true);
    expect(existsSync(wrongPath)).toBe(false);
  });

  it('pull does not overwrite CR when body is identical', async () => {
    // Create a local CR file
    const localCR = `---
title: "Add auth flow"
status: pending
author: "alice"
created-at: "2026-01-01T00:00:00.000Z"
---

## Description

Add JWT authentication.
`;
    await mkdir(join(tempDir, 'change-requests'), { recursive: true });
    await writeFile(join(tempDir, 'change-requests/001-auth.md'), localCR, 'utf-8');

    const cr: RemoteCRResponse = {
      id: 'cr-001',
      project_id: 'proj-001',
      path: 'change-requests/001-auth.md',
      title: 'Add auth flow',
      body: '## Description\n\nAdd JWT authentication.',
      status: 'pending',
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

    await sdd.pullCRs();

    // File should be UNTOUCHED — same content, original frontmatter preserved
    const content = await readFile(join(tempDir, 'change-requests/001-auth.md'), 'utf-8');
    expect(content).toContain('author: "alice"');
    expect(content).toContain('title: "Add auth flow"');
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

  it('creates local bug files from remote (no path — fallback to ID)', async () => {
    const bug: RemoteBugResponse = {
      id: '12345678-abcd-ef01-2345-678901234567',
      project_id: 'proj-001',
      path: null,
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

  it('uses remote path field to create bug at correct location', async () => {
    const bug: RemoteBugResponse = {
      id: '12345678-abcd-ef01-2345-678901234567',
      project_id: 'proj-001',
      path: 'bugs/001-stale-search.md',
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

    // Should use path from remote, NOT BUG-12345678.md
    const correctPath = join(tempDir, 'bugs', '001-stale-search.md');
    const wrongPath = join(tempDir, 'bugs', 'BUG-12345678.md');
    expect(existsSync(correctPath)).toBe(true);
    expect(existsSync(wrongPath)).toBe(false);
  });
});

describe('Sync engine - push→pull round-trip', () => {
  let tempDir: string;
  let sdd: SDD;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-roundtrip-'));
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

  it('push then pull preserves document file content exactly', async () => {
    const docContent = `---
title: "Product Vision"
status: new
author: "bruno.fortunato@applica.guru"
last-modified: "2026-03-05T00:00:00.000Z"
version: "1.0"
---

# Product Vision

Easypick is a marketplace for on-demand services.
`;
    await writeFile(join(tempDir, 'product/vision.md'), docContent, 'utf-8');

    // Push — mock server response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        created: 1, updated: 0,
        documents: [makeDocResponse({
          path: 'product/vision.md',
          content: '# Product Vision\n\nEasypick is a marketplace for on-demand services.\n',
          version: 1,
        })],
      }),
    });
    await sdd.push();

    // Read file after push (status is preserved)
    const afterPush = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    expect(afterPush).toContain('status: new');

    // Pull — server returns same content, higher version
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [makeDocResponse({
        path: 'product/vision.md',
        content: '# Product Vision\n\nEasypick is a marketplace for on-demand services.\n',
        version: 5,
      })],
    });
    await sdd.pull();

    // File should be IDENTICAL to after-push — no frontmatter corruption
    const afterPull = await readFile(join(tempDir, 'product/vision.md'), 'utf-8');
    expect(afterPull).toBe(afterPush);
    // Verify original frontmatter preserved
    expect(afterPull).toContain('author: "bruno.fortunato@applica.guru"');
    expect(afterPull).toContain('last-modified: "2026-03-05T00:00:00.000Z"');
    expect(afterPull).toContain('version: "1.0"');
  });

  it('push then pull preserves CR file at original path', async () => {
    const crContent = `---
title: "Area Geografica su Leaflet"
status: pending
author: "team"
created-at: "2026-03-01T00:00:00.000Z"
---

# Area Geografica su Leaflet

Implementare la selezione area su mappa.
`;
    await mkdir(join(tempDir, 'change-requests'), { recursive: true });
    await writeFile(join(tempDir, 'change-requests/001-area-geografica.md'), crContent, 'utf-8');

    // Push — mock server stores the path
    const crResponse: RemoteCRResponse = {
      id: 'cr-abc123',
      project_id: 'proj-001',
      path: 'change-requests/001-area-geografica.md',
      title: 'Area Geografica su Leaflet',
      body: '# Area Geografica su Leaflet\n\nImplementare la selezione area su mappa.\n',
      status: 'pending',
      author_id: 'user-1',
      assignee_id: null,
      target_files: null,
      closed_at: null,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ created: 1, updated: 0, change_requests: [crResponse] }),
    });
    await sdd.push();

    // Pull — server returns same CR with path
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [crResponse],
    });
    await sdd.pullCRs();

    // Original file should still exist, untouched
    const afterPull = await readFile(join(tempDir, 'change-requests/001-area-geografica.md'), 'utf-8');
    expect(afterPull).toContain('author: "team"');
    expect(afterPull).toContain('title: "Area Geografica su Leaflet"');

    // No ID-based duplicate should exist
    expect(existsSync(join(tempDir, 'change-requests/CR-cr-abc12.md'))).toBe(false);
  });
});
