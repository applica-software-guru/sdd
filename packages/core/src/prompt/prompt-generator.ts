import type { StoryFile } from '../types.js';
import { getFileDiff } from '../git/git.js';

export function generatePrompt(files: StoryFile[], root?: string): string {
  const sections: string[] = [];

  sections.push(
    '# SDD Sync Prompt\n\nThis project uses Story Driven Development. Implement the changes described below.'
  );

  if (files.length === 0) {
    sections.push('Nothing to do — all files are synced.');
    return sections.join('\n\n');
  }

  const lines = [`## Files to process (${files.length})\n`];
  for (const f of files) {
    lines.push(`- \`${f.relativePath}\` — **${f.frontmatter.status}**`);
  }
  lines.push('');
  lines.push('Read each file listed above before implementing.');
  sections.push(lines.join('\n'));

  // Show git diff for changed files so the agent knows what was modified
  if (root) {
    const changed = files.filter((f) => f.frontmatter.status === 'changed');
    for (const f of changed) {
      const diff = getFileDiff(root, f.relativePath);
      if (diff) {
        sections.push(`## Changes in \`${f.relativePath}\`\n\n\`\`\`diff\n${diff}\n\`\`\``);
      }
    }
  }

  const deleted = files.filter((f) => f.frontmatter.status === 'deleted');
  if (deleted.length > 0) {
    const delLines = ['## Files to remove\n'];
    for (const f of deleted) {
      delLines.push(`- \`${f.relativePath}\` — remove all related code in \`code/\``);
    }
    sections.push(delLines.join('\n'));
  }

  sections.push(
    `## Instructions\n\n1. Read each file listed above\n2. For **new** files: implement what the documentation describes\n3. For **changed** files: update the code to match the updated documentation (see diff above)\n4. For **deleted** files: remove the related code from \`code/\`\n5. If a file has a \`## Agent Notes\` section, respect those constraints\n6. All code goes inside \`code/\`\n7. After implementing each file, run \`sdd mark-synced <file>\`\n8. **Immediately after mark-synced, commit**: \`git add -A && git commit -m "sdd sync: <description>"\`\n9. When done with all files, list every file you created or modified`
  );

  return sections.join('\n\n');
}
