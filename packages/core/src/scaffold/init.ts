import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SKILL_MD_TEMPLATE,
  FILE_FORMAT_REFERENCE,
  CHANGE_REQUESTS_REFERENCE,
  BUGS_REFERENCE,
  type ProjectInfo,
} from './templates.js';
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
  const dirs = ['product', 'product/features', 'system', 'code', 'change-requests', 'bugs'];
  for (const dir of dirs) {
    const absDir = resolve(root, dir);
    if (!existsSync(absDir)) {
      await mkdir(absDir, { recursive: true });
    }
  }

  // Create agent skill
  const skillDir = resolve(root, '.claude/skills/sdd');
  const refsDir = resolve(skillDir, 'references');

  if (!existsSync(refsDir)) {
    await mkdir(refsDir, { recursive: true });
  }

  const skillFiles: Array<{ path: string; content: string }> = [
    { path: '.claude/skills/sdd/SKILL.md', content: SKILL_MD_TEMPLATE },
    { path: '.claude/skills/sdd/references/file-format.md', content: FILE_FORMAT_REFERENCE },
    { path: '.claude/skills/sdd/references/change-requests.md', content: CHANGE_REQUESTS_REFERENCE },
    { path: '.claude/skills/sdd/references/bugs.md', content: BUGS_REFERENCE },
  ];

  for (const entry of skillFiles) {
    const absPath = resolve(root, entry.path);
    if (!existsSync(absPath)) {
      await writeFile(absPath, entry.content, 'utf-8');
      createdFiles.push(entry.path);
    }
  }

  return createdFiles;
}
