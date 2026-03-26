import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, info, crStatusLabel } from '../ui/format.js';

export function registerCR(program: Command): void {
  const cr = program
    .command('cr')
    .description('Manage change requests');

  cr.command('list')
    .description('List all change requests with their status')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });
      const crs = await sdd.changeRequests();

      console.log(heading('Change Requests'));

      if (crs.length === 0) {
        console.log(info('No change requests found.\n'));
        return;
      }

      for (const cr of crs) {
        const icon = cr.frontmatter.status === 'applied' ? chalk.green('  ✓') : cr.frontmatter.status === 'draft' ? chalk.magenta('  ◇') : chalk.yellow('  ●');
        console.log(`${icon} ${chalk.white(cr.relativePath)} ${chalk.dim(`[${crStatusLabel(cr.frontmatter.status)}]`)} ${chalk.cyan(cr.frontmatter.title)}`);
      }
      console.log('');
    });

  cr.command('pending')
    .description('Show pending change requests for the agent to process')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });
      const pending = await sdd.pendingChangeRequests();

      if (pending.length === 0) {
        console.log(heading('Change Requests'));
        console.log(info('No pending change requests.\n'));
        return;
      }

      console.log(heading(`Pending Change Requests (${pending.length})`));

      for (const cr of pending) {
        console.log(chalk.cyan.bold(`  --- ${cr.relativePath} ---`));
        console.log(chalk.cyan(`  Title: ${cr.frontmatter.title}`));
        console.log('');
        console.log(cr.body.trim().split('\n').map((line: string) => `  ${line}`).join('\n'));
        console.log('');
      }
    });

  program
    .command('mark-cr-applied [files...]')
    .description('Mark change requests as applied')
    .action(async (files: string[]) => {
      const sdd = new SDD({ root: process.cwd() });
      const marked = await sdd.markCRApplied(files.length > 0 ? files : undefined);

      console.log(heading('Mark CR Applied'));

      if (marked.length === 0) {
        console.log(info('No pending change requests to mark.\n'));
        return;
      }

      for (const f of marked) {
        console.log(chalk.green(`  ✓ ${f}`));
      }
      console.log(chalk.dim(`\n  ${marked.length} change request(s) marked as applied.\n`));
    });
}
