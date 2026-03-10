import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type ProjectInfo } from "./templates.js";
import { syncSkillAdapters } from "./skill-adapters.js";
import { writeConfig, sddDirPath } from "../config/config-manager.js";
import { isGitRepo, gitInit } from "../git/git.js";
import type { SDDConfig } from "../types.js";

export async function initProject(root: string, info?: ProjectInfo): Promise<string[]> {
  const createdFiles: string[] = [];
  const sddDir = sddDirPath(root);

  // Ensure git repo
  if (!isGitRepo(root)) {
    gitInit(root);
    createdFiles.push(".git");
  }

  // Create .sdd directory
  if (!existsSync(sddDir)) {
    await mkdir(sddDir, { recursive: true });
  }

  // Write config
  const config: SDDConfig = {
    description: info?.description ?? "",
  };
  await writeConfig(root, config);
  createdFiles.push(".sdd/config.yaml");

  // Create directory structure
  const dirs = ["product", "product/features", "system", "code", "change-requests", "bugs"];
  for (const dir of dirs) {
    const absDir = resolve(root, dir);
    if (!existsSync(absDir)) {
      await mkdir(absDir, { recursive: true });
    }
  }

  // Create canonical skill and agent adapters
  const adapters = await syncSkillAdapters(root);
  for (const change of [...adapters.canonical, ...adapters.adapters]) {
    if (change.action === "created") {
      createdFiles.push(change.path);
    }
  }

  return createdFiles;
}
