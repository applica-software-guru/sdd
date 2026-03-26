import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, info } from '../ui/format.js';

export function registerMarkDraftsEnriched(program: Command): void {
  program
    .command('mark-drafts-enriched [files...]')
    .description('Mark draft elements as enriched (docs → new, CRs → pending, bugs → open)')
    .action(async (files: string[]) => {
      const sdd = new SDD({ root: process.cwd() });
      const marked = await sdd.markDraftsEnriched(files.length > 0 ? files : undefined);

      console.log(heading('Mark Drafts Enriched'));

      if (marked.length === 0) {
        console.log(info('No draft elements to mark.\n'));
        return;
      }

      for (const f of marked) {
        console.log(success(f));
      }
      console.log(chalk.dim(`\n  ${marked.length} element(s) marked as enriched.\n`));
    });
}
