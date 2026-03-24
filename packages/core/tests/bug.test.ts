import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SDD } from '../src/sdd.js';
import { parseBugFile, discoverBugFiles } from '../src/parser/bug-parser.js';

const BUG_OPEN = `---
title: "Login fails with empty password"
status: open
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description

When the user submits the login form with an empty password, the app crashes.

## Steps to reproduce

1. Go to /login
2. Enter email but leave password empty
3. Click "Login"
`;

const BUG_RESOLVED = `---
title: "Navigation bar misaligned"
status: resolved
author: "user"
created-at: "2025-01-02T00:00:00.000Z"
---

## Description

The navigation bar is misaligned on mobile devices.
`;

const BUG_DRAFT = `---
title: "Incomplete bug draft"
status: draft
author: "user"
created-at: "2025-01-03T00:00:00.000Z"
---

## Description

Draft bug details to enrich.
`;

describe('Bug parser', () => {
  it('parses bug frontmatter correctly', () => {
    const result = parseBugFile('bugs/BUG-001.md', BUG_OPEN);
    expect(result.frontmatter.title).toBe('Login fails with empty password');
    expect(result.frontmatter.status).toBe('open');
    expect(result.frontmatter.author).toBe('user');
    expect(result.frontmatter['created-at']).toBe('2025-01-01T00:00:00.000Z');
    expect(result.body).toContain('## Description');
    expect(result.body).toContain('empty password');
  });

  it('provides defaults for missing fields', () => {
    const content = `---
title: "Minimal bug"
---

Some body.
`;
    const result = parseBugFile('test.md', content);
    expect(result.frontmatter.status).toBe('open');
    expect(result.frontmatter.author).toBe('');
    expect(result.frontmatter['created-at']).toBe('');
  });
});

describe('Bug file discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-bug-discovery-'));
    await mkdir(join(tempDir, 'bugs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('discovers .md files in bugs/', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-002.md'), BUG_RESOLVED, 'utf-8');

    const files = await discoverBugFiles(tempDir);
    expect(files).toHaveLength(2);
  });

  it('returns empty array when no bug files exist', async () => {
    const files = await discoverBugFiles(tempDir);
    expect(files).toHaveLength(0);
  });
});

describe('SDD Bug methods', () => {
  let tempDir: string;
  let sdd: SDD;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-bug-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('bugs() returns all bugs', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-002.md'), BUG_RESOLVED, 'utf-8');

    const bugs = await sdd.bugs();
    expect(bugs).toHaveLength(2);
    expect(bugs[0].frontmatter.title).toBe('Login fails with empty password');
    expect(bugs[1].frontmatter.title).toBe('Navigation bar misaligned');
  });

  it('openBugs() returns only open bugs', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-002.md'), BUG_RESOLVED, 'utf-8');

    const open = await sdd.openBugs();
    expect(open).toHaveLength(1);
    expect(open[0].frontmatter.status).toBe('open');
    expect(open[0].frontmatter.title).toBe('Login fails with empty password');
  });

  it('markBugResolved() changes open to resolved', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');

    const marked = await sdd.markBugResolved(['bugs/BUG-001.md']);
    expect(marked).toEqual(['bugs/BUG-001.md']);

    const content = await readFile(join(tempDir, 'bugs/BUG-001.md'), 'utf-8');
    expect(content).toContain('status: resolved');
  });

  it('markBugResolved() without args marks all open bugs', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');
    const open2 = BUG_OPEN.replace('Login fails with empty password', 'Second bug');
    await writeFile(join(tempDir, 'bugs/BUG-002.md'), open2, 'utf-8');

    const marked = await sdd.markBugResolved();
    expect(marked).toHaveLength(2);
  });

  it('markBugResolved() skips already resolved bugs', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_RESOLVED, 'utf-8');

    const marked = await sdd.markBugResolved();
    expect(marked).toHaveLength(0);
  });

  it('markBugResolved() skips draft bugs', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_DRAFT, 'utf-8');

    const marked = await sdd.markBugResolved();
    expect(marked).toHaveLength(0);

    const content = await readFile(join(tempDir, 'bugs/BUG-001.md'), 'utf-8');
    expect(content).toContain('status: draft');
  });

  it('integration: create bug → open → mark resolved → no longer open', async () => {
    await writeFile(join(tempDir, 'bugs/BUG-001.md'), BUG_OPEN, 'utf-8');

    // Should be open
    let open = await sdd.openBugs();
    expect(open).toHaveLength(1);

    // Mark as resolved
    await sdd.markBugResolved();

    // Should no longer be open
    open = await sdd.openBugs();
    expect(open).toHaveLength(0);

    // But still in the full list
    const all = await sdd.bugs();
    expect(all).toHaveLength(1);
    expect(all[0].frontmatter.status).toBe('resolved');
  });

  it('init creates bugs/ directory', async () => {
    expect(existsSync(join(tempDir, 'bugs'))).toBe(true);
  });
});
