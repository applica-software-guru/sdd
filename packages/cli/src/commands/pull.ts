import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, warning, info } from '../ui/format.js';
import { requireCorrectBranch } from '../ui/branch-guard.js';

export function registerPull(program: Command): void {
  program
    .command('pull')
    .description('Pull documents, CRs, and bugs from remote')
    .option('--docs-only', 'Only pull documents')
    .option('--crs-only', 'Only pull change requests')
    .option('--bugs-only', 'Only pull bugs')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (options: { docsOnly?: boolean; crsOnly?: boolean; bugsOnly?: boolean; timeout?: number }) => {
      await requireCorrectBranch(process.cwd());
      const sdd = new SDD({ root: process.cwd() });
      const pullAll = !options.docsOnly && !options.crsOnly && !options.bugsOnly;

      console.log(heading('Pull from Remote'));

      // Pull documents
      if (pullAll || options.docsOnly) {
        console.log(chalk.dim('  Pulling documents...'));
        const result = await sdd.pull(options.timeout);

        if (result.created.length > 0) {
          for (const p of result.created) {
            console.log(chalk.cyan(`  + ${p}`));
          }
        }
        if (result.updated.length > 0) {
          for (const p of result.updated) {
            console.log(chalk.yellow(`  ~ ${p}`));
          }
        }
        if (result.deleted.length > 0) {
          for (const p of result.deleted) {
            console.log(chalk.red(`  - ${p}`));
          }
        }
        if (result.conflicts.length > 0) {
          for (const c of result.conflicts) {
            console.log(warning(`${c.path} — ${c.reason} (local: v${c.localVersion}, remote: v${c.remoteVersion})`));
          }
        }

        const total = result.created.length + result.updated.length + result.deleted.length;
        if (total > 0) {
          const parts = [];
          if (result.created.length > 0) parts.push(`${result.created.length} created`);
          if (result.updated.length > 0) parts.push(`${result.updated.length} updated`);
          if (result.deleted.length > 0) parts.push(`${result.deleted.length} deleted`);
          console.log(success(parts.join(', ')));
        } else if (result.conflicts.length === 0) {
          console.log(info('Documents up to date.'));
        }
        console.log('');
      }

      // Pull CRs
      if (pullAll || options.crsOnly) {
        console.log(chalk.dim('  Pulling change requests...'));
        const crResult = await sdd.pullCRs(options.timeout);
        if (crResult.created > 0 || crResult.updated > 0 || crResult.deleted > 0) {
          const parts = [];
          if (crResult.created > 0) parts.push(`${crResult.created} created`);
          if (crResult.updated > 0) parts.push(`${crResult.updated} updated`);
          if (crResult.deleted > 0) parts.push(`${crResult.deleted} deleted`);
          console.log(success(parts.join(', ')));
        } else {
          console.log(info('No pending change requests on remote.'));
        }
        console.log('');
      }

      // Pull bugs
      if (pullAll || options.bugsOnly) {
        console.log(chalk.dim('  Pulling bugs...'));
        const bugResult = await sdd.pullBugs(options.timeout);
        if (bugResult.created > 0 || bugResult.updated > 0 || bugResult.deleted > 0) {
          const parts = [];
          if (bugResult.created > 0) parts.push(`${bugResult.created} created`);
          if (bugResult.updated > 0) parts.push(`${bugResult.updated} updated`);
          if (bugResult.deleted > 0) parts.push(`${bugResult.deleted} deleted`);
          console.log(success(parts.join(', ')));
        } else {
          console.log(info('No open bugs on remote.'));
        }
        console.log('');
      }
    });
}
