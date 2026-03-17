import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SDD } from '../src/sdd.js';
import { parseCRFile, discoverCRFiles } from '../src/parser/cr-parser.js';

const CR_DRAFT = `---
title: "Add authentication"
status: draft
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description

Add JWT-based authentication to the API.

## Changes

- Create \`product/features/auth.md\` with login/logout flows
- Update \`system/entities.md\` to add User entity
`;

const CR_PENDING = `---
title: "Add authentication"
status: pending
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description

Add JWT-based authentication to the API.

## Changes

- Create \`product/features/auth.md\` with login/logout flows
- Update \`system/entities.md\` to add User entity
`;

const CR_APPLIED = `---
title: "Fix navigation"
status: applied
author: "user"
created-at: "2025-01-02T00:00:00.000Z"
---

## Description

Fix the navigation bar layout.
`;

describe('CR parser', () => {
  it('parses CR frontmatter correctly', () => {
    const result = parseCRFile('change-requests/CR-001.md', CR_DRAFT);
    expect(result.frontmatter.title).toBe('Add authentication');
    expect(result.frontmatter.status).toBe('draft');
    expect(result.frontmatter.author).toBe('user');
    expect(result.frontmatter['created-at']).toBe('2025-01-01T00:00:00.000Z');
    expect(result.body).toContain('## Description');
    expect(result.body).toContain('JWT-based authentication');
  });

  it('provides defaults for missing fields', () => {
    const content = `---
title: "Minimal CR"
---

Some body.
`;
    const result = parseCRFile('test.md', content);
    expect(result.frontmatter.status).toBe('draft');
    expect(result.frontmatter.author).toBe('');
    expect(result.frontmatter['created-at']).toBe('');
  });
});

describe('CR file discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-cr-discovery-'));
    await mkdir(join(tempDir, 'change-requests'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('discovers .md files in change-requests/', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_DRAFT, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-002.md'), CR_APPLIED, 'utf-8');

    const files = await discoverCRFiles(tempDir);
    expect(files).toHaveLength(2);
  });

  it('returns empty array when no CR files exist', async () => {
    const files = await discoverCRFiles(tempDir);
    expect(files).toHaveLength(0);
  });
});

describe('SDD CR methods', () => {
  let tempDir: string;
  let sdd: SDD;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-cr-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('changeRequests() returns all CRs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_DRAFT, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-002.md'), CR_APPLIED, 'utf-8');

    const crs = await sdd.changeRequests();
    expect(crs).toHaveLength(2);
    expect(crs[0].frontmatter.title).toBe('Add authentication');
    expect(crs[1].frontmatter.title).toBe('Fix navigation');
  });

  it('pendingChangeRequests() returns only pending CRs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-002.md'), CR_APPLIED, 'utf-8');

    const pending = await sdd.pendingChangeRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0].frontmatter.status).toBe('pending');
    expect(pending[0].frontmatter.title).toBe('Add authentication');
  });

  it('markCRApplied() changes pending to applied', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_PENDING, 'utf-8');

    const marked = await sdd.markCRApplied(['change-requests/CR-001.md']);
    expect(marked).toEqual(['change-requests/CR-001.md']);

    const content = await readFile(join(tempDir, 'change-requests/CR-001.md'), 'utf-8');
    expect(content).toContain('status: applied');
  });

  it('markCRApplied() without args marks all pending CRs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_PENDING, 'utf-8');
    const pending2 = CR_PENDING.replace('Add authentication', 'Second CR');
    await writeFile(join(tempDir, 'change-requests/CR-002.md'), pending2, 'utf-8');

    const marked = await sdd.markCRApplied();
    expect(marked).toHaveLength(2);
  });

  it('markCRApplied() skips already applied CRs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_APPLIED, 'utf-8');

    const marked = await sdd.markCRApplied();
    expect(marked).toHaveLength(0);
  });

  it('integration: create CR → pending → mark applied → no longer pending', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-001.md'), CR_PENDING, 'utf-8');

    // Should be pending
    let pending = await sdd.pendingChangeRequests();
    expect(pending).toHaveLength(1);

    // Mark as applied
    await sdd.markCRApplied();

    // Should no longer be pending
    pending = await sdd.pendingChangeRequests();
    expect(pending).toHaveLength(0);

    // But still in the full list
    const all = await sdd.changeRequests();
    expect(all).toHaveLength(1);
    expect(all[0].frontmatter.status).toBe('applied');
  });

  it('init creates change-requests/ directory', async () => {
    expect(existsSync(join(tempDir, 'change-requests'))).toBe(true);
  });
});
