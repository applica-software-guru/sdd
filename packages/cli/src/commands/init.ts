import { Command } from 'commander';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import clipboardy from 'clipboardy';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ora from 'ora';
import { SDD } from '@applica-software-guru/sdd-core';
import { printBanner } from '../ui/banner.js';
import { success, info } from '../ui/format.js';

const START_PROMPT = `Read INSTRUCTIONS.md and the documentation in product/ and system/, then run \`sdd sync\` to start working.`;

function buildBootstrapPrompt(description: string): string {
  return `Read INSTRUCTIONS.md first. This is a new SDD project.

Project goal: "${description}"

Your task: generate the initial documentation for this project. Ask me a few questions first to understand the project better (target users, main features, technical preferences), then create all documentation files:

- product/vision.md — Product vision and goals
- product/users.md — User personas
- product/features/*.md — One file per main feature
- system/entities.md — Data models (use ### headings per entity)
- system/architecture.md — Architecture decisions
- system/tech-stack.md — Technologies and frameworks
- system/interfaces.md — API contracts

Follow the file format described in INSTRUCTIONS.md for the YAML frontmatter. Do NOT write any code, only documentation.`;
}

export function registerInit(program: Command): void {
  program
    .command('init <project-name>')
    .description('Initialize a new SDD project')
    .option('--bootstrap', 'Generate a prompt to create initial documentation with an agent')
    .action(async (projectName: string, options) => {
      printBanner();

      const projectDir = resolve(process.cwd(), projectName);

      if (existsSync(resolve(projectDir, '.sdd'))) {
        console.log(chalk.yellow(`\n  SDD project already initialized at ${projectName}/\n`));
        return;
      }

      const description = await input({
        message: 'What should your project do?',
        theme: {
          prefix: chalk.cyan('?'),
          style: { message: (text: string) => chalk.cyan.bold(text) },
        },
      });

      if (!description.trim()) {
        console.log(chalk.yellow('\n  No description provided. Aborting.\n'));
        return;
      }

      if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true });
      }

      const spinner = ora({
        text: 'Creating project structure...',
        color: 'cyan',
      }).start();

      const sdd = new SDD({ root: projectDir });
      const files = await sdd.init({ description: description.trim() });

      spinner.stop();

      // Project created
      console.log(chalk.cyan.bold(`\n  ${chalk.white(projectName)} is ready!\n`));

      // Show what was created
      console.log(chalk.dim('  Created:'));
      for (const f of files) {
        console.log(success(f));
      }
      console.log(success('product/'));
      console.log(success('product/features/'));
      console.log(success('system/'));
      console.log(success('code/'));

      // Next steps
      console.log(chalk.cyan.bold('\n  Next steps:\n'));

      console.log(`  ${chalk.white('1.')} Enter the project folder:\n`);
      console.log(`     ${chalk.green(`cd ${projectName}`)}\n`);

      if (options.bootstrap) {
        console.log(`  ${chalk.white('2.')} Open your AI agent and paste the prompt below.`);
        console.log(`     It will ask you a few questions and generate the initial docs.\n`);
      } else {
        console.log(`  ${chalk.white('2.')} Start writing your documentation in ${chalk.cyan('product/')} and ${chalk.cyan('system/')}.`);
        console.log(`     Check ${chalk.cyan('INSTRUCTIONS.md')} for the file format.\n`);

        console.log(`  ${chalk.white('3.')} When ready, let your AI agent run:\n`);
        console.log(`     ${chalk.green('sdd sync')}\n`);
      }

      // Prompt
      const prompt = options.bootstrap
        ? buildBootstrapPrompt(description.trim())
        : START_PROMPT;

      console.log(chalk.dim('  ─'.repeat(30)));
      console.log(chalk.cyan.bold('\n  Agent prompt:\n'));
      console.log(chalk.white(`  ${prompt.split('\n').join('\n  ')}\n`));

      try {
        await clipboardy.write(prompt);
        console.log(success('Copied to clipboard — paste it into your agent.\n'));
      } catch {
        console.log(info('Copy the prompt above into your agent.\n'));
      }
    });
}
