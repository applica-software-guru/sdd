import matter from 'gray-matter';
import type { StoryFrontmatter } from '../types.js';
import { ParseError } from '../errors.js';

export interface ParsedFile {
  frontmatter: StoryFrontmatter;
  body: string;
}

export function parseFrontmatter(filePath: string, content: string): ParsedFile {
  try {
    const { data, content: body } = matter(content);
    const frontmatter: StoryFrontmatter = {
      title: data.title ?? '',
      status: data.status ?? 'draft',
      author: data.author ?? '',
      'last-modified': data['last-modified'] ?? '',
      version: data.version ?? '1.0',
    };
    return { frontmatter, body };
  } catch (err) {
    throw new ParseError(filePath, (err as Error).message);
  }
}
