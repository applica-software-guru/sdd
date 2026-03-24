import { describe, it, expect } from 'vitest';
import { generateApplyPrompt } from '../src/prompt/apply-prompt-generator.js';
import { resolveAgentCommand, DEFAULT_AGENTS } from '../src/agent/agent-defaults.js';
import type { Bug, ChangeRequest, StoryFile } from '../src/types.js';

function makeBug(overrides: Partial<Bug> = {}): Bug {
  return {
    relativePath: 'bugs/BUG-001.md',
    frontmatter: {
      title: 'Login button broken',
      status: 'open',
      author: 'test',
      'created-at': '2024-01-01T00:00:00.000Z',
    },
    body: '## Description\n\nThe login button does not work.',
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

describe('generateApplyPrompt', () => {
  it('returns null when nothing to do', () => {
    const result = generateApplyPrompt([], [], [], '/tmp');
    expect(result).toBeNull();
  });

  it('generates prompt with only bugs', () => {
    const prompt = generateApplyPrompt([makeBug()], [], [], '/tmp');
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('## Open bugs (1)');
    expect(prompt).toContain('Login button broken');
    expect(prompt).toContain('bugs/BUG-001.md');
    expect(prompt).not.toContain('## Pending change requests');
    expect(prompt).not.toContain('## Pending files');
  });

  it('generates prompt with only CRs', () => {
    const prompt = generateApplyPrompt([], [makeCR()], [], '/tmp');
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('## Pending change requests (1)');
    expect(prompt).toContain('Add dark mode');
    expect(prompt).not.toContain('## Open bugs');
    expect(prompt).not.toContain('## Pending files');
  });

  it('generates prompt with only pending files', () => {
    const prompt = generateApplyPrompt([], [], [makeFile()], '/tmp');
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('## Pending files (1)');
    expect(prompt).toContain('product/features/auth.md');
    expect(prompt).toContain('**new**');
    expect(prompt).not.toContain('## Open bugs');
    expect(prompt).not.toContain('## Pending change requests');
  });

  it('generates prompt with all three', () => {
    const prompt = generateApplyPrompt([makeBug()], [makeCR()], [makeFile()], '/tmp');
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('## Open bugs (1)');
    expect(prompt).toContain('## Pending change requests (1)');
    expect(prompt).toContain('## Pending files (1)');
  });
});

describe('resolveAgentCommand', () => {
  it('resolves built-in agent', () => {
    const cmd = resolveAgentCommand('claude');
    expect(cmd).toBe(DEFAULT_AGENTS.claude);
  });

  it('resolves config agent over built-in', () => {
    const cmd = resolveAgentCommand('claude', { claude: 'my-claude $PROMPT' });
    expect(cmd).toBe('my-claude $PROMPT');
  });

  it('resolves custom agent from config', () => {
    const cmd = resolveAgentCommand('my-agent', { 'my-agent': 'my-agent-cmd $PROMPT' });
    expect(cmd).toBe('my-agent-cmd $PROMPT');
  });

  it('returns undefined for unknown agent', () => {
    const cmd = resolveAgentCommand('unknown');
    expect(cmd).toBeUndefined();
  });
});
