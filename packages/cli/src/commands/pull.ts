import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, warning, info } from '../ui/format.js';

export function registerPull(program: Command): void {
  program
    .command('pull')
    .description('Pull documents, CRs, and bugs from remote')
    .option('--docs-only', 'Only pull documents')
    .option('--crs-only', 'Only pull change requests')
    .option('--bugs-only', 'Only pull bugs')
    .option('--timeout <seconds>', 'Remote request timeout in seconds (default: 300)', parseInt)
    .action(async (options: { docsOnly?: boolean; crsOnly?: boolean; bugsOnly?: boolean; timeout?: number }) => {
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
        if (result.conflicts.length > 0) {
          for (const c of result.conflicts) {
            console.log(warning(`${c.path} — ${c.reason} (local: v${c.localVersion}, remote: v${c.remoteVersion})`));
          }
        }

        const total = result.created.length + result.updated.length;
        if (total > 0) {
          console.log(success(`${result.created.length} created, ${result.updated.length} updated`));
        } else if (result.conflicts.length === 0) {
          console.log(info('Documents up to date.'));
        }
        console.log('');
      }

      // Pull CRs
      if (pullAll || options.crsOnly) {
        console.log(chalk.dim('  Pulling change requests...'));
        const crResult = await sdd.pullCRs(options.timeout);
        if (crResult.created > 0 || crResult.updated > 0) {
          console.log(success(`${crResult.created} created, ${crResult.updated} updated`));
        } else {
          console.log(info('No pending change requests on remote.'));
        }
        console.log('');
      }

      // Pull bugs
      if (pullAll || options.bugsOnly) {
        console.log(chalk.dim('  Pulling bugs...'));
        const bugResult = await sdd.pullBugs(options.timeout);
        if (bugResult.created > 0 || bugResult.updated > 0) {
          console.log(success(`${bugResult.created} created, ${bugResult.updated} updated`));
        } else {
          console.log(info('No open bugs on remote.'));
        }
        console.log('');
      }
    });
}
