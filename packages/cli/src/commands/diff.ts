import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading } from '../ui/format.js';

export function registerDiff(program: Command): void {
  program
    .command('diff')
    .description('Show files that need to be synced')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });
      const pending = await sdd.pending();

      console.log(heading('Pending'));

      if (pending.length === 0) {
        console.log(chalk.green('  ✓ Everything is synced.\n'));
        return;
      }

      console.log(chalk.yellow(`  ${pending.length} file(s) pending:\n`));

      for (const f of pending) {
        const { status } = f.frontmatter;
        const icon =
          status === 'deleted'
            ? chalk.red('  ✗')
            : status === 'new'
              ? chalk.cyan('  +')
              : chalk.yellow('  ~');

        const label =
          status === 'deleted'
            ? chalk.red('deleted')
            : status === 'new'
              ? chalk.cyan('new')
              : chalk.yellow('changed');

        console.log(`${icon} ${chalk.white(f.relativePath)} ${chalk.dim(`(${label})`)}`);
      }
      console.log('');
    });
}
