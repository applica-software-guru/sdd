import { describe, it, expect } from 'vitest';
import { generateDraftEnrichmentPrompt, type DraftElements } from '../src/prompt/draft-prompt-generator.js';
import type { Bug, ChangeRequest, StoryFile } from '../src/types.js';

function makeFile(overrides: Partial<StoryFile> = {}): StoryFile {
  return {
    relativePath: 'product/features/auth.md',
    frontmatter: {
      title: 'Auth',
      status: 'draft',
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

function makeCR(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    relativePath: 'change-requests/CR-001.md',
    frontmatter: {
      title: 'Add dark mode',
      status: 'draft',
      author: 'test',
      'created-at': '2024-01-01T00:00:00.000Z',
    },
    body: '## Changes\n\nAdd dark mode support.',
    ...overrides,
  };
}

function makeBug(overrides: Partial<Bug> = {}): Bug {
  return {
    relativePath: 'bugs/BUG-001.md',
    frontmatter: {
      title: 'Login button broken',
      status: 'draft',
      author: 'test',
      'created-at': '2024-01-01T00:00:00.000Z',
    },
    body: '## Description\n\nThe login button does not work.',
    ...overrides,
  };
}

describe('generateDraftEnrichmentPrompt', () => {
  it('returns null when there are no drafts', () => {
    const drafts: DraftElements = { docs: [], crs: [], bugs: [] };
    const prompt = generateDraftEnrichmentPrompt(drafts);
    expect(prompt).toBeNull();
  });

  it('includes only draft task lists', () => {
    const drafts: DraftElements = {
      docs: [makeFile()],
      crs: [makeCR()],
      bugs: [makeBug()],
    };
    const prompt = generateDraftEnrichmentPrompt(drafts);

    expect(prompt).not.toBeNull();
    expect(prompt).toContain('# Draft Tasks');
    expect(prompt).toContain('## Draft documents (1)');
    expect(prompt).toContain('## Draft change requests (1)');
    expect(prompt).toContain('## Draft bugs (1)');
    expect(prompt).toContain('`product/features/auth.md`');
    expect(prompt).toContain('`change-requests/CR-001.md`');
    expect(prompt).toContain('`bugs/BUG-001.md`');
    expect(prompt).not.toContain('## Project');
    expect(prompt).not.toContain('## Project context');
  });
});
