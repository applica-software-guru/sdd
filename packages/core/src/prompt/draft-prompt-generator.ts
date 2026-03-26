import type { Bug, ChangeRequest, StoryFile } from '../types.js';

export interface DraftElements {
  docs: StoryFile[];
  crs: ChangeRequest[];
  bugs: Bug[];
}

export function generateDraftEnrichmentPrompt(
  drafts: DraftElements,
): string | null {
  const totalDrafts = drafts.docs.length + drafts.crs.length + drafts.bugs.length;
  if (totalDrafts === 0) {
    return null;
  }

  const sections: string[] = [
    '# Draft Tasks',
    '',
    'Enrich all draft elements listed below.',
    'Read each file directly from disk, complete missing details, and save it keeping `status: draft`.',
    'Do not mark statuses automatically in this step.',
    '',
  ];

  if (drafts.docs.length > 0) {
    const lines = [`## Draft documents (${drafts.docs.length})`];
    for (const f of drafts.docs) {
      lines.push(`- \`${f.relativePath}\` — ${f.frontmatter.title}`);
    }
    sections.push(lines.join('\n'));
    sections.push('');
  }

  if (drafts.crs.length > 0) {
    const lines = [`## Draft change requests (${drafts.crs.length})`];
    for (const cr of drafts.crs) {
      lines.push(`- \`${cr.relativePath}\` — ${cr.frontmatter.title}`);
    }
    sections.push(lines.join('\n'));
    sections.push('');
  }

  if (drafts.bugs.length > 0) {
    const lines = [`## Draft bugs (${drafts.bugs.length})`];
    for (const bug of drafts.bugs) {
      lines.push(`- \`${bug.relativePath}\` — ${bug.frontmatter.title}`);
    }
    sections.push(lines.join('\n'));
    sections.push('');
  }

  sections.push(
    '## Report\n',
    'At the end of the enrichment, provide a detailed report including:\n' +
    '- List of enriched files (documents, CRs, bugs)\n' +
    '- For each file: what was added or completed\n' +
    '- Any ambiguities resolved or assumptions made'
  );

  return sections.join('\n');
}
