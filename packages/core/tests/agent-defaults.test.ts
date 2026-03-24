import { describe, it, expect } from 'vitest';
import { resolveAgentCommand, DEFAULT_AGENTS } from '../src/agent/agent-defaults.js';

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
