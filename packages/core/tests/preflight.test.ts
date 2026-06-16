import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SDD } from '../src/sdd.js';

const SYNCED_DOC = `---
title: "Synced feature"
status: synced
author: "user"
last-modified: "2025-01-01T00:00:00.000Z"
version: "1.0"
---

# Synced

Already implemented.
`;

const NEW_DOC = `---
title: "New feature"
status: new
author: "user"
last-modified: "2025-01-02T00:00:00.000Z"
version: "1.0"
---

# New

To implement.
`;

const CHANGED_DOC = `---
title: "Changed feature"
status: changed
author: "user"
last-modified: "2025-01-03T00:00:00.000Z"
version: "1.1"
---

# Changed

Modified since last sync.
`;

const DELETED_DOC = `---
title: "Removed feature"
status: deleted
author: "user"
last-modified: "2025-01-04T00:00:00.000Z"
version: "1.0"
---

# Removed

To delete.
`;

const DRAFT_DOC = `---
title: "Draft feature"
status: draft
author: "user"
last-modified: "2025-01-05T00:00:00.000Z"
version: "1.0"
---

# Draft

Not enriched yet.
`;

const CR_PENDING = `---
title: "Add dark mode"
status: pending
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description
Apply to docs.
`;

const CR_DRAFT = `---
title: "Draft CR"
status: draft
author: "user"
created-at: "2025-01-02T00:00:00.000Z"
---

## Description
Not enriched.
`;

const CR_APPLIED = `---
title: "Applied CR"
status: applied
author: "user"
created-at: "2025-01-03T00:00:00.000Z"
---

## Description
Already applied.
`;

const BUG_OPEN = `---
title: "Open bug"
status: open
author: "user"
created-at: "2025-01-01T00:00:00.000Z"
---

## Description
Fix me.
`;

const BUG_DRAFT = `---
title: "Draft bug"
status: draft
author: "user"
created-at: "2025-01-02T00:00:00.000Z"
---

## Description
Not enriched.
`;

const BUG_RESOLVED = `---
title: "Resolved bug"
status: resolved
author: "user"
created-at: "2025-01-03T00:00:00.000Z"
---

## Description
Already fixed.
`;

describe('SDD.preflight()', () => {
  let tempDir: string;
  let sdd: SDD;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sdd-preflight-'));
    sdd = new SDD({ root: tempDir });
    await sdd.init({ description: 'test' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('returns clean=true on a freshly initialized project', async () => {
    const result = await sdd.preflight();
    expect(result.clean).toBe(true);
    expect(result.validation.valid).toBe(true);
    expect(result.transientDocs).toHaveLength(0);
    expect(result.drafts.docs).toHaveLength(0);
    expect(result.drafts.crs).toHaveLength(0);
    expect(result.drafts.bugs).toHaveLength(0);
    expect(result.pendingCRs).toHaveLength(0);
    expect(result.openBugs).toHaveLength(0);
  });

  it('detects transient docs (new/changed/deleted)', async () => {
    await writeFile(join(tempDir, 'product/synced.md'), SYNCED_DOC, 'utf-8');
    await writeFile(join(tempDir, 'product/new.md'), NEW_DOC, 'utf-8');
    await writeFile(join(tempDir, 'product/changed.md'), CHANGED_DOC, 'utf-8');
    await writeFile(join(tempDir, 'product/deleted.md'), DELETED_DOC, 'utf-8');

    const result = await sdd.preflight();

    expect(result.clean).toBe(false);
    expect(result.transientDocs).toHaveLength(3);
    const statuses = result.transientDocs.map((f) => f.frontmatter.status).sort();
    expect(statuses).toEqual(['changed', 'deleted', 'new']);
  });

  it('detects abandoned draft docs', async () => {
    await writeFile(join(tempDir, 'product/draft.md'), DRAFT_DOC, 'utf-8');

    const result = await sdd.preflight();

    expect(result.clean).toBe(false);
    expect(result.drafts.docs).toHaveLength(1);
    expect(result.drafts.docs[0].frontmatter.status).toBe('draft');
  });

  it('detects draft CRs and draft bugs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-draft.md'), CR_DRAFT, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-draft.md'), BUG_DRAFT, 'utf-8');

    const result = await sdd.preflight();

    expect(result.clean).toBe(false);
    expect(result.drafts.crs).toHaveLength(1);
    expect(result.drafts.bugs).toHaveLength(1);
  });

  it('detects pending CRs and open bugs', async () => {
    await writeFile(join(tempDir, 'change-requests/CR-pending.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-open.md'), BUG_OPEN, 'utf-8');

    const result = await sdd.preflight();

    expect(result.clean).toBe(false);
    expect(result.pendingCRs).toHaveLength(1);
    expect(result.pendingCRs[0].frontmatter.status).toBe('pending');
    expect(result.openBugs).toHaveLength(1);
    expect(result.openBugs[0].frontmatter.status).toBe('open');
  });

  it('ignores terminal states (applied CR, resolved bug, synced doc)', async () => {
    await writeFile(join(tempDir, 'product/synced.md'), SYNCED_DOC, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-applied.md'), CR_APPLIED, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-resolved.md'), BUG_RESOLVED, 'utf-8');

    const result = await sdd.preflight();

    expect(result.clean).toBe(true);
    expect(result.transientDocs).toHaveLength(0);
    expect(result.pendingCRs).toHaveLength(0);
    expect(result.openBugs).toHaveLength(0);
  });

  it('combines multiple issues and reports clean=false', async () => {
    await writeFile(join(tempDir, 'product/new.md'), NEW_DOC, 'utf-8');
    await writeFile(join(tempDir, 'product/draft.md'), DRAFT_DOC, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-pending.md'), CR_PENDING, 'utf-8');
    await writeFile(join(tempDir, 'change-requests/CR-draft.md'), CR_DRAFT, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-open.md'), BUG_OPEN, 'utf-8');
    await writeFile(join(tempDir, 'bugs/BUG-resolved.md'), BUG_RESOLVED, 'utf-8');

    const result = await sdd.preflight();

    expect(result.clean).toBe(false);
    expect(result.transientDocs).toHaveLength(1);
    expect(result.drafts.docs).toHaveLength(1);
    expect(result.drafts.crs).toHaveLength(1);
    expect(result.drafts.bugs).toHaveLength(0);
    expect(result.pendingCRs).toHaveLength(1);
    expect(result.openBugs).toHaveLength(1);
  });

  it('exposes the validation result (cross-references)', async () => {
    const result = await sdd.preflight();
    expect(result.validation).toBeDefined();
    expect(Array.isArray(result.validation.issues)).toBe(true);
  });
});
