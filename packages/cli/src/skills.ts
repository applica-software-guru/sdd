import { cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Returns the path to the bundled skills directory inside the CLI package.
 * Works both in development (monorepo) and when installed globally.
 */
export function getSkillsSourceDir(): string {
  // __filename → <cli-pkg>/dist/skills.js → go up two levels to <cli-pkg>/
  const cliPkgDir = resolve(dirname(__filename), '..');
  return join(cliPkgDir, 'skills');
}

/**
 * Copies all bundled skill files into <projectDir>/.claude/skills/.
 * Safe to call on existing projects — overwrites with the latest version.
 */
export function installSkills(projectDir: string): boolean {
  const src = getSkillsSourceDir();
  if (!existsSync(src)) return false;

  const dest = join(projectDir, '.claude', 'skills');
  cpSync(src, dest, { recursive: true, force: true });
  return true;
}
