import { Command } from "commander";
import chalk from "chalk";
import { input, select } from "@inquirer/prompts";
import clipboardy from "clipboardy";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import ora from "ora";
import { SDD, writeConfig, runAgent } from "@applica-software-guru/sdd-core";
import { printBanner } from "../ui/banner.js";
import { success, info, heading } from "../ui/format.js";
import { renderMarkdown } from "../ui/markdown.js";

const START_PROMPT = `Read .sdd/skill/sdd/SKILL.md (fallback: .claude/skills/sdd/SKILL.md) and the documentation in product/ and system/, then run \`sdd sync\` to start working.`;

function buildBootstrapPrompt(description: string, auto: boolean): string {
  if (auto) {
    return `Read .sdd/skill/sdd/SKILL.md first (fallback: .claude/skills/sdd/SKILL.md). This is a new SDD project.

Project goal: "${description}"

Your task: generate the initial documentation for this project based on the description above. Do NOT ask questions — infer reasonable defaults and create all documentation files directly:

- product/vision.md — Product vision and goals
- product/users.md — User personas
- product/features/*.md — One file per main feature
- system/entities.md — Data models (use ### headings per entity)
- system/architecture.md — Architecture decisions
- system/tech-stack.md — Technologies and frameworks
- system/interfaces.md — API contracts

Follow the file format described in .sdd/skill/sdd/references/file-format.md for the YAML frontmatter. Do NOT write any code, only documentation. Commit all created files when done.`;
  }

  return `Read .sdd/skill/sdd/SKILL.md first (fallback: .claude/skills/sdd/SKILL.md). This is a new SDD project.

Project goal: "${description}"

Your task: generate the initial documentation for this project. Ask me a few questions first to understand the project better (target users, main features, technical preferences), then create all documentation files:

- product/vision.md — Product vision and goals
- product/users.md — User personas
- product/features/*.md — One file per main feature
- system/entities.md — Data models (use ### headings per entity)
- system/architecture.md — Architecture decisions
- system/tech-stack.md — Technologies and frameworks
- system/interfaces.md — API contracts

Follow the file format described in .sdd/skill/sdd/references/file-format.md for the YAML frontmatter. Do NOT write any code, only documentation.`;
}

export function registerInit(program: Command): void {
  program
    .command("init <project-name>")
    .description("Initialize a new SDD project")
    .action(async (projectName: string) => {
      printBanner();

      const projectDir = resolve(process.cwd(), projectName);

      if (existsSync(resolve(projectDir, ".sdd"))) {
        console.log(chalk.yellow(`\n  SDD project already initialized at ${projectName}/\n`));
        return;
      }

      const promptTheme = {
        prefix: chalk.cyan("?"),
        style: { message: (text: string) => chalk.cyan.bold(text) },
      };

      const description = await input({
        message: "What should your project do?",
        theme: promptTheme,
      });

      if (!description.trim()) {
        console.log(chalk.yellow("\n  No description provided. Aborting.\n"));
        return;
      }

      const agentChoice = await select({
        message: "Which agent do you use?",
        choices: [
          { value: "claude", name: "Claude Code" },
          { value: "codex", name: "Codex" },
          { value: "opencode", name: "OpenCode" },
          { value: "other", name: "Other" },
        ],
        theme: promptTheme,
      });

      let agentName = agentChoice;
      let customCommand: string | undefined;

      if (agentChoice === "other") {
        agentName = await input({
          message: "Agent name:",
          theme: promptTheme,
        });
        customCommand = await input({
          message: "Agent command (use $PROMPT_FILE for the prompt file path):",
          theme: promptTheme,
        });
      }

      const bootstrapMode = await select({
        message: "How do you want to start?",
        choices: [
          { value: "skip", name: "Write docs manually" },
          { value: "prompt", name: "Generate bootstrap prompt (copy to clipboard)" },
          { value: "auto", name: "Generate and apply bootstrap automatically" },
        ],
        theme: promptTheme,
      });

      if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true });
      }

      const spinner = ora({
        text: "Creating project structure...",
        color: "cyan",
      }).start();

      const sdd = new SDD({ root: projectDir });
      const files = await sdd.init({ description: description.trim() });

      // Save agent config
      const config = await sdd.config();
      config.agent = agentName;
      if (customCommand) {
        config.agents = { [agentName]: customCommand };
      }
      await writeConfig(projectDir, config);

      spinner.stop();

      // Project created
      console.log(chalk.cyan.bold(`\n  ${chalk.white(projectName)} is ready!\n`));

      // Show what was created
      console.log(chalk.dim("  Created:"));
      for (const f of files) {
        console.log(success(f));
      }
      console.log(success("product/"));
      console.log(success("product/features/"));
      console.log(success("system/"));
      console.log(success("code/"));

      if (bootstrapMode === "auto") {
        const prompt = buildBootstrapPrompt(description.trim(), true);

        console.log(chalk.dim("  ─".repeat(30)));
        console.log(heading("Agent Prompt"));
        console.log(renderMarkdown(prompt));
        console.log(chalk.dim("  ─".repeat(30)));

        console.log(info(`Using agent: ${chalk.cyan(agentName)}`));
        console.log(info("Starting agent...\n"));

        const exitCode = await runAgent({
          root: projectDir,
          prompt,
          agent: agentName,
          agents: customCommand ? { [agentName]: customCommand } : undefined,
        });

        if (exitCode !== 0) {
          console.log(chalk.red(`\n  Agent exited with code ${exitCode}`));
          process.exit(exitCode);
        }

        console.log(chalk.green("\n  Agent completed successfully."));
        return;
      }

      if (bootstrapMode === "prompt") {
        const prompt = buildBootstrapPrompt(description.trim(), false);

        console.log(chalk.cyan.bold("\n  Next steps:\n"));
        console.log(`  ${chalk.white("1.")} Enter the project folder:\n`);
        console.log(`     ${chalk.green(`cd ${projectName}`)}\n`);
        console.log(`  ${chalk.white("2.")} Open your AI agent and paste the prompt below.`);
        console.log(`     It will ask you a few questions and generate the initial docs.\n`);

        console.log(chalk.dim("  ─".repeat(30)));
        console.log(heading("Agent Prompt"));
        console.log(renderMarkdown(prompt));

        try {
          await clipboardy.write(prompt);
          console.log(success("Copied to clipboard — paste it into your agent.\n"));
        } catch {
          console.log(info("Copy the prompt above into your agent.\n"));
        }
        return;
      }

      // skip — manual mode
      console.log(chalk.cyan.bold("\n  Next steps:\n"));
      console.log(`  ${chalk.white("1.")} Enter the project folder:\n`);
      console.log(`     ${chalk.green(`cd ${projectName}`)}\n`);
      console.log(
        `  ${chalk.white("2.")} Start writing your documentation in ${chalk.cyan("product/")} and ${chalk.cyan("system/")}.`,
      );
      console.log(`     Check ${chalk.cyan(".sdd/skill/sdd/SKILL.md")} for the workflow.\n`);
      console.log(`  ${chalk.white("3.")} When ready, let your AI agent run:\n`);
      console.log(`     ${chalk.green("sdd sync")}\n`);

      const prompt = START_PROMPT;

      try {
        await clipboardy.write(prompt);
        console.log(success("Copied to clipboard — paste it into your agent.\n"));
      } catch {
        console.log(info("Copy the prompt above into your agent.\n"));
      }
    });
}
