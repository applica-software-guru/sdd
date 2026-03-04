import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { glob } from 'glob';
import { createHash } from 'node:crypto';
import type { StoryFile } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';
import { extractPendingItems, extractAgentNotes } from './section-extractor.js';
import { extractCrossRefs } from './ref-extractor.js';

export async function discoverStoryFiles(root: string): Promise<string[]> {
  const patterns = ['product/**/*.md', 'system/**/*.md'];
  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: root, absolute: true });
    files.push(...matches);
  }
  return files.sort();
}

export async function parseStoryFile(root: string, absolutePath: string): Promise<StoryFile> {
  const content = await readFile(absolutePath, 'utf-8');
  const relPath = relative(root, absolutePath);
  const { frontmatter, body } = parseFrontmatter(relPath, content);
  const hash = createHash('sha256').update(content).digest('hex');

  return {
    relativePath: relPath,
    frontmatter,
    body,
    pendingItems: extractPendingItems(body),
    agentNotes: extractAgentNotes(body),
    crossRefs: extractCrossRefs(body),
    hash,
  };
}

export async function parseAllStoryFiles(root: string): Promise<StoryFile[]> {
  const paths = await discoverStoryFiles(root);
  return Promise.all(paths.map((p) => parseStoryFile(root, p)));
}
