#!/usr/bin/env node
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerStatus } from './commands/status.js';
import { registerDiff } from './commands/diff.js';
import { registerSync } from './commands/sync.js';
import { registerValidate } from './commands/validate.js';
import { registerMarkSynced } from './commands/mark-synced.js';
import { registerCR } from './commands/cr.js';

const program = new Command();

program
  .name('sdd')
  .description('Story Driven Development — manage apps through structured documentation')
  .version('0.1.0');

registerInit(program);
registerStatus(program);
registerDiff(program);
registerSync(program);
registerValidate(program);
registerMarkSynced(program);
registerCR(program);

program.parseAsync().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
