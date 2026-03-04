import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SDD } from '@applica-software-guru/sdd-core';
import { heading, success, warning, error } from '../ui/format.js';

export function registerValidate(program: Command): void {
  program
    .command('validate')
    .description('Validate documentation for issues')
    .action(async () => {
      const spinner = ora({ text: 'Validating...', color: 'cyan' }).start();

      const sdd = new SDD({ root: process.cwd() });
      const result = await sdd.validate();

      spinner.stop();

      console.log(heading('Validation'));

      if (result.valid && result.issues.length === 0) {
        console.log(success('No issues found.\n'));
        return;
      }

      for (const issue of result.issues) {
        if (issue.severity === 'error') {
          console.log(error(`${chalk.white(issue.filePath)}: ${issue.message}`));
        } else {
          console.log(warning(`${chalk.white(issue.filePath)}: ${issue.message}`));
        }
      }

      const errors = result.issues.filter((i) => i.severity === 'error').length;
      const warnings = result.issues.filter((i) => i.severity === 'warning').length;
      console.log(
        `\n  ${chalk.red.bold(String(errors))} error(s)  ${chalk.yellow.bold(String(warnings))} warning(s)\n`
      );

      if (!result.valid) {
        process.exit(1);
      }
    });
}
