import type { Bug, ChangeRequest, StoryFile } from '../types.js';
import { getFileDiff } from '../git/git.js';

export function generateApplyPrompt(
  bugs: Bug[],
  changeRequests: ChangeRequest[],
  pendingFiles: StoryFile[],
  root: string
): string | null {
  if (bugs.length === 0 && changeRequests.length === 0 && pendingFiles.length === 0) {
    return null;
  }

  const sections: string[] = [];

  // Bugs
  if (bugs.length > 0) {
    const lines = [`## Open bugs (${bugs.length})\n`];
    for (const bug of bugs) {
      lines.push(`### \`${bug.relativePath}\` — ${bug.frontmatter.title}\n`);
      lines.push(bug.body.trim());
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }

  // Change Requests
  if (changeRequests.length > 0) {
    const lines = [`## Pending change requests (${changeRequests.length})\n`];
    for (const cr of changeRequests) {
      lines.push(`### \`${cr.relativePath}\` — ${cr.frontmatter.title}\n`);
      lines.push(cr.body.trim());
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }

  // Pending files
  if (pendingFiles.length > 0) {
    const lines = [`## Pending files (${pendingFiles.length})\n`];
    for (const f of pendingFiles) {
      lines.push(`- \`${f.relativePath}\` — **${f.frontmatter.status}**`);
    }

    const changed = pendingFiles.filter((f) => f.frontmatter.status === 'changed');
    for (const f of changed) {
      const diff = getFileDiff(root, f.relativePath);
      if (diff) {
        lines.push('');
        lines.push(`### Diff: \`${f.relativePath}\`\n\n\`\`\`diff\n${diff}\n\`\`\``);
      }
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}
