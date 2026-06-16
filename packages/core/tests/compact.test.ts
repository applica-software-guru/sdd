import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SDD } from '../src/sdd.js';

const CR_APPLIED = `---
title: "Applied CR"
status: applied
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description

Already applied change request.
`;

const CR_PENDING = `---
title: "Pending CR"
status: pending
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description

Still to be processed.
`;

const BUG_RESOLVED = `---
title: "Resolved bug"
status: resolved
author: "user"
created-at: "2025-01-02T00:00:00.000Z"
---

## Description

Already fixed.
`;

const BUG_OPEN = `---
title: "Open bug"
status: open
author: "user"
created-at: "2025-01-02T00:00:00.000Z"
---

## Description

Still to be fixed.
`;

describe('SDD.compact()', () => {
  let tempDir: string;
  let sdd: SDD;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-compact-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('archives applied CRs to change-requests/archive/', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');

    const result = await sdd.compact();

    expect(result.mode).toBe('archive');
    expect(result.dryRun).toBe(false);
    expect(result.changeRequests).toEqual(['change-requests/CR-001.md']);
    expect(result.bugs).toEqual([]);

    expect(existsSync(join(tempDir, 'change-requests/CR-001.md'))).toBe(false);
    expect(existsSync(join(tempDir, 'change-requests/archive/CR-001.md'))).toBe(true);

    const archived = await readFile(join(tempDir, 'change-requests/archive/CR-001.md'), 'utf-8');
    expect(archived).toContain('status: applied');
  });

  it('archives resolved bugs to bugs/archive/', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_RESOLVED, 'utf-8');

    const result = await sdd.compact();

    expect(result.bugs).toEqual(['bugs/BUG-001.md']);
    expect(existsSync(join(tempDir, 'bugs/BUG-001.md'))).toBe(false);
    expect(existsSync(join(tempDir, 'bugs/archive/BUG-001.md'))).toBe(true);
  });

  it('does not touch pending CRs or open bugs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');

    const result = await sdd.compact();

    expect(result.changeRequests).toEqual([]);
    expect(result.bugs).toEqual([]);

    expect(existsSync(join(tempDir, 'change-requests/CR-001.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'bugs/BUG-001.md'))).toBe(true);
  });

  it('archived files become invisible to changeRequests() and bugs()', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-002.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_RESOLVED, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-002.md'), BUG_OPEN, 'utf-8');

    await sdd.compact();

    const crs = await sdd.changeRequests();
    expect(crs).toHaveLength(1);
    expect(crs[0].frontmatter.status).toBe('pending');

    const bugs = await sdd.bugs();
    expect(bugs).toHaveLength(1);
    expect(bugs[0].frontmatter.status).toBe('open');
  });

  it('purge mode deletes files permanently', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_RESOLVED, 'utf-8');

    const result = await sdd.compact({ mode: 'purge' });

    expect(result.mode).toBe('purge');
    expect(result.changeRequests).toEqual(['change-requests/CR-001.md']);
    expect(result.bugs).toEqual(['bugs/BUG-001.md']);

    expect(existsSync(join(tempDir, 'change-requests/CR-001.md'))).toBe(false);
    expect(existsSync(join(tempDir, 'change-requests/archive/CR-001.md'))).toBe(false);
    expect(existsSync(join(tempDir, 'bugs/BUG-001.md'))).toBe(false);
    expect(existsSync(join(tempDir, 'bugs/archive/BUG-001.md'))).toBe(false);
  });

  it('dry-run does not touch the filesystem', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_RESOLVED, 'utf-8');

    const result = await sdd.compact({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.changeRequests).toEqual(['change-requests/CR-001.md']);
    expect(result.bugs).toEqual(['bugs/BUG-001.md']);

    expect(existsSync(join(tempDir, 'change-requests/CR-001.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'change-requests/archive/CR-001.md'))).toBe(false);
    expect(existsSync(join(tempDir, 'bugs/BUG-001.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'bugs/archive/BUG-001.md'))).toBe(false);
  });

  it('returns empty result when nothing to compact', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');

    const result = await sdd.compact();

    expect(result.changeRequests).toEqual([]);
    expect(result.bugs).toEqual([]);
  });

  it('handles multiple applied CRs and resolved bugs together', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');
    const cr2 = CR_APPLIED.replace('Applied CR', 'Second applied');
    await writeFile(join(tempDir, 'change-requests/CR-002.md'), cr2, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-003.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_RESOLVED, 'utf-8');
    const bug2 = BUG_RESOLVED.replace('Resolved bug', 'Second resolved');
    await writeFile(join(tempDir, 'bugs/BUG-002.md'), bug2, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-003.md'), BUG_OPEN, 'utf-8');

    const result = await sdd.compact();

    expect(result.changeRequests).toHaveLength(2);
    expect(result.bugs).toHaveLength(2);

    const crs = await sdd.changeRequests();
    expect(crs).toHaveLength(1);
    expect(crs[0].frontmatter.status).toBe('pending');

    const bugs = await sdd.bugs();
    expect(bugs).toHaveLength(1);
    expect(bugs[0].frontmatter.status).toBe('open');
  });

  it('preserves file content when archiving', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');

    await sdd.compact();

    const archived = await readFile(join(tempDir, 'change-requests/archive/CR-001.md'), 'utf-8');
    expect(archived).toBe(CR_APPLIED);
  });

  it('is idempotent — running twice is safe', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');

    await sdd.compact();
    const second = await sdd.compact();

    expect(second.changeRequests).toEqual([]);
    expect(second.bugs).toEqual([]);
  });
});
