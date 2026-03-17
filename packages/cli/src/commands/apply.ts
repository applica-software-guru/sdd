import { Command } from 'commander';
import chalk from 'chalk';
import { SDD, runAgent } from '@applica-software-guru/sdd-core';
import { heading, info } from '../ui/format.js';
import { renderMarkdown } from '../ui/markdown.js';

export function registerApply(program: Command): void {
  program
    .command('apply')
    .description('Run the full SDD workflow automatically using an external AI agent')
    .option('--agent <name>', 'Agent to use (default: from config or "claude")')
    .action(async (options) => {
      const sdd = new SDD({ root: process.cwd() });

      console.log(heading('SDD Apply'));

      const prompt = await sdd.applyPrompt();
      if (!prompt) {
        console.log(info('Nothing to apply — no drafts, open bugs, pending CRs, or pending files.'));
        return;
      }

      // Show the prompt being sent
      console.log(chalk.dim('  ─'.repeat(30)));
      console.log(heading('Agent Prompt'));
      console.log(renderMarkdown(prompt));
      console.log(chalk.dim('  ─'.repeat(30)));

      const config = await sdd.config();
      const agent = options.agent ?? config.agent ?? 'claude';

      console.log(info(`Using agent: ${chalk.cyan(agent)}`));
      console.log(info('Starting agent...\n'));

      const exitCode = await runAgent({
        root: process.cwd(),
        prompt,
        agent,
        agents: config.agents,
      });

      if (exitCode !== 0) {
        console.log(chalk.red(`\n  Agent exited with code ${exitCode}`));
        process.exit(exitCode);
      }

      console.log(chalk.green('\n  Agent completed successfully.'));
    });
}
