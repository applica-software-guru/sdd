import type { PendingItem } from '../types.js';

const CHECKBOX_RE = /^- \[([ xX])\] (.+)$/gm;

export function extractPendingItems(body: string): PendingItem[] {
  const section = extractSection(body, 'Pending Changes');
  if (!section) return [];

  const items: PendingItem[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(CHECKBOX_RE.source, CHECKBOX_RE.flags);
  while ((match = re.exec(section)) !== null) {
    items.push({
      checked: match[1] !== ' ',
      text: match[2].trim(),
    });
  }
  return items;
}

export function extractAgentNotes(body: string): string | null {
  const section = extractSection(body, 'Agent Notes');
  return section ? section.trim() : null;
}

function extractSection(body: string, heading: string): string | null {
  const headingRe = new RegExp(`^## ${escapeRegex(heading)}\\s*$`, 'm');
  const match = headingRe.exec(body);
  if (!match) return null;

  const start = match.index + match[0].length;
  const nextHeading = body.indexOf('\n## ', start);
  return nextHeading === -1 ? body.slice(start) : body.slice(start, nextHeading);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
