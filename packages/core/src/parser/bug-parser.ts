import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';
import type { Bug, BugFrontmatter, BugStatus } from '../types.js';
import { ParseError } from '../errors.js';

const VALID_BUG_STATUSES: Set<string> = new Set(['draft', 'open', 'resolved']);

export async function discoverBugFiles(root: string): Promise<string[]> {
  const pattern = 'bugs/*.md';
  const matches = await glob(pattern, { cwd: root, absolute: true });
  return matches.sort();
}

export function parseBugFile(filePath: string, content: string): { frontmatter: BugFrontmatter; body: string } {
  try {
    const { data, content: body } = matter(content);
    const frontmatter: BugFrontmatter = {
      title: data.title ?? '',
      status: (VALID_BUG_STATUSES.has(data.status) ? data.status : 'open') as BugStatus,
      author: data.author ?? '',
      'created-at': data['created-at'] ?? '',
    };
    return { frontmatter, body };
  } catch (err) {
    throw new ParseError(filePath, (err as Error).message);
  }
}

export async function parseAllBugFiles(root: string): Promise<Bug[]> {
  const paths = await discoverBugFiles(root);
  const results: Bug[] = [];

  for (const absPath of paths) {
    const content = await readFile(absPath, 'utf-8');
    const relPath = relative(root, absPath);
    const { frontmatter, body } = parseBugFile(relPath, content);
    results.push({ relativePath: relPath, frontmatter, body });
  }

  return results;
}
