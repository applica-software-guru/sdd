import type { StoryFile } from '../types.js';
import { getFileDiff } from '../git/git.js';

export function generatePrompt(files: StoryFile[], root?: string): string {
  if (files.length === 0) {
    return 'Nothing to do — all files are synced.';
  }

  const sections: string[] = [];

  const lines = [`## Pending files (${files.length})\n`];
  for (const f of files) {
    lines.push(`- \`${f.relativePath}\` — **${f.frontmatter.status}**`);
  }
  sections.push(lines.join('\n'));

  // Git diff for changed files
  if (root) {
    const changed = files.filter((f) => f.frontmatter.status === 'changed');
    for (const f of changed) {
      const diff = getFileDiff(root, f.relativePath);
      if (diff) {
        sections.push(`## Diff: \`${f.relativePath}\`\n\n\`\`\`diff\n${diff}\n\`\`\``);
      }
    }
  }

  // Deleted files
  const deleted = files.filter((f) => f.frontmatter.status === 'deleted');
  if (deleted.length > 0) {
    const delLines = ['## Files to remove\n'];
    for (const f of deleted) {
      delLines.push(`- \`${f.relativePath}\``);
    }
    sections.push(delLines.join('\n'));
  }

  return sections.join('\n\n');
}
