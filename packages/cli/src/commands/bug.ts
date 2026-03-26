import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, info, bugStatusLabel } from '../ui/format.js';
import { requireCorrectBranch } from '../ui/branch-guard.js';

export function registerBug(program: Command): void {
  const bug = program
    .command('bug')
    .description('Manage bugs');

  bug.command('list')
    .description('List all bugs with their status')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });
      const bugs = await sdd.bugs();

      console.log(heading('Bugs'));

      if (bugs.length === 0) {
        console.log(info('No bugs found.\n'));
        return;
      }

      for (const b of bugs) {
        const icon = b.frontmatter.status === 'resolved' ? chalk.green('  ✓') : b.frontmatter.status === 'draft' ? chalk.magenta('  ◇') : chalk.yellow('  ●');
        console.log(`${icon} ${chalk.white(b.relativePath)} ${chalk.dim(`[${bugStatusLabel(b.frontmatter.status)}]`)} ${chalk.cyan(b.frontmatter.title)}`);
      }
      console.log('');
    });

  bug.command('open')
    .description('Show open bugs for the agent to process')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });
      const open = await sdd.openBugs();

      if (open.length === 0) {
        console.log(heading('Bugs'));
        console.log(info('No open bugs.\n'));
        return;
      }

      console.log(heading(`Open Bugs (${open.length})`));

      for (const b of open) {
        console.log(chalk.cyan.bold(`  --- ${b.relativePath} ---`));
        console.log(chalk.cyan(`  Title: ${b.frontmatter.title}`));
        console.log('');
        console.log(b.body.trim().split('\n').map((line: string) => `  ${line}`).join('\n'));
        console.log('');
      }
    });

  program
    .command('mark-bug-resolved [files...]')
    .description('Mark bugs as resolved')
    .action(async (files: string[]) => {
      await requireCorrectBranch(process.cwd());
      const sdd = new SDD({ root: process.cwd() });
      const marked = await sdd.markBugResolved(files.length > 0 ? files : undefined);

      console.log(heading('Mark Bug Resolved'));

      if (marked.length === 0) {
        console.log(info('No open bugs to mark.\n'));
        return;
      }

      for (const f of marked) {
        console.log(chalk.green(`  ✓ ${f}`));
      }
      console.log(chalk.dim(`\n  ${marked.length} bug(s) marked as resolved.\n`));
    });
}
