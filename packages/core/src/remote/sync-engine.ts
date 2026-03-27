import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';

import { readConfig } from '../config/config-manager.js';
import { parseAllStoryFiles } from '../parser/story-parser.js';
import { parseAllCRFiles } from '../parser/cr-parser.js';
import { parseAllBugFiles } from '../parser/bug-parser.js';
import { buildApiConfig, pullDocs, pushDocs, pushCRs, pushBugs, deleteDocs, deleteCRs, deleteBugs, pullPendingCRs, pullOpenBugs, resetProject } from './api-client.js';
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

function isReseedPush(state: RemoteStatusTrackingState, options?: PushOptions): boolean {
  return state.needsReseed === true && !(options?.paths && options.paths.length > 0);
}

type RemoteStatusTrackingState = {
  needsReseed?: boolean;
  documents: Record<string, { remoteId: string; remoteVersion: number; localHash: string; lastSynced: string }>;
  changeRequests?: Record<string, { remoteId: string; localHash: string; lastSynced: string }>;
  bugs?: Record<string, { remoteId: string; localHash: string; lastSynced: string }>;
};

export async function pushToRemote(root: string, options?: PushOptions): Promise<PushResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, options?.timeout);
  const state = await readRemoteState(root);
  if (!state.changeRequests) state.changeRequests = {};
  if (!state.bugs) state.bugs = {};
  const reseedPush = isReseedPush(state, options);

  let totalCreated = 0;
  let totalUpdated = 0;
  const allPushed: string[] = [];

  // ── Documents ──────────────────────────────────────────────────────────
  const files = await parseAllStoryFiles(root);
  const toPush = files.filter((f) => {
    if (options?.paths && options.paths.length > 0) return options.paths.includes(f.relativePath);
    if (reseedPush) return true;
    if (options?.all) return true;
    const tracked = state.documents[normalizePath(f.relativePath)];
    if (!tracked) return true;
    return tracked.localHash !== f.hash;
  });

  if (toPush.length > 0) {
    const documents = toPush.map((f) => ({
      path: normalizePath(f.relativePath),
      title: f.frontmatter.title,
      content: f.body,
      status: f.frontmatter.status,
    }));

    const result = await pushDocs(api, documents);

    for (const doc of result.documents) {
      const localPath = normalizePath(doc.path);
      const absPath = resolve(root, localPath);
      const rawContent = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
      state.documents[localPath] = {
        remoteId: doc.id,
        remoteVersion: doc.version,
        localHash: sha256(rawContent),
        lastSynced: new Date().toISOString(),
      };
    }

    totalCreated += result.created;
    totalUpdated += result.updated;
    allPushed.push(...toPush.map((f) => f.relativePath));
  }

  // ── Change Requests ────────────────────────────────────────────────────
  const crFiles = await parseAllCRFiles(root);
  const crHashes = new Map<string, string>();
  for (const cr of crFiles) {
    const absPath = resolve(root, cr.relativePath);
    const raw = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
    crHashes.set(normalizePath(cr.relativePath), sha256(raw));
  }
  const crsToPush = crFiles.filter((cr) => {
    if (options?.paths && options.paths.length > 0) return options.paths.includes(cr.relativePath);
    if (reseedPush) return true;
    if (options?.all) return true;
    const key = normalizePath(cr.relativePath);
    const tracked = state.changeRequests![key];
    const localHash = crHashes.get(key);
    if (!tracked || !localHash) return true;
    return tracked.localHash !== localHash;
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
      const localPath = cr.path
        ?? crsToPush.find((f) => f.frontmatter.title === cr.title)?.relativePath;
      if (localPath) {
        const normalized = normalizePath(localPath);
        const absPath = resolve(root, normalized);
        const rawContent = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
        state.changeRequests![normalized] = {
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
  const bugHashes = new Map<string, string>();
  for (const bug of bugFiles) {
    const absPath = resolve(root, bug.relativePath);
    const raw = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
    bugHashes.set(normalizePath(bug.relativePath), sha256(raw));
  }
  const bugsToPush = bugFiles.filter((bug) => {
    if (options?.paths && options.paths.length > 0) return options.paths.includes(bug.relativePath);
    if (reseedPush) return true;
    if (options?.all) return true;
    const key = normalizePath(bug.relativePath);
    const tracked = state.bugs![key];
    const localHash = bugHashes.get(key);
    if (!tracked || !localHash) return true;
    return tracked.localHash !== localHash;
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
      const localPath = bug.path
        ?? bugsToPush.find((b) => b.frontmatter.title === bug.title)?.relativePath;
      if (localPath) {
        const normalized = normalizePath(localPath);
        const absPath = resolve(root, normalized);
        const rawContent = existsSync(absPath) ? await readFile(absPath, 'utf-8') : '';
        state.bugs![normalized] = {
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

  // ── Detect local deletions (tracked in state but missing from disk) ──
  const allDeleted: string[] = [];

  const deletedDocPaths = Object.keys(state.documents).filter(
    (p) => !existsSync(resolve(root, p)),
  );
  if (deletedDocPaths.length > 0) {
    await deleteDocs(api, deletedDocPaths);
    for (const p of deletedDocPaths) {
      delete state.documents[p];
    }
    allDeleted.push(...deletedDocPaths);
  }

  const deletedCRPaths = Object.keys(state.changeRequests!).filter(
    (p) => !existsSync(resolve(root, p)),
  );
  if (deletedCRPaths.length > 0) {
    await deleteCRs(api, deletedCRPaths);
    for (const p of deletedCRPaths) {
      delete state.changeRequests![p];
    }
    allDeleted.push(...deletedCRPaths);
  }

  const deletedBugPaths = Object.keys(state.bugs!).filter(
    (p) => !existsSync(resolve(root, p)),
  );
  if (deletedBugPaths.length > 0) {
    await deleteBugs(api, deletedBugPaths);
    for (const p of deletedBugPaths) {
      delete state.bugs![p];
    }
    allDeleted.push(...deletedBugPaths);
  }

  // ── Finalize ───────────────────────────────────────────────────────────
  state.lastPush = new Date().toISOString();
  if (reseedPush) {
    state.needsReseed = false;
  }
  await writeRemoteState(root, state);

  return {
    created: totalCreated,
    updated: totalUpdated,
    pushed: allPushed,
    deleted: allDeleted,
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
  const deleted: string[] = [];
  const conflicts: PullConflict[] = [];

  // Detect remote deletions: tracked locally but not in remote response
  const remotePathSet = new Set(remoteDocs.map((d) => d.path));
  for (const [localPath, tracked] of Object.entries(state.documents)) {
    if (!remotePathSet.has(localPath)) {
      // File was deleted on remote — check if locally modified
      const absPath = resolve(root, localPath);
      if (existsSync(absPath)) {
        const localRaw = await readFile(absPath, 'utf-8');
        const localHash = sha256(localRaw);
        if (localHash !== tracked.localHash) {
          // Locally modified but deleted on remote → conflict
          conflicts.push({
            path: localPath,
            localVersion: tracked.remoteVersion.toString(),
            remoteVersion: 0,
            reason: 'File modified locally but deleted on remote',
          });
        } else {
          // Not modified locally → safe to delete
          await unlink(absPath);
          deleted.push(localPath);
        }
      }
      delete state.documents[localPath];
    }
  }

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
        const updatedContent = replaceBody(localRaw, doc.content);
        await writeFile(absPath, updatedContent, 'utf-8');
        updated.push(localPath);
        updateDocState(state, doc, localPath, updatedContent);
      }
    }
  }

  state.lastPull = new Date().toISOString();
  await writeRemoteState(root, state);

  return { created, updated, deleted, conflicts };
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

  const remoteCRs = await pullPendingCRs(api);
  const state = await readRemoteState(root);
  if (!state.changeRequests) state.changeRequests = {};

  // Build reverse map: remoteId → localPath
  const idToPath = new Map<string, string>();
  for (const [localPath, entry] of Object.entries(state.changeRequests)) {
    idToPath.set(entry.remoteId, localPath);
  }

  let created = 0;
  let updated = 0;
  let deletedCount = 0;

  // Detect remote deletions: tracked locally but not in remote response
  const remoteCRIdSet = new Set(remoteCRs.map((cr) => cr.id));
  for (const [localPath, tracked] of Object.entries(state.changeRequests)) {
    if (!remoteCRIdSet.has(tracked.remoteId)) {
      const absPath = resolve(root, localPath);
      if (existsSync(absPath)) {
        const localRaw = await readFile(absPath, 'utf-8');
        const localHash = sha256(localRaw);
        if (localHash === tracked.localHash) {
          await unlink(absPath);
          deletedCount++;
        }
      }
      delete state.changeRequests![localPath];
    }
  }

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
      const updatedContent = replaceBody(localRaw, cr.body);
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
  return { created, updated, deleted: deletedCount };
}

// ─── Pull Bugs ───────────────────────────────────────────────────────────

export async function pullBugsFromRemote(root: string, timeout?: number): Promise<PullEntitiesResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, timeout);

  const remoteBugs = await pullOpenBugs(api);
  const state = await readRemoteState(root);
  if (!state.bugs) state.bugs = {};

  // Build reverse map: remoteId → localPath
  const idToPath = new Map<string, string>();
  for (const [localPath, entry] of Object.entries(state.bugs)) {
    idToPath.set(entry.remoteId, localPath);
  }

  let created = 0;
  let updated = 0;
  let deletedCount = 0;

  // Detect remote deletions: tracked locally but not in remote response
  const remoteBugIdSet = new Set(remoteBugs.map((b) => b.id));
  for (const [localPath, tracked] of Object.entries(state.bugs)) {
    if (!remoteBugIdSet.has(tracked.remoteId)) {
      const absPath = resolve(root, localPath);
      if (existsSync(absPath)) {
        const localRaw = await readFile(absPath, 'utf-8');
        const localHash = sha256(localRaw);
        if (localHash === tracked.localHash) {
          await unlink(absPath);
          deletedCount++;
        }
      }
      delete state.bugs![localPath];
    }
  }

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
      const updatedContent = replaceBody(localRaw, bug.body);
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
  return { created, updated, deleted: deletedCount };
}

// ─── Reset Remote ────────────────────────────────────────────────────────

export async function resetRemoteProject(root: string, confirmSlug: string, timeout?: number): Promise<RemoteResetResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config, timeout);

  const result = await resetProject(api, confirmSlug);

  // Clear local remote state and mark the project for a full reseed on the next push.
  await writeRemoteState(root, {
    needsReseed: true,
    documents: {},
    changeRequests: {},
    bugs: {},
  });

  return result;
}

// ─── Remote Status ───────────────────────────────────────────────────────

export async function getRemoteStatus(root: string, timeout?: number): Promise<RemoteStatusResult> {
  const config = await readConfig(root);

  if (!config.remote?.url) {
    return { configured: false, url: null, connected: false, localPending: 0, remoteDocs: 0 };
  }

  const files = await parseAllStoryFiles(root);
  const state = await readRemoteState(root);
  const localPending = state.needsReseed
    ? files.length
    : files.filter((f) => {
      const tracked = state.documents[normalizePath(f.relativePath)];
      if (!tracked) return true;
      return tracked.localHash !== f.hash;
    }).length;

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
