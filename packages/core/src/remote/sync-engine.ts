import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';

import { readConfig } from '../config/config-manager.js';
import { parseAllStoryFiles } from '../parser/story-parser.js';
import { parseAllCRFiles } from '../parser/cr-parser.js';
import { parseAllBugFiles } from '../parser/bug-parser.js';
import { buildApiConfig, pullDocs, pushDocs, pushCRs, pushBugs, fetchPendingCRs, fetchOpenBugs, resetProject } from './api-client.js';
import { readRemoteState, writeRemoteState } from './state.js';
import type {
  PushResult,
  PullResult,
  PullConflict,
  PullEntitiesResult,
  RemoteStatusResult,
  RemoteResetResult,
  RemoteDocResponse,
} from './types.js';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** Normalize path separators to forward slash for remote consistency */
function normalizePath(p: string): string {
  return p.split('\\').join('/');
}

/**
 * Build a new markdown file with frontmatter — used ONLY for brand-new files
 * that don't exist locally yet.
 */
function buildStoryMarkdown(title: string, body: string, version: number, status: string = 'synced'): string {
  const fm = {
    title,
    status,
    author: 'remote',
    'last-modified': new Date().toISOString(),
    version: `${version}.0`,
  };
  return matter.stringify(body, fm);
}

/**
 * Build a new CR markdown — used ONLY for brand-new CRs that don't exist locally.
 */
function buildCRMarkdown(title: string, body: string, createdAt: string, status: string = 'draft'): string {
  const fm = {
    title,
    status,
    author: 'remote',
    'created-at': createdAt,
  };
  return matter.stringify(body, fm);
}

/**
 * Build a new bug markdown — used ONLY for brand-new bugs that don't exist locally.
 */
function buildBugMarkdown(title: string, body: string, createdAt: string, status: string = 'open'): string {
  const fm = {
    title,
    status,
    author: 'remote',
    'created-at': createdAt,
  };
  return matter.stringify(body, fm);
}

/**
 * Replace only the body (after frontmatter) in a raw markdown string,
 * preserving the exact original frontmatter formatting (quotes, order, etc.).
 */
function replaceBody(rawMarkdown: string, newBody: string): string {
  const firstFence = rawMarkdown.indexOf('---');
  if (firstFence === -1) return rawMarkdown;
  const secondFence = rawMarkdown.indexOf('---', firstFence + 3);
  if (secondFence === -1) return rawMarkdown;
  const endOfFrontmatter = rawMarkdown.indexOf('\n', secondFence);
  if (endOfFrontmatter === -1) return rawMarkdown;
  return rawMarkdown.substring(0, endOfFrontmatter + 1) + '\n' + newBody + '\n';
}

/**
 * Extract the body content from a raw markdown string (after frontmatter).
 */
function extractBody(rawMarkdown: string): string {
  const parsed = matter(rawMarkdown);
  return parsed.content.trim();
}

// ─── Push ────────────────────────────────────────────────────────────────

export interface PushOptions {
  paths?: string[];
  all?: boolean;
  timeout?: number;
}

export async function pushToRemote(root: string, options?: PushOptions): Promise<PushResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, options?.timeout);
  const state = await readRemoteState(root);
  if (!state.changeRequests) state.changeRequests = {};
  if (!state.bugs) state.bugs = {};

  let totalCreated = 0;
  let totalUpdated = 0;
  const allPushed: string[] = [];

  // ── Documents ──────────────────────────────────────────────────────────
  const files = await parseAllStoryFiles(root);
  const toPush = files.filter((f) => {
    if (options?.paths && options.paths.length > 0) return options.paths.includes(f.relativePath);
    if (options?.all) return true;
    return f.frontmatter.status !== 'synced';
  });

  if (toPush.length > 0) {
    const documents = toPush.map((f) => ({
      path: normalizePath(f.relativePath),
      title: f.frontmatter.title,
      content: f.body,
    }));

    const result = await pushDocs(api, documents);

    for (const doc of result.documents) {
      const localPath = doc.path;
      const absPath = resolve(root, localPath);
      const rawContent = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
      state.documents[localPath] = {
        remoteId: doc.id,
        remoteVersion: doc.version,
        localHash: sha256(rawContent),
        lastSynced: new Date().toISOString(),
      };
    }

    // Mark local files as synced (drafts are excluded — they need AI enrichment first)
    for (const f of toPush) {
      if (f.frontmatter.status === 'draft') continue;
      const absPath = resolve(root, f.relativePath);
      const content = await readFile(absPath, 'utf-8');
      const updated = content.replace(/^status:\s*(new|changed)/m, 'status: synced');
      if (updated !== content) {
        await writeFile(absPath, updated, 'utf-8');
      }
    }

    totalCreated += result.created;
    totalUpdated += result.updated;
    allPushed.push(...toPush.map((f) => f.relativePath));
  }

  // ── Change Requests ────────────────────────────────────────────────────
  const crFiles = await parseAllCRFiles(root);
  const crsToPush = crFiles.filter((cr) => {
    if (options?.paths && options.paths.length > 0) return options.paths.includes(cr.relativePath);
    if (options?.all) return true;
    return cr.frontmatter.status !== 'applied';
  });

  if (crsToPush.length > 0) {
    const crPayload = crsToPush.map((cr) => {
      const tracked = state.changeRequests![normalizePath(cr.relativePath)];
      return {
        path: normalizePath(cr.relativePath),
        title: cr.frontmatter.title,
        body: cr.body,
        status: cr.frontmatter.status,
        ...(tracked ? { id: tracked.remoteId } : {}),
      };
    });

    const crResult = await pushCRs(api, crPayload);

    for (const cr of crResult.change_requests) {
      const localPath = crsToPush.find(
        (f) => f.frontmatter.title === cr.title,
      )?.relativePath;
      if (localPath) {
        const absPath = resolve(root, localPath);
        const rawContent = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
        state.changeRequests![normalizePath(localPath)] = {
          remoteId: cr.id,
          localHash: sha256(rawContent),
          lastSynced: new Date().toISOString(),
        };
      }
    }

    totalCreated += crResult.created;
    totalUpdated += crResult.updated;
    allPushed.push(...crsToPush.map((cr) => cr.relativePath));
  }

  // ── Bugs ───────────────────────────────────────────────────────────────
  const bugFiles = await parseAllBugFiles(root);
  const bugsToPush = bugFiles.filter((bug) => {
    if (options?.paths && options.paths.length > 0) return options.paths.includes(bug.relativePath);
    if (options?.all) return true;
    return bug.frontmatter.status !== 'resolved';
  });

  if (bugsToPush.length > 0) {
    const bugPayload = bugsToPush.map((bug) => {
      const tracked = state.bugs![normalizePath(bug.relativePath)];
      return {
        path: normalizePath(bug.relativePath),
        title: bug.frontmatter.title,
        body: bug.body,
        status: bug.frontmatter.status,
        ...(tracked ? { id: tracked.remoteId } : {}),
      };
    });

    const bugResult = await pushBugs(api, bugPayload);

    for (const bug of bugResult.bugs) {
      const localPath = bugsToPush.find(
        (b) => b.frontmatter.title === bug.title,
      )?.relativePath;
      if (localPath) {
        const absPath = resolve(root, localPath);
        const rawContent = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
        state.bugs![normalizePath(localPath)] = {
          remoteId: bug.id,
          localHash: sha256(rawContent),
          lastSynced: new Date().toISOString(),
        };
      }
    }

    totalCreated += bugResult.created;
    totalUpdated += bugResult.updated;
    allPushed.push(...bugsToPush.map((bug) => bug.relativePath));
  }

  // ── Finalize ───────────────────────────────────────────────────────────
  state.lastPush = new Date().toISOString();
  await writeRemoteState(root, state);

  return {
    created: totalCreated,
    updated: totalUpdated,
    pushed: allPushed,
  };
}

// ─── Pull Documents ──────────────────────────────────────────────────────

export async function pullFromRemote(root: string, timeout?: number): Promise<PullResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, timeout);

  const remoteDocs = await pullDocs(api);
  const state = await readRemoteState(root);

  const created: string[] = [];
  const updated: string[] = [];
  const conflicts: PullConflict[] = [];

  for (const doc of remoteDocs) {
    const localPath = doc.path;
    const absPath = resolve(root, localPath);
    const tracked = state.documents[localPath];

    if (!existsSync(absPath)) {
      // Brand-new file — create locally
      const dir = dirname(absPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      const localStatus = doc.status === 'draft' ? 'draft' : 'synced';
      const markdown = buildStoryMarkdown(doc.title, doc.content, doc.version, localStatus);
      await writeFile(absPath, markdown, 'utf-8');
      created.push(localPath);
      updateDocState(state, doc, localPath, markdown);
    } else {
      // File exists locally — compare body content, not version numbers
      const localRaw = await readFile(absPath, 'utf-8');
      const localBody = extractBody(localRaw);
      const remoteBody = doc.content.trim();

      if (localBody === remoteBody) {
        // Body identical — don't touch the file, just update tracking state
        updateDocState(state, doc, localPath, localRaw);
        continue;
      }

      // Body differs — check for conflict
      const localHash = sha256(localRaw);
      if (tracked && localHash !== tracked.localHash) {
        // Both local and remote changed → conflict
        conflicts.push({
          path: localPath,
          localVersion: tracked.remoteVersion.toString(),
          remoteVersion: doc.version,
          reason: 'Both local and remote have changes since last sync',
        });
      } else {
        // Only remote body changed — surgically replace body, preserve frontmatter
        const newStatus = doc.status === 'draft' ? 'draft' : 'synced';
        let updatedContent = replaceBody(localRaw, doc.content);
        updatedContent = updatedContent.replace(/^status:\s*.+/m, `status: ${newStatus}`);
        await writeFile(absPath, updatedContent, 'utf-8');
        updated.push(localPath);
        updateDocState(state, doc, localPath, updatedContent);
      }
    }
  }

  state.lastPull = new Date().toISOString();
  await writeRemoteState(root, state);

  return { created, updated, conflicts };
}

function updateDocState(
  state: { documents: Record<string, { remoteId: string; remoteVersion: number; localHash: string; lastSynced: string }> },
  doc: RemoteDocResponse,
  localPath: string,
  markdownContent: string,
): void {
  state.documents[localPath] = {
    remoteId: doc.id,
    remoteVersion: doc.version,
    localHash: sha256(markdownContent),
    lastSynced: new Date().toISOString(),
  };
}

// ─── Pull CRs ────────────────────────────────────────────────────────────

export async function pullCRsFromRemote(root: string, timeout?: number): Promise<PullEntitiesResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, timeout);

  const remoteCRs = await fetchPendingCRs(api);
  const state = await readRemoteState(root);
  if (!state.changeRequests) state.changeRequests = {};

  // Build reverse map: remoteId → localPath
  const idToPath = new Map<string, string>();
  for (const [localPath, entry] of Object.entries(state.changeRequests)) {
    idToPath.set(entry.remoteId, localPath);
  }

  let created = 0;
  let updated = 0;

  for (const cr of remoteCRs) {
    const localPath = cr.path ?? idToPath.get(cr.id) ?? `change-requests/CR-${cr.id.substring(0, 8)}.md`;
    const absPath = resolve(root, localPath);
    const dir = dirname(absPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (existsSync(absPath)) {
      // File exists — compare body, only update if changed
      const localRaw = await readFile(absPath, 'utf-8');
      const localBody = extractBody(localRaw);
      const remoteBody = cr.body.trim();

      if (localBody === remoteBody) {
        // Identical — don't touch the file
        state.changeRequests![normalizePath(localPath)] = {
          remoteId: cr.id,
          localHash: sha256(localRaw),
          lastSynced: new Date().toISOString(),
        };
        continue;
      }

      // Body changed — update body, preserve frontmatter
      const newStatus = cr.status === 'draft' ? 'draft' : 'pending';
      let updatedContent = replaceBody(localRaw, cr.body);
      updatedContent = updatedContent.replace(/^status:\s*.+/m, `status: ${newStatus}`);
      await writeFile(absPath, updatedContent, 'utf-8');
      updated++;

      state.changeRequests![normalizePath(localPath)] = {
        remoteId: cr.id,
        localHash: sha256(updatedContent),
        lastSynced: new Date().toISOString(),
      };
    } else {
      // Brand-new CR — create file
      const crStatus = cr.status === 'draft' ? 'draft' : 'pending';
      const markdown = buildCRMarkdown(cr.title, cr.body, cr.created_at, crStatus);
      await writeFile(absPath, markdown, 'utf-8');
      created++;

      state.changeRequests![normalizePath(localPath)] = {
        remoteId: cr.id,
        localHash: sha256(markdown),
        lastSynced: new Date().toISOString(),
      };
    }
  }

  await writeRemoteState(root, state);
  return { created, updated };
}

// ─── Pull Bugs ───────────────────────────────────────────────────────────

export async function pullBugsFromRemote(root: string, timeout?: number): Promise<PullEntitiesResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, timeout);

  const remoteBugs = await fetchOpenBugs(api);
  const state = await readRemoteState(root);
  if (!state.bugs) state.bugs = {};

  // Build reverse map: remoteId → localPath
  const idToPath = new Map<string, string>();
  for (const [localPath, entry] of Object.entries(state.bugs)) {
    idToPath.set(entry.remoteId, localPath);
  }

  let created = 0;
  let updated = 0;

  for (const bug of remoteBugs) {
    const localPath = bug.path ?? idToPath.get(bug.id) ?? `bugs/BUG-${bug.id.substring(0, 8)}.md`;
    const absPath = resolve(root, localPath);
    const dir = dirname(absPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (existsSync(absPath)) {
      // File exists — compare body, only update if changed
      const localRaw = await readFile(absPath, 'utf-8');
      const localBody = extractBody(localRaw);
      const remoteBody = bug.body.trim();

      if (localBody === remoteBody) {
        // Identical — don't touch the file
        state.bugs![normalizePath(localPath)] = {
          remoteId: bug.id,
          localHash: sha256(localRaw),
          lastSynced: new Date().toISOString(),
        };
        continue;
      }

      // Body changed — update body, preserve frontmatter
      const newStatus = bug.status === 'draft' ? 'draft' : 'open';
      let updatedContent = replaceBody(localRaw, bug.body);
      updatedContent = updatedContent.replace(/^status:\s*.+/m, `status: ${newStatus}`);
      await writeFile(absPath, updatedContent, 'utf-8');
      updated++;

      state.bugs![normalizePath(localPath)] = {
        remoteId: bug.id,
        localHash: sha256(updatedContent),
        lastSynced: new Date().toISOString(),
      };
    } else {
      // Brand-new bug — create file
      const bugStatus = bug.status === 'draft' ? 'draft' : 'open';
      const markdown = buildBugMarkdown(bug.title, bug.body, bug.created_at, bugStatus);
      await writeFile(absPath, markdown, 'utf-8');
      created++;

      state.bugs![normalizePath(localPath)] = {
        remoteId: bug.id,
        localHash: sha256(markdown),
        lastSynced: new Date().toISOString(),
      };
    }
  }

  await writeRemoteState(root, state);
  return { created, updated };
}

// ─── Reset Remote ────────────────────────────────────────────────────────

export async function resetRemoteProject(root: string, confirmSlug: string, timeout?: number): Promise<RemoteResetResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, timeout);

  const result = await resetProject(api, confirmSlug);

  // Clear local remote state so stale mappings don't linger
  await writeRemoteState(root, { documents: {} });

  return result;
}

// ─── Remote Status ───────────────────────────────────────────────────────

export async function getRemoteStatus(root: string, timeout?: number): Promise<RemoteStatusResult> {
  const config = await readConfig(root);

  if (!config.remote?.url) {
    return { configured: false, url: null, connected: false, localPending: 0, remoteDocs: 0 };
  }

  const files = await parseAllStoryFiles(root);
  const localPending = files.filter((f) => f.frontmatter.status !== 'synced').length;

  try {
    const api = buildApiConfig(config, timeout);
    const docs = await pullDocs(api);
    return {
      configured: true,
      url: config.remote.url,
      connected: true,
      localPending,
      remoteDocs: docs.length,
    };
  } catch {
    return {
      configured: true,
      url: config.remote.url,
      connected: false,
      localPending,
      remoteDocs: 0,
    };
  }
}
