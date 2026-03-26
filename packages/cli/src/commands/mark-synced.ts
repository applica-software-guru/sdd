import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, info } from '../ui/format.js';
import { requireCorrectBranch } from '../ui/branch-guard.js';

export function registerMarkSynced(program: Command): void {
  program
    .command('mark-synced [files...]')
    .description('Mark specific files (or all) as synced')
    .action(async (files: string[]) => {
      await requireCorrectBranch(process.cwd());
      const sdd = new SDD({ root: process.cwd() });
      const marked = await sdd.markSynced(files.length > 0 ? files : undefined);

      console.log(heading('Mark Synced'));

      if (marked.length === 0) {
        console.log(info('No pending files to mark.\n'));
        return;
      }

      for (const f of marked) {
        console.log(success(f));
      }
      console.log(chalk.dim(`\n  ${marked.length} file(s) marked as synced.\n`));
    });
}
