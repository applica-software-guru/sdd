import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, info } from '../ui/format.js';

export function registerPush(program: Command): void {
  program
    .command('push [files...]')
    .description('Push pending documents to remote')
    .option('--all', 'Push all files including synced')
    .action(async (files: string[], options: { all?: boolean }) => {
      const sdd = new SDD({ root: process.cwd() });

      console.log(heading('Push to Remote'));
      console.log(chalk.dim('  Pushing documents...'));

      const paths = files.length > 0 ? files : undefined;
      const result = await sdd.push(paths);

      if (result.pushed.length === 0) {
        console.log(info('No pending files to push.\n'));
        return;
      }

      for (const p of result.pushed) {
        console.log(chalk.green(`  ✓ ${p}`));
      }

      console.log('');
      console.log(success(`${result.created} created, ${result.updated} updated on remote`));
      console.log(chalk.dim(`  ${result.pushed.length} file(s) pushed and marked as synced.\n`));
    });
}
