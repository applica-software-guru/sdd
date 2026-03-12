import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { heading, success, info } from '../ui/format.js';
import { installSkills } from '../skills.js';

export function registerUpgrade(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade sdd to the latest version and refresh skills in the current project')
    .action(async () => {
      console.log(heading('SDD Upgrade'));
      console.log(info('Running: npm install -g @applica-software-guru/sdd@latest\n'));

      const exitCode = await new Promise<number>((resolve) => {
        const child = spawn('npm', ['install', '-g', '@applica-software-guru/sdd@latest'], {
          stdio: 'inherit',
          shell: false,
        });
        child.on('close', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
      });

      if (exitCode !== 0) {
        console.error(chalk.red('\n  Upgrade failed. Check the output above.'));
        process.exit(exitCode);
      }

      console.log('');
      console.log(success('CLI upgraded.'));

      // If run from inside an SDD project, refresh the skills too
      const projectRoot = process.cwd();
      const isSddProject = existsSync(join(projectRoot, '.sdd', 'config.yaml'));

      if (isSddProject) {
        const updated = installSkills(projectRoot);
        if (updated) {
          console.log(success(`Skills updated in ${chalk.cyan('.claude/skills/')}`));
        }
      } else {
        console.log(
          chalk.dim(
            '\n  Run this command from inside an SDD project to also refresh skill files.',
          ),
        );
      }
    });
}
