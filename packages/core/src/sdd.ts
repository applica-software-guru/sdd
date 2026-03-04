import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { StoryStatus, ValidationResult, SDDConfig, ChangeRequest } from './types.js';
import { ProjectNotInitializedError } from './errors.js';
import { parseAllStoryFiles } from './parser/story-parser.js';
import { generatePrompt } from './prompt/prompt-generator.js';
import { validate } from './validate/validator.js';
import { initProject } from './scaffold/init.js';
import { isSDDProject, readConfig, writeConfig } from './config/config-manager.js';
import { parseAllCRFiles } from './parser/cr-parser.js';
import type { ProjectInfo } from './scaffold/templates.js';

export class SDD {
  private root: string;

  constructor(options: { root: string }) {
    this.root = options.root;
  }

  async init(info?: ProjectInfo): Promise<string[]> {
    return initProject(this.root, info);
  }

  async config(): Promise<SDDConfig> {
    this.ensureInitialized();
    return readConfig(this.root);
  }

  async status(): Promise<StoryStatus> {
    this.ensureInitialized();
    const files = await parseAllStoryFiles(this.root);

    return {
      files: files.map((f) => ({
        relativePath: f.relativePath,
        status: f.frontmatter.status,
        version: f.frontmatter.version,
        lastModified: f.frontmatter['last-modified'],
      })),
    };
  }

  async pending(): Promise<import('./types.js').StoryFile[]> {
    this.ensureInitialized();
    const files = await parseAllStoryFiles(this.root);
    return files.filter((f) => f.frontmatter.status !== 'synced');
  }

  async sync(): Promise<string> {
    const pending = await this.pending();
    return generatePrompt(pending, this.root);
  }

  async validate(): Promise<ValidationResult> {
    this.ensureInitialized();
    const files = await parseAllStoryFiles(this.root);
    return validate(files);
  }

  async markSynced(paths?: string[]): Promise<string[]> {
    this.ensureInitialized();
    const files = await parseAllStoryFiles(this.root);
    const marked: string[] = [];

    for (const file of files) {
      const { status } = file.frontmatter;
      if (status === 'synced') continue;
      if (paths && paths.length > 0 && !paths.includes(file.relativePath)) continue;

      const absPath = resolve(this.root, file.relativePath);

      if (status === 'deleted') {
        // File marked for deletion — remove it
        const { unlink } = await import('node:fs/promises');
        await unlink(absPath);
        marked.push(`${file.relativePath} (removed)`);
      } else {
        // new or changed → synced
        const content = await readFile(absPath, 'utf-8');
        const updated = content.replace(/^status:\s*(new|changed)/m, 'status: synced');
        await writeFile(absPath, updated, 'utf-8');
        marked.push(file.relativePath);
      }
    }

    return marked;
  }

  async changeRequests(): Promise<ChangeRequest[]> {
    this.ensureInitialized();
    return parseAllCRFiles(this.root);
  }

  async pendingChangeRequests(): Promise<ChangeRequest[]> {
    const all = await this.changeRequests();
    return all.filter((cr) => cr.frontmatter.status === 'draft');
  }

  async markCRApplied(paths?: string[]): Promise<string[]> {
    this.ensureInitialized();
    const all = await this.changeRequests();
    const marked: string[] = [];

    for (const cr of all) {
      if (cr.frontmatter.status === 'applied') continue;
      if (paths && paths.length > 0 && !paths.includes(cr.relativePath)) continue;

      const absPath = resolve(this.root, cr.relativePath);
      const content = await readFile(absPath, 'utf-8');
      const updated = content.replace(/^status:\s*draft/m, 'status: applied');
      await writeFile(absPath, updated, 'utf-8');
      marked.push(cr.relativePath);
    }

    return marked;
  }

  private ensureInitialized(): void {
    if (!isSDDProject(this.root)) {
      throw new ProjectNotInitializedError(this.root);
    }
  }
}
