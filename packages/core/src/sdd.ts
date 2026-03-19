import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { StoryStatus, ValidationResult, SDDConfig, ChangeRequest, Bug } from "./types.js";
import { ProjectNotInitializedError } from "./errors.js";
import { parseAllStoryFiles } from "./parser/story-parser.js";
import { generatePrompt } from "./prompt/prompt-generator.js";
import { generateApplyPrompt } from "./prompt/apply-prompt-generator.js";
import { generateDraftEnrichmentPrompt } from "./prompt/draft-prompt-generator.js";
import { validate } from "./validate/validator.js";
import { initProject } from "./scaffold/init.js";
import { isSDDProject, readConfig, writeConfig } from "./config/config-manager.js";
import { parseAllCRFiles } from "./parser/cr-parser.js";
import { parseAllBugFiles } from "./parser/bug-parser.js";
import type { ProjectInfo } from "./scaffold/templates.js";
import {
  listSupportedAdapters,
  syncSkillAdapters,
  type SyncAdaptersOptions,
  type SyncAdaptersResult,
} from "./scaffold/skill-adapters.js";
import {
  pushToRemote,
  pullFromRemote,
  pullCRsFromRemote,
  pullBugsFromRemote,
  getRemoteStatus,
  resetRemoteProject,
} from "./remote/sync-engine.js";
import type { PushResult, PullResult, PullEntitiesResult, RemoteStatusResult, RemoteResetResult } from "./remote/types.js";

export class SDD {
  private root: string;

  constructor(options: { root: string }) {
    this.root = options.root;
  }

  async init(info?: ProjectInfo): Promise<string[]> {
    return initProject(this.root, info);
  }

  async syncAdapters(options?: SyncAdaptersOptions): Promise<SyncAdaptersResult> {
    this.ensureInitialized();
    return syncSkillAdapters(this.root, options);
  }

  supportedAdapters(): string[] {
    return listSupportedAdapters();
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
        lastModified: f.frontmatter["last-modified"],
      })),
    };
  }

  async pending(): Promise<import("./types.js").StoryFile[]> {
    this.ensureInitialized();
    const files = await parseAllStoryFiles(this.root);
    return files.filter((f) => f.frontmatter.status !== "synced" && f.frontmatter.status !== "draft");
  }

  async sync(): Promise<string> {
    const pending = await this.pending();
    return generatePrompt(pending, this.root);
  }

  async applyPrompt(): Promise<string | null> {
    this.ensureInitialized();
    const [bugs, changeRequests, pendingFiles, drafts, allFiles, config] = await Promise.all([
      this.openBugs(),
      this.pendingChangeRequests(),
      this.pending(),
      this.drafts(),
      parseAllStoryFiles(this.root),
      readConfig(this.root),
    ]);
    const projectContext = allFiles.filter((f) => f.frontmatter.status !== "draft");
    return generateApplyPrompt(bugs, changeRequests, pendingFiles, this.root, drafts, projectContext, config.description);
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
      if (status === "synced") continue;
      if (paths && paths.length > 0 && !paths.includes(file.relativePath)) continue;

      const absPath = resolve(this.root, file.relativePath);

      if (status === "deleted") {
        // File marked for deletion — remove it
        const { unlink } = await import("node:fs/promises");
        await unlink(absPath);
        marked.push(`${file.relativePath} (removed)`);
      } else {
        // new or changed → synced
        const content = await readFile(absPath, "utf-8");
        const updated = content.replace(/^status:\s*(new|changed)/m, "status: synced");
        await writeFile(absPath, updated, "utf-8");
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
    return all.filter((cr) => cr.frontmatter.status === "pending");
  }

  async markCRApplied(paths?: string[]): Promise<string[]> {
    this.ensureInitialized();
    const all = await this.changeRequests();
    const marked: string[] = [];

    for (const cr of all) {
      if (cr.frontmatter.status !== "pending") continue;
      if (paths && paths.length > 0 && !paths.includes(cr.relativePath)) continue;

      const absPath = resolve(this.root, cr.relativePath);
      const content = await readFile(absPath, "utf-8");
      const updated = content.replace(/^status:\s*pending/m, "status: applied");
      await writeFile(absPath, updated, "utf-8");
      marked.push(cr.relativePath);
    }

    return marked;
  }

  async bugs(): Promise<Bug[]> {
    this.ensureInitialized();
    return parseAllBugFiles(this.root);
  }

  async openBugs(): Promise<Bug[]> {
    const all = await this.bugs();
    return all.filter((b) => b.frontmatter.status === "open");
  }

  async markBugResolved(paths?: string[]): Promise<string[]> {
    this.ensureInitialized();
    const all = await this.bugs();
    const marked: string[] = [];

    for (const bug of all) {
      if (bug.frontmatter.status === "resolved") continue;
      if (paths && paths.length > 0 && !paths.includes(bug.relativePath)) continue;

      const absPath = resolve(this.root, bug.relativePath);
      const content = await readFile(absPath, "utf-8");
      const updated = content.replace(/^status:\s*open/m, "status: resolved");
      await writeFile(absPath, updated, "utf-8");
      marked.push(bug.relativePath);
    }

    return marked;
  }

  // ── Drafts ───────────────────────────────────────────────────────────

  async drafts(): Promise<{ docs: import("./types.js").StoryFile[]; crs: ChangeRequest[]; bugs: Bug[] }> {
    this.ensureInitialized();
    const [files, crs, bugs] = await Promise.all([
      parseAllStoryFiles(this.root),
      this.changeRequests(),
      this.bugs(),
    ]);
    return {
      docs: files.filter((f) => f.frontmatter.status === "draft"),
      crs: crs.filter((cr) => cr.frontmatter.status === "draft"),
      bugs: bugs.filter((b) => b.frontmatter.status === "draft"),
    };
  }

  async draftEnrichmentPrompt(): Promise<string | null> {
    this.ensureInitialized();
    const drafts = await this.drafts();
    const allFiles = await parseAllStoryFiles(this.root);
    const projectContext = allFiles.filter((f) => f.frontmatter.status !== "draft");
    const config = await readConfig(this.root);
    return generateDraftEnrichmentPrompt(drafts, projectContext, config.description);
  }

  async markDraftsEnriched(paths?: string[]): Promise<string[]> {
    this.ensureInitialized();
    const marked: string[] = [];

    // Story files: draft → new
    const files = await parseAllStoryFiles(this.root);
    for (const file of files) {
      if (file.frontmatter.status !== "draft") continue;
      if (paths && paths.length > 0 && !paths.includes(file.relativePath)) continue;
      const absPath = resolve(this.root, file.relativePath);
      const content = await readFile(absPath, "utf-8");
      const updated = content.replace(/^status:\s*draft/m, "status: new");
      await writeFile(absPath, updated, "utf-8");
      marked.push(file.relativePath);
    }

    // CRs: draft → pending
    const crs = await this.changeRequests();
    for (const cr of crs) {
      if (cr.frontmatter.status !== "draft") continue;
      if (paths && paths.length > 0 && !paths.includes(cr.relativePath)) continue;
      const absPath = resolve(this.root, cr.relativePath);
      const content = await readFile(absPath, "utf-8");
      const updated = content.replace(/^status:\s*draft/m, "status: pending");
      await writeFile(absPath, updated, "utf-8");
      marked.push(cr.relativePath);
    }

    // Bugs: draft → open
    const allBugs = await this.bugs();
    for (const bug of allBugs) {
      if (bug.frontmatter.status !== "draft") continue;
      if (paths && paths.length > 0 && !paths.includes(bug.relativePath)) continue;
      const absPath = resolve(this.root, bug.relativePath);
      const content = await readFile(absPath, "utf-8");
      const updated = content.replace(/^status:\s*draft/m, "status: open");
      await writeFile(absPath, updated, "utf-8");
      marked.push(bug.relativePath);
    }

    return marked;
  }

  // ── Remote sync ──────────────────────────────────────────────────────

  async remoteStatus(timeout?: number): Promise<RemoteStatusResult> {
    this.ensureInitialized();
    return getRemoteStatus(this.root, timeout);
  }

  async push(paths?: string[], options?: { all?: boolean; timeout?: number }): Promise<PushResult> {
    this.ensureInitialized();
    return pushToRemote(this.root, { paths, all: options?.all, timeout: options?.timeout });
  }

  async pull(timeout?: number): Promise<PullResult> {
    this.ensureInitialized();
    return pullFromRemote(this.root, timeout);
  }

  async pullCRs(timeout?: number): Promise<PullEntitiesResult> {
    this.ensureInitialized();
    return pullCRsFromRemote(this.root, timeout);
  }

  async pullBugs(timeout?: number): Promise<PullEntitiesResult> {
    this.ensureInitialized();
    return pullBugsFromRemote(this.root, timeout);
  }

  async remoteReset(confirmSlug: string, timeout?: number): Promise<RemoteResetResult> {
    this.ensureInitialized();
    return resetRemoteProject(this.root, confirmSlug, timeout);
  }

  private ensureInitialized(): void {
    if (!isSDDProject(this.root)) {
      throw new ProjectNotInitializedError(this.root);
    }
  }
}
