import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

export function isGitRepo(root: string): boolean {
  return existsSync(resolve(root, '.git'));
}

export function gitInit(root: string): void {
  run('git init', root);
}

export function gitAddAndCommit(root: string, files: string[], message: string): void {
  try {
    for (const f of files) {
      run(`git add -- ${f}`, root);
    }
    run(`git commit -m "${message}"`, root);
  } catch {
    // ignore — no changes to commit or no git user configured
  }
}

export function getCurrentCommit(root: string): string | null {
  try {
    return run('git rev-parse HEAD', root) || null;
  } catch {
    return null;
  }
}

export function getGitDiff(root: string, fromCommit: string | null): string {
  const paths = '-- product/ system/';
  try {
    if (!fromCommit) {
      // No previous sync — show all tracked + untracked files as new
      const tracked = run(`git diff HEAD ${paths}`, root);
      const untracked = run('git ls-files --others --exclude-standard product/ system/', root);
      const parts: string[] = [];
      if (tracked) parts.push(tracked);
      if (untracked) {
        for (const file of untracked.split('\n').filter(Boolean)) {
          parts.push(`new file: ${file}`);
        }
      }
      return parts.join('\n') || '';
    }
    return run(`git diff ${fromCommit} HEAD ${paths}`, root);
  } catch {
    return '';
  }
}

export function getFileDiff(root: string, filePath: string): string {
  try {
    // Show diff of file vs last committed version
    const diff = run(`git diff HEAD -- ${filePath}`, root);
    if (diff) return diff;
    // If no unstaged changes, try diff vs previous commit
    return run(`git diff HEAD~1 HEAD -- ${filePath}`, root);
  } catch {
    return '';
  }
}

export function getGitModifiedFiles(root: string): Set<string> {
  const modified = new Set<string>();
  try {
    // Unstaged changes
    const unstaged = run('git diff --name-only -- product/ system/', root);
    for (const f of unstaged.split('\n').filter(Boolean)) modified.add(f);
    // Staged changes
    const staged = run('git diff --cached --name-only -- product/ system/', root);
    for (const f of staged.split('\n').filter(Boolean)) modified.add(f);
    // Untracked files
    const untracked = run('git ls-files --others --exclude-standard product/ system/', root);
    for (const f of untracked.split('\n').filter(Boolean)) modified.add(f);
  } catch {
    // not a git repo or no commits — ignore
  }
  return modified;
}

export function getCurrentBranch(root: string): string | null {
  try {
    return run('git rev-parse --abbrev-ref HEAD', root) || null;
  } catch {
    return null;
  }
}

export function checkoutBranch(root: string, branch: string): void {
  try {
    run(`git checkout ${branch}`, root);
  } catch {
    // branch doesn't exist — create it
    run(`git checkout -b ${branch}`, root);
  }
}

export function getJobChangedFiles(
  root: string,
  fromCommit: string | null,
): Array<{ path: string; status: 'new' | 'modified' | 'deleted' }> {
  const result = new Map<string, 'new' | 'modified' | 'deleted'>();

  try {
    // Committed changes since the base commit
    if (fromCommit) {
      const committed = run(`git diff --name-status ${fromCommit} HEAD`, root);
      for (const line of committed.split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        const flag = parts[0][0]; // first char (A/M/D/R/C)
        // Renames have two paths: old\tnew — use the new path
        const path = parts.length >= 3 ? parts[2] : parts[1];
        const fileStatus: 'new' | 'modified' | 'deleted' =
          flag === 'A' ? 'new' : flag === 'D' ? 'deleted' : 'modified';
        result.set(path, fileStatus);
      }
    }

    // Uncommitted working tree changes (staged + unstaged + untracked)
    const porcelain = run('git status --porcelain', root);
    for (const line of porcelain.split('\n').filter(Boolean)) {
      const xy = line.substring(0, 2);
      const rawPath = line.substring(3).trim();
      // Renamed files show as "old -> new" in porcelain v1
      const path = rawPath.includes(' -> ') ? rawPath.split(' -> ')[1] : rawPath;

      if (xy[0] === 'D' || xy[1] === 'D') {
        result.set(path, 'deleted');
      } else if (xy === '??' || xy[0] === 'A' || xy[1] === 'A') {
        if (!result.has(path)) result.set(path, 'new');
      } else {
        if (!result.has(path)) result.set(path, 'modified');
      }
    }
  } catch {
    // not a git repo or no commits — return empty
  }

  return Array.from(result.entries()).map(([path, status]) => ({ path, status }));
}

export function getChangedFiles(root: string, fromCommit: string | null): Array<{ path: string; status: 'new' | 'modified' | 'deleted' }> {
  try {
    if (!fromCommit) {
      // All files in product/ and system/ are "new"
      const files = run('git ls-files product/ system/', root);
      const untracked = run('git ls-files --others --exclude-standard product/ system/', root);
      const all = [...files.split('\n'), ...untracked.split('\n')].filter(Boolean);
      const unique = [...new Set(all)];
      return unique.map((p) => ({ path: p, status: 'new' as const }));
    }

    const output = run(`git diff --name-status ${fromCommit} HEAD -- product/ system/`, root);
    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line) => {
      const [flag, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');
      const status = flag === 'A' ? 'new' as const
        : flag === 'D' ? 'deleted' as const
        : 'modified' as const;
      return { path, status };
    });
  } catch {
    return [];
  }
}
