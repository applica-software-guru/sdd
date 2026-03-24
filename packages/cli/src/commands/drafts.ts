import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, info } from '../ui/format.js';
import { renderMarkdown } from '../ui/markdown.js';

export function registerDrafts(program: Command): void {
  program
    .command('drafts')
    .description('List draft docs/CRs/bugs and print a TODO prompt for the agent')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });

      console.log(heading('Drafts'));

      const drafts = await sdd.drafts();
      const total = drafts.docs.length + drafts.crs.length + drafts.bugs.length;

      if (total === 0) {
        console.log(info('No draft elements found.'));
        return;
      }

      console.log(info(`Found ${total} draft element(s):`));
      if (drafts.docs.length > 0) {
        console.log(chalk.dim(`  Documents (${drafts.docs.length})`));
        for (const f of drafts.docs) {
          console.log(chalk.magenta(`  ◇ ${f.relativePath}`));
        }
      }
      if (drafts.crs.length > 0) {
        console.log(chalk.dim(`  Change Requests (${drafts.crs.length})`));
        for (const cr of drafts.crs) {
          console.log(chalk.magenta(`  ◇ ${cr.relativePath}`));
        }
      }
      if (drafts.bugs.length > 0) {
        console.log(chalk.dim(`  Bugs (${drafts.bugs.length})`));
        for (const bug of drafts.bugs) {
          console.log(chalk.magenta(`  ◇ ${bug.relativePath}`));
        }
      }
      console.log('');

      const prompt = await sdd.draftEnrichmentPrompt();
      if (!prompt) {
        console.log(info('Drafts are present but no enrichment prompt could be generated.'));
        return;
      }

      console.log(chalk.dim('  ─'.repeat(30)));
      console.log(heading('Draft TODO'));
      console.log(renderMarkdown(prompt));
      console.log(chalk.dim('  ─'.repeat(30)));
      console.log(info('After enrichment, run `sdd mark-drafts-enriched` when drafts are ready.'));
    });
}
