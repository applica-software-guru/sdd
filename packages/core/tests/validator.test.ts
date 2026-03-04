import { describe, it, expect } from 'vitest';
import { validate } from '../src/validate/validator.js';
import type { StoryFile } from '../src/types.js';

function makeFile(overrides: Partial<StoryFile> = {}): StoryFile {
  return {
    relativePath: 'product/vision.md',
    frontmatter: {
      title: 'Vision',
      status: 'draft',
      author: 'test',
      'last-modified': '2024-01-01',
      version: '1.0',
    },
    body: '# Vision',
    pendingItems: [],
    agentNotes: null,
    crossRefs: [],
    hash: 'abc',
    ...overrides,
  };
}

describe('validate', () => {
  it('returns valid when no issues', () => {
    const result = validate([makeFile()]);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('warns on broken cross-references', () => {
    const entities = makeFile({
      relativePath: 'system/entities.md',
      body: '# Entities\n\n### User\n\nA user.',
    });
    const feature = makeFile({
      relativePath: 'product/features/auth.md',
      crossRefs: ['User', 'NonExistent'],
    });
    const result = validate([entities, feature]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].rule).toBe('broken-ref');
    expect(result.issues[0].message).toContain('NonExistent');
  });

  it('warns on missing title', () => {
    const file = makeFile({
      frontmatter: { ...makeFile().frontmatter, title: '' },
    });
    const result = validate([file]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].rule).toBe('missing-frontmatter');
  });
});
