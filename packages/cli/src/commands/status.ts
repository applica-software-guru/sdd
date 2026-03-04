import { Command } from 'commander';
import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';
import { createStatusTable, heading, info } from '../ui/format.js';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show status of all story files')
    .action(async () => {
      const sdd = new SDD({ root: process.cwd() });
      const result = await sdd.status();

      if (result.files.length === 0) {
        console.log(heading('Status'));
        console.log(info('No story files found.\n'));
        return;
      }

      const counts = {
        new: result.files.filter((f) => f.status === 'new').length,
        changed: result.files.filter((f) => f.status === 'changed').length,
        deleted: result.files.filter((f) => f.status === 'deleted').length,
        synced: result.files.filter((f) => f.status === 'synced').length,
      };

      console.log(heading('Story Files'));
      console.log(createStatusTable(result.files));
      console.log('');

      const parts: string[] = [];
      if (counts.new) parts.push(chalk.cyan.bold(`${counts.new} new`));
      if (counts.changed) parts.push(chalk.yellow.bold(`${counts.changed} changed`));
      if (counts.deleted) parts.push(chalk.red.bold(`${counts.deleted} deleted`));
      if (counts.synced) parts.push(chalk.green.bold(`${counts.synced} synced`));
      console.log(`  ${parts.join('  ')}\n`);
    });
}
