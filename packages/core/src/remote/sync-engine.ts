import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';

import { readConfig } from '../config/config-manager.js';
import { parseAllStoryFiles } from '../parser/story-parser.js';
import { buildApiConfig, pullDocs, pushDocs, fetchPendingCRs, fetchOpenBugs } from './api-client.js';
import { readRemoteState, writeRemoteState } from './state.js';
import type {
  PushResult,
  PullResult,
  PullConflict,
  PullEntitiesResult,
  RemoteStatusResult,
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
 * Build a markdown file with frontmatter for a pulled document.
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
 * Build a markdown file for a pulled change request.
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
 * Build a markdown file for a pulled bug.
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

// ─── Push ────────────────────────────────────────────────────────────────

export async function pushToRemote(root: string, paths?: string[]): Promise<PushResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config);

  const files = await parseAllStoryFiles(root);
  const toPush = files.filter((f) => {
    if (paths && paths.length > 0) return paths.includes(f.relativePath);
    return f.frontmatter.status !== 'synced';
  });

  if (toPush.length === 0) {
    return { created: 0, updated: 0, pushed: [] };
  }

  const documents = toPush.map((f) => ({
    path: normalizePath(f.relativePath),
    title: f.frontmatter.title,
    content: f.body,
  }));

  const result = await pushDocs(api, documents);

  // Update remote state
  const state = await readRemoteState(root);
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
  state.lastPush = new Date().toISOString();
  await writeRemoteState(root, state);

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

  return {
    created: result.created,
    updated: result.updated,
    pushed: toPush.map((f) => f.relativePath),
  };
}

// ─── Pull Documents ──────────────────────────────────────────────────────

export async function pullFromRemote(root: string): Promise<PullResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config);

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
      // New file — create locally, preserving remote status
      const dir = dirname(absPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      const localStatus = doc.status === 'draft' ? 'draft' : 'synced';
      const markdown = buildStoryMarkdown(doc.title, doc.content, doc.version, localStatus);
      await writeFile(absPath, markdown, 'utf-8');
      created.push(localPath);
      updateDocState(state, doc, localPath, markdown);
    } else if (!tracked || doc.version > tracked.remoteVersion) {
      // Remote is newer — check for local changes
      const localContent = await readFile(absPath, 'utf-8');
      const localHash = sha256(localContent);

      if (tracked && localHash !== tracked.localHash) {
        // Local file changed since last sync AND remote changed → conflict
        conflicts.push({
          path: localPath,
          localVersion: tracked.remoteVersion.toString(),
          remoteVersion: doc.version,
          reason: 'Both local and remote have changes since last sync',
        });
      } else {
        // Local unchanged — safe to overwrite
        const localStatus = doc.status === 'draft' ? 'draft' : 'synced';
        const markdown = buildStoryMarkdown(doc.title, doc.content, doc.version, localStatus);
        await writeFile(absPath, markdown, 'utf-8');
        updated.push(localPath);
        updateDocState(state, doc, localPath, markdown);
      }
    }
    // If versions match, skip
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

export async function pullCRsFromRemote(root: string): Promise<PullEntitiesResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config);

  const remoteCRs = await fetchPendingCRs(api);
  const crDir = resolve(root, 'change-requests');
  if (!existsSync(crDir)) {
    await mkdir(crDir, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  for (const cr of remoteCRs) {
    const filename = `CR-${cr.id.substring(0, 8)}.md`;
    const absPath = resolve(crDir, filename);
    const crStatus = cr.status === 'draft' ? 'draft' : 'pending';
    const markdown = buildCRMarkdown(cr.title, cr.body, cr.created_at, crStatus);

    if (existsSync(absPath)) {
      updated++;
    } else {
      created++;
    }
    await writeFile(absPath, markdown, 'utf-8');
  }

  return { created, updated };
}

// ─── Pull Bugs ───────────────────────────────────────────────────────────

export async function pullBugsFromRemote(root: string): Promise<PullEntitiesResult> {
  const config = await readConfig(root);
  const api = buildApiConfig(config);

  const remoteBugs = await fetchOpenBugs(api);
  const bugsDir = resolve(root, 'bugs');
  if (!existsSync(bugsDir)) {
    await mkdir(bugsDir, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  for (const bug of remoteBugs) {
    const filename = `BUG-${bug.id.substring(0, 8)}.md`;
    const absPath = resolve(bugsDir, filename);
    const bugStatus = bug.status === 'draft' ? 'draft' : 'open';
    const markdown = buildBugMarkdown(bug.title, bug.body, bug.created_at, bugStatus);

    if (existsSync(absPath)) {
      updated++;
    } else {
      created++;
    }
    await writeFile(absPath, markdown, 'utf-8');
  }

  return { created, updated };
}

// ─── Remote Status ───────────────────────────────────────────────────────

export async function getRemoteStatus(root: string): Promise<RemoteStatusResult> {
  const config = await readConfig(root);

  if (!config.remote?.url) {
    return { configured: false, url: null, connected: false, localPending: 0, remoteDocs: 0 };
  }

  const files = await parseAllStoryFiles(root);
  const localPending = files.filter((f) => f.frontmatter.status !== 'synced').length;

  try {
    const api = buildApiConfig(config);
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
