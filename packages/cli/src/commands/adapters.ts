import { Command } from "commander";
import { SDD, SKILL_ADAPTERS } from "@applica-software-guru/sdd-core";
import { heading, info, success, warning } from "../ui/format.js";

function parseAgents(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function registerAdapters(program: Command): void {
  const adapters = program.command("adapters").description("Manage AI agent skill adapters");

  adapters
    .command("list")
    .description("List supported adapters with mode and target file paths")
    .action(() => {
      console.log(heading("Supported Adapters"));
      for (const adapter of SKILL_ADAPTERS) {
        console.log(info(`${adapter.id} (${adapter.mode})`));
        for (const path of adapter.paths) {
          console.log(`  - ${path}`);
        }
      }
      console.log("");
    });

  adapters
    .command("sync")
    .description("Create or update skill adapters for supported agents")
    .option("--agents <list>", "Comma-separated adapter ids (for example: claude,copilot,cursor)")
    .option("--all", "Configure all supported adapters")
    .option("--dry-run", "Show what would change without writing files")
    .option("--force", "Overwrite existing adapter files when content differs")
    .action(async (options: { agents?: string; all?: boolean; dryRun?: boolean; force?: boolean }) => {
      const sdd = new SDD({ root: process.cwd() });
      const supported = sdd.supportedAdapters();
      const selectedAgents = options.all || !options.agents ? undefined : parseAgents(options.agents);

      if (selectedAgents && selectedAgents.length === 0) {
        console.log(warning("No valid adapter id was provided."));
        console.log(info(`Supported adapters: ${supported.join(", ")}`));
        return;
      }

      const result = await sdd.syncAdapters({
        agents: selectedAgents,
        dryRun: options.dryRun,
        force: options.force,
      });

      const allChanges = [...result.canonical, ...result.adapters];
      const created = allChanges.filter((c) => c.action === "created");
      const updated = allChanges.filter((c) => c.action === "updated");
      const skipped = allChanges.filter((c) => c.action === "skipped");

      console.log(heading("Adapters Sync"));
      console.log(info(`Selected: ${result.selectedAgents.join(", ")}`));
      if (options.dryRun) {
        console.log(info("Dry run mode enabled. No files were written."));
      }
      console.log("");

      for (const change of created) {
        console.log(success(change.path));
      }
      for (const change of updated) {
        console.log(success(`${change.path} (updated)`));
      }
      for (const change of skipped) {
        const reason = change.reason ? ` — ${change.reason}` : "";
        console.log(warning(`${change.path}${reason}`));
      }

      console.log("");
      console.log(info(`Created: ${created.length}  Updated: ${updated.length}  Skipped: ${skipped.length}`));
      console.log(info(`Supported adapters: ${supported.join(", ")}`));
      console.log(info("Run `sdd adapters list` to inspect adapter modes and target paths."));
      console.log("");
    });
}
