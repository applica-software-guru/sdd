import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../src/parser/frontmatter.js';
import { extractPendingItems, extractAgentNotes } from '../src/parser/section-extractor.js';
import { extractCrossRefs } from '../src/parser/ref-extractor.js';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const content = `---
title: "Auth Feature"
status: draft
author: "test@example.com"
last-modified: "2024-01-01"
version: "1.2"
---

# Content here`;

    const result = parseFrontmatter('test.md', content);
    expect(result.frontmatter.title).toBe('Auth Feature');
    expect(result.frontmatter.status).toBe('draft');
    expect(result.frontmatter.version).toBe('1.2');
    expect(result.body).toContain('# Content here');
  });

  it('provides defaults for missing fields', () => {
    const content = `---
title: "Test"
---

Body`;

    const result = parseFrontmatter('test.md', content);
    expect(result.frontmatter.status).toBe('draft');
    expect(result.frontmatter.version).toBe('1.0');
  });
});

describe('extractPendingItems', () => {
  it('extracts unchecked and checked items', () => {
    const body = `# Feature

## Pending Changes
- [ ] Add validation
- [x] Create model
- [ ] Write tests

## Other`;

    const items = extractPendingItems(body);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ text: 'Add validation', checked: false });
    expect(items[1]).toEqual({ text: 'Create model', checked: true });
    expect(items[2]).toEqual({ text: 'Write tests', checked: false });
  });

  it('returns empty array when section is missing', () => {
    const items = extractPendingItems('# Just a doc\n\nSome content.');
    expect(items).toEqual([]);
  });
});

describe('extractAgentNotes', () => {
  it('extracts agent notes section', () => {
    const body = `# Feature

## Agent Notes
Do not modify existing auth logic.
Follow adapter interface.

## Other`;

    const notes = extractAgentNotes(body);
    expect(notes).toContain('Do not modify existing auth logic.');
    expect(notes).toContain('Follow adapter interface.');
  });

  it('returns null when section is missing', () => {
    expect(extractAgentNotes('# No notes here')).toBeNull();
  });
});

describe('extractCrossRefs', () => {
  it('extracts unique cross-references', () => {
    const body = 'Use [[User]] model and [[Session]] entity. Also reference [[User]] again.';
    const refs = extractCrossRefs(body);
    expect(refs).toEqual(['User', 'Session']);
  });

  it('returns empty array with no refs', () => {
    expect(extractCrossRefs('No references here.')).toEqual([]);
  });
});
