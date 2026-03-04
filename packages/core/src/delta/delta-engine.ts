import type { Delta, DeltaFile } from '../types.js';
import { getChangedFiles, getGitDiff } from '../git/git.js';

export function computeDelta(root: string, lastSyncCommit: string | null): Delta {
  const changed = getChangedFiles(root, lastSyncCommit);
  const diff = getGitDiff(root, lastSyncCommit);

  const files: DeltaFile[] = changed.map((f) => ({
    relativePath: f.path,
    status: f.status,
  }));

  return {
    hasChanges: files.length > 0,
    files,
    diff,
  };
}
