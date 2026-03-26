import { Command } from 'commander';
import { SDD } from '@applica-software-guru/sdd-core';
import { requireCorrectBranch } from '../ui/branch-guard.js';

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Output the sync prompt for pending files (new/changed/deleted)')
    .action(async () => {
      await requireCorrectBranch(process.cwd());
      const sdd = new SDD({ root: process.cwd() });
      const prompt = await sdd.sync();
      process.stdout.write(prompt);
    });
}
