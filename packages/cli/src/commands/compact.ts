import { Command } from 'commander';
import chalk from 'chalk';
import { SDD, type CompactMode } from '@applica-software-guru/sdd-core';
import { heading, info, success, warning } from '../ui/format.js';

export function registerCompact(program: Command): void {
  program
    .command('compact')
    .description('Archive or purge closed change requests (applied) and bugs (resolved) to keep the project lean')
    .option('--purge', 'Delete files permanently instead of archiving them')
    .option('--dry-run', 'Show what would happen without touching the filesystem')
    .action(async (options: { purge?: boolean; dryRun?: boolean }) => {
      const sdd = new SDD({ root: process.cwd() });
      const mode: CompactMode = options.purge ? 'purge' : 'archive';
      const result = await sdd.compact({ mode, dryRun: options.dryRun });

      const title = options.dryRun
        ? `Compact (dry-run, ${mode})`
        : `Compact (${mode})`;
      console.log(heading(title));

      const total = result.changeRequests.length + result.bugs.length;

      if (total === 0) {
        console.log(info('No closed change requests or bugs to compact.\n'));
        return;
      }

      const label = (rel: string): string =>
        options.dryRun ? chalk.cyan(`  • ${rel}`) : success(rel);

      if (result.changeRequests.length > 0) {
        console.log(chalk.dim(`  Change requests (${result.changeRequests.length}):`));
        for (const cr of result.changeRequests) {
          console.log(label(cr));
        }
      }

      if (result.bugs.length > 0) {
        console.log(chalk.dim(`  Bugs (${result.bugs.length}):`));
        for (const bug of result.bugs) {
          console.log(label(bug));
        }
      }

      if (options.dryRun) {
        console.log(warning(`Dry-run: ${total} file(s) would be ${mode === 'purge' ? 'deleted' : 'archived'}.`));
      } else {
        const verb = mode === 'purge' ? 'deleted' : 'archived';
        console.log(chalk.dim(`\n  ${total} file(s) ${verb}.\n`));
      }
    });
}
