import { describe, it, expect } from 'vitest';
import { generatePrompt } from '../src/prompt/prompt-generator.js';
import type { StoryFile } from '../src/types.js';

function makeFile(overrides: Partial<StoryFile> = {}): StoryFile {
  return {
    relativePath: 'product/features/auth.md',
    frontmatter: {
      title: 'Auth',
      status: 'new',
      author: 'test',
      'last-modified': '2024-01-01T00:00:00.000Z',
      version: '1.0',
    },
    body: '# Auth Feature',
    pendingItems: [],
    agentNotes: null,
    crossRefs: [],
    hash: 'abc',
    ...overrides,
  };
}

describe('generatePrompt', () => {
  it('generates prompt with new files', () => {
    const files = [makeFile()];
    const prompt = generatePrompt(files, '/tmp');
    expect(prompt).toContain('## Pending files (1)');
    expect(prompt).toContain('product/features/auth.md');
    expect(prompt).toContain('**new**');
  });

  it('generates prompt with deleted files', () => {
    const files = [makeFile({
      frontmatter: { ...makeFile().frontmatter, status: 'deleted' },
    })];
    const prompt = generatePrompt(files, '/tmp');
    expect(prompt).toContain('**deleted**');
    expect(prompt).toContain('Files to remove');
    expect(prompt).toContain('product/features/auth.md');
  });

  it('generates prompt with changed files', () => {
    const files = [makeFile({
      frontmatter: { ...makeFile().frontmatter, status: 'changed' },
    })];
    const prompt = generatePrompt(files, '/tmp');
    expect(prompt).toContain('**changed**');
  });

  it('generates empty prompt when no pending files', () => {
    const prompt = generatePrompt([]);
    expect(prompt).toBe('Nothing to do — all files are synced.');
  });
});
