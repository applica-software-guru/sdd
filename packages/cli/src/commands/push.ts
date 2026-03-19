import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, info } from '../ui/format.js';

export function registerPush(program: Command): void {
  program
    .command('push [files...]')
    .description('Push pending documents to remote')
    .option('--all', 'Push all files including synced')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (files: string[], options: { all?: boolean; timeout?: number }) => {
      const sdd = new SDD({ root: process.cwd() });

      console.log(heading('Push to Remote'));
      console.log(chalk.dim('  Pushing documents...'));

      const paths = files.length > 0 ? files : undefined;
      const result = await sdd.push(paths, { all: options.all, timeout: options.timeout });

      if (result.pushed.length === 0 && result.deleted.length === 0) {
        console.log(info('No pending files to push.\n'));
        return;
      }

      for (const p of result.pushed) {
        console.log(chalk.green(`  ✓ ${p}`));
      }
      for (const p of result.deleted) {
        console.log(chalk.red(`  ✗ ${p} (deleted)`));
      }

      console.log('');
      const parts = [`${result.created} created`, `${result.updated} updated`];
      if (result.deleted.length > 0) parts.push(`${result.deleted.length} deleted`);
      console.log(success(`${parts.join(', ')} on remote`));
      console.log(chalk.dim(`  ${result.pushed.length + result.deleted.length} file(s) synced.\n`));
    });
}
