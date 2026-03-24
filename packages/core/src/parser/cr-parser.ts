import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';
import type { ChangeRequest, ChangeRequestFrontmatter, ChangeRequestStatus } from '../types.js';
import { ParseError } from '../errors.js';

const VALID_CR_STATUSES: Set<string> = new Set(['draft', 'pending', 'applied']);

export async function discoverCRFiles(root: string): Promise<string[]> {
  const pattern = 'change-requests/*.md';
  const matches = await glob(pattern, { cwd: root, absolute: true });
  return matches.sort();
}

export function parseCRFile(filePath: string, content: string): { frontmatter: ChangeRequestFrontmatter; body: string } {
  try {
    const { data, content: body } = matter(content);
    const frontmatter: ChangeRequestFrontmatter = {
      title: data.title ?? '',
      status: (VALID_CR_STATUSES.has(data.status) ? data.status : 'draft') as ChangeRequestStatus,
      author: data.author ?? '',
      'created-at': data['created-at'] ?? '',
    };
    return { frontmatter, body };
  } catch (err) {
    throw new ParseError(filePath, (err as Error).message);
  }
}

export async function parseAllCRFiles(root: string): Promise<ChangeRequest[]> {
  const paths = await discoverCRFiles(root);
  const results: ChangeRequest[] = [];

  for (const absPath of paths) {
    const content = await readFile(absPath, 'utf-8');
    const relPath = relative(root, absPath);
    const { frontmatter, body } = parseCRFile(relPath, content);
    results.push({ relativePath: relPath, frontmatter, body });
  }

  return results;
}
