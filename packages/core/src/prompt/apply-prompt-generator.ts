import type { Bug, ChangeRequest, StoryFile } from '../types.js';
import { getFileDiff } from '../git/git.js';
import type { DraftElements } from './draft-prompt-generator.js';

export function generateApplyPrompt(
  bugs: Bug[],
  changeRequests: ChangeRequest[],
  pendingFiles: StoryFile[],
  root: string,
  drafts?: DraftElements,
  projectContext?: StoryFile[],
  projectDescription?: string,
): string | null {
  const hasDrafts = drafts && (drafts.docs.length > 0 || drafts.crs.length > 0 || drafts.bugs.length > 0);
  if (bugs.length === 0 && changeRequests.length === 0 && pendingFiles.length === 0 && !hasDrafts) {
    return null;
  }

  const sections: string[] = [];

  // Draft enrichment section (takes priority)
  if (hasDrafts) {
    sections.push(`# Draft Enrichment\n`);

    if (projectDescription) {
      sections.push(`## Project\n\n${projectDescription}\n`);
    }

    // Global context for enrichment
    if (projectContext && projectContext.length > 0) {
      const ctxLines = [`## Project context (${projectContext.length} documents)\n`];
      ctxLines.push('Use the following existing documents as context to produce complete, coherent documentation.\n');
      for (const f of projectContext) {
        ctxLines.push(`### \`${f.relativePath}\` — ${f.frontmatter.title}\n`);
        ctxLines.push(f.body.trim());
        ctxLines.push('');
      }
      sections.push(ctxLines.join('\n'));
    }

    if (drafts!.docs.length > 0) {
      const lines = [`## Draft documents to enrich (${drafts!.docs.length})\n`];
      lines.push('Each draft below contains incomplete human-written content. Produce a complete version for each document, preserving the original intent while adding missing details based on project context.\n');
      for (const f of drafts!.docs) {
        lines.push(`### \`${f.relativePath}\` — ${f.frontmatter.title}\n`);
        lines.push(f.body.trim());
        lines.push('');
      }
      sections.push(lines.join('\n'));
    }

    if (drafts!.crs.length > 0) {
      const lines = [`## Draft change requests to enrich (${drafts!.crs.length})\n`];
      lines.push('Each draft CR contains a rough description of requested changes. Produce a complete, actionable change request for each.\n');
      for (const cr of drafts!.crs) {
        lines.push(`### \`${cr.relativePath}\` — ${cr.frontmatter.title}\n`);
        lines.push(cr.body.trim());
        lines.push('');
      }
      sections.push(lines.join('\n'));
    }

    if (drafts!.bugs.length > 0) {
      const lines = [`## Draft bugs to enrich (${drafts!.bugs.length})\n`];
      lines.push('Each draft bug contains a rough description of an issue. Produce a complete bug report for each.\n');
      for (const bug of drafts!.bugs) {
        lines.push(`### \`${bug.relativePath}\` — ${bug.frontmatter.title}\n`);
        lines.push(bug.body.trim());
        lines.push('');
      }
      sections.push(lines.join('\n'));
    }
  }

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
