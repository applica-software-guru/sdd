import chalk from 'chalk';
import { SDD } from '@applica-software-guru/sdd-core';

/**
 * Checks if the current git branch matches the configured SDD working branch.
 * Prints an error and calls process.exit(1) if the branch is wrong.
 * No-op if the project has no git repo or no branch configured.
 */
export async function requireCorrectBranch(root: string): Promise<void> {
  const sdd = new SDD({ root });
  let result: { ok: boolean; current: string | null; expected: string };
  try {
    result = await sdd.ensureBranch();
  } catch {
    // Not an SDD project or no git — skip check
    return;
  }

  if (!result.ok) {
    console.error(
      chalk.red(
        `\n  ✖ Wrong branch: you are on '${result.current ?? '(detached)'}', but this project works on '${result.expected}'.\n` +
        `    Run: ${chalk.cyan(`git checkout ${result.expected}`)}\n`
      )
    );
    process.exit(1);
  }
}
