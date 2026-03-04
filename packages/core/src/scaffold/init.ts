import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AGENT_MD_TEMPLATE, type ProjectInfo } from './templates.js';
import { writeConfig, sddDirPath } from '../config/config-manager.js';
import { isGitRepo, gitInit } from '../git/git.js';
import type { SDDConfig } from '../types.js';

export async function initProject(root: string, info?: ProjectInfo): Promise<string[]> {
  const createdFiles: string[] = [];
  const sddDir = sddDirPath(root);

  // Ensure git repo
  if (!isGitRepo(root)) {
    gitInit(root);
    createdFiles.push('.git');
  }

  // Create .sdd directory
  if (!existsSync(sddDir)) {
    await mkdir(sddDir, { recursive: true });
  }

  // Write config
  const config: SDDConfig = {
    description: info?.description ?? '',
  };
  await writeConfig(root, config);
  createdFiles.push('.sdd/config.yaml');

  // Create directory structure
  const dirs = ['product', 'product/features', 'system', 'code', 'change-requests'];
  for (const dir of dirs) {
    const absDir = resolve(root, dir);
    if (!existsSync(absDir)) {
      await mkdir(absDir, { recursive: true });
    }
  }

  // Create agent instructions
  const instructionsPath = resolve(root, 'INSTRUCTIONS.md');
  if (!existsSync(instructionsPath)) {
    await writeFile(instructionsPath, AGENT_MD_TEMPLATE, 'utf-8');
    createdFiles.push('INSTRUCTIONS.md');
  }

  // Create agent instruction pointers
  const POINTER = 'Read INSTRUCTIONS.md in the project root for all instructions.\n';
  const agentFiles: Array<{ path: string; dir?: string }> = [
    { path: '.claude/CLAUDE.md', dir: '.claude' },
    { path: '.github/copilot-instructions.md', dir: '.github' },
    { path: '.cursorrules' },
  ];

  for (const entry of agentFiles) {
    const absPath = resolve(root, entry.path);
    if (existsSync(absPath)) continue;

    if (entry.dir) {
      const absDir = resolve(root, entry.dir);
      if (!existsSync(absDir)) {
        await mkdir(absDir, { recursive: true });
      }
    }

    await writeFile(absPath, POINTER, 'utf-8');
    createdFiles.push(entry.path);
  }

  return createdFiles;
}
