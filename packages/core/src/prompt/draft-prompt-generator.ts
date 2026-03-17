import type { Bug, ChangeRequest, StoryFile } from '../types.js';

export interface DraftElements {
  docs: StoryFile[];
  crs: ChangeRequest[];
  bugs: Bug[];
}

export function generateDraftEnrichmentPrompt(
  drafts: DraftElements,
  projectContext: StoryFile[],
  projectDescription: string,
): string | null {
  const totalDrafts = drafts.docs.length + drafts.crs.length + drafts.bugs.length;
  if (totalDrafts === 0) {
    return null;
  }

  const sections: string[] = [];

  // Project context header
  sections.push(`# Draft Enrichment\n`);
  sections.push(`## Project\n\n${projectDescription}\n`);

  // Global context: all non-draft documents
  if (projectContext.length > 0) {
    const ctxLines = [`## Project context (${projectContext.length} documents)\n`];
    ctxLines.push('Use the following existing documents as context to produce complete, coherent documentation.\n');
    for (const f of projectContext) {
      ctxLines.push(`### \`${f.relativePath}\` — ${f.frontmatter.title}\n`);
      ctxLines.push(f.body.trim());
      ctxLines.push('');
    }
    sections.push(ctxLines.join('\n'));
  }

  // Draft documents
  if (drafts.docs.length > 0) {
    const lines = [`## Draft documents to enrich (${drafts.docs.length})\n`];
    lines.push('Each draft below contains incomplete human-written content. Produce a complete version for each document, preserving the original intent while adding missing details based on project context.\n');
    for (const f of drafts.docs) {
      lines.push(`### \`${f.relativePath}\` — ${f.frontmatter.title}\n`);
      lines.push(f.body.trim());
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }

  // Draft change requests
  if (drafts.crs.length > 0) {
    const lines = [`## Draft change requests to enrich (${drafts.crs.length})\n`];
    lines.push('Each draft CR contains a rough description of requested changes. Produce a complete, actionable change request for each, specifying which documents are affected and what changes should be made.\n');
    for (const cr of drafts.crs) {
      lines.push(`### \`${cr.relativePath}\` — ${cr.frontmatter.title}\n`);
      lines.push(cr.body.trim());
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }

  // Draft bugs
  if (drafts.bugs.length > 0) {
    const lines = [`## Draft bugs to enrich (${drafts.bugs.length})\n`];
    lines.push('Each draft bug contains a rough description of an issue. Produce a complete bug report for each, including affected components, expected vs actual behavior, and steps to reproduce when possible.\n');
    for (const bug of drafts.bugs) {
      lines.push(`### \`${bug.relativePath}\` — ${bug.frontmatter.title}\n`);
      lines.push(bug.body.trim());
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}
