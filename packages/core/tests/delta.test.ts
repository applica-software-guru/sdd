import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { computeDelta } from '../src/delta/delta-engine.js';

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

describe('computeDelta', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-delta-test-'));
    git('init', tempDir);
    git('config user.email "test@test.com"', tempDir);
    git('config user.name "Test"', tempDir);
    await mkdir(join(tempDir, 'product'), { recursive: true });
    await mkdir(join(tempDir, 'system'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('detects new files when no previous sync', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), '# Vision', 'utf-8');
    git('add .', tempDir);
    git('commit -m "init"', tempDir);

    const delta = computeDelta(tempDir, null);
    expect(delta.hasChanges).toBe(true);
    expect(delta.files).toHaveLength(1);
    expect(delta.files[0].relativePath).toBe('product/vision.md');
    expect(delta.files[0].status).toBe('new');
  });

  it('detects modified files since last sync commit', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), '# Vision v1', 'utf-8');
    git('add .', tempDir);
    git('commit -m "init"', tempDir);
    const syncCommit = git('rev-parse HEAD', tempDir);

    await writeFile(join(tempDir, 'product/vision.md'), '# Vision v2', 'utf-8');
    git('add .', tempDir);
    git('commit -m "update"', tempDir);

    const delta = computeDelta(tempDir, syncCommit);
    expect(delta.hasChanges).toBe(true);
    expect(delta.files[0].status).toBe('modified');
  });

  it('detects deleted files since last sync commit', async () => {
    await writeFile(join(tempDir, 'product/old.md'), '# Old', 'utf-8');
    git('add .', tempDir);
    git('commit -m "init"', tempDir);
    const syncCommit = git('rev-parse HEAD', tempDir);

    git('rm product/old.md', tempDir);
    git('commit -m "delete"', tempDir);

    const delta = computeDelta(tempDir, syncCommit);
    expect(delta.hasChanges).toBe(true);
    expect(delta.files[0].status).toBe('deleted');
  });

  it('reports no changes when nothing changed since sync', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), '# Vision', 'utf-8');
    git('add .', tempDir);
    git('commit -m "init"', tempDir);
    const syncCommit = git('rev-parse HEAD', tempDir);

    const delta = computeDelta(tempDir, syncCommit);
    expect(delta.hasChanges).toBe(false);
    expect(delta.files).toHaveLength(0);
  });

  it('includes diff text', async () => {
    await writeFile(join(tempDir, 'product/vision.md'), '# Vision v1', 'utf-8');
    git('add .', tempDir);
    git('commit -m "init"', tempDir);
    const syncCommit = git('rev-parse HEAD', tempDir);

    await writeFile(join(tempDir, 'product/vision.md'), '# Vision v2', 'utf-8');
    git('add .', tempDir);
    git('commit -m "update"', tempDir);

    const delta = computeDelta(tempDir, syncCommit);
    expect(delta.diff).toContain('Vision v1');
    expect(delta.diff).toContain('Vision v2');
  });
});
