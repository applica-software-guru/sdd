export const DEFAULT_AGENTS: Record<string, string> = {
  claude: 'claude -p "$(cat $PROMPT_FILE)" --permission-mode auto --verbose --model $MODEL',
  codex: 'codex -q "$(cat $PROMPT_FILE)" -m $MODEL',
  opencode: 'opencode -p "$(cat $PROMPT_FILE)"',
};

export function resolveAgentCommand(
  name: string,
  configAgents?: Record<string, string>
): string | undefined {
  return configAgents?.[name] ?? DEFAULT_AGENTS[name];
}
