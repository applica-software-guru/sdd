import type { SDDConfig } from '../types.js';
import { RemoteError, RemoteNotConfiguredError, RemoteTimeoutError } from '../errors.js';
import type {
  RemoteDocResponse,
  RemoteDocBulkResponse,
  RemoteCRResponse,
  RemoteCRBulkResponse,
  RemoteBugResponse,
  RemoteBugBulkResponse,
  RemoteDeleteResponse,
  RemoteResetResult,
} from './types.js';

/** Default timeout for remote operations (seconds) */
export const DEFAULT_REMOTE_TIMEOUT = 300;

/** Status codes that trigger a retry (server not ready / cold start) */
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

/** Initial backoff delay in ms */
const INITIAL_BACKOFF_MS = 3_000;

/** Maximum backoff delay in ms */
const MAX_BACKOFF_MS = 30_000;

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

/**
 * Resolve API key: SDD_API_KEY env var > config.remote.api-key > null
 */
export function resolveApiKey(config: SDDConfig): string | null {
  const envKey = process.env.SDD_API_KEY;
  if (envKey) return envKey;
  return config.remote?.['api-key'] ?? null;
}

/**
 * Build an ApiClientConfig from the SDD project config.
 * Throws RemoteNotConfiguredError if URL or API key is missing.
 */
/**
 * Build an ApiClientConfig from the SDD project config.
 * Throws RemoteNotConfiguredError if URL or API key is missing.
 * An optional timeoutOverride (from --timeout flag) takes precedence over config.
 */
export function buildApiConfig(config: SDDConfig, timeoutOverride?: number): ApiClientConfig {
  if (!config.remote?.url) {
    throw new RemoteNotConfiguredError();
  }
  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    throw new RemoteNotConfiguredError();
  }
  return {
    baseUrl: config.remote.url.replace(/\/+$/, ''),
    apiKey,
    timeout: timeoutOverride ?? config.remote.timeout ?? DEFAULT_REMOTE_TIMEOUT,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof RemoteError) {
    return RETRYABLE_STATUS_CODES.has(error.statusCode);
  }
  // Network errors (ECONNREFUSED, ENOTFOUND, fetch abort due to connection failure)
  if (error instanceof TypeError) return true;
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENOTFOUND' || code === 'UND_ERR_CONNECT_TIMEOUT';
}

async function request<T>(
  config: ApiClientConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  const deadline = Date.now() + config.timeout * 1_000;
  let backoff = INITIAL_BACKOFF_MS;
  let attempt = 0;

  while (true) {
    attempt++;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new RemoteTimeoutError(config.timeout);
    }

    // Per-request timeout: min of remaining budget and 60s
    const perRequestTimeout = Math.min(remaining, 60_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perRequestTimeout);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        let message: string;
        try {
          const err = (await res.json()) as { detail?: string };
          message = err.detail ?? res.statusText;
        } catch {
          message = res.statusText;
        }
        const remoteErr = new RemoteError(res.status, message);

        if (RETRYABLE_STATUS_CODES.has(res.status) && Date.now() + backoff < deadline) {
          process.stderr.write(`  ⏳ Server not ready (${res.status}), retrying in ${Math.round(backoff / 1000)}s... (attempt ${attempt})\n`);
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          continue;
        }

        throw remoteErr;
      }

      return (await res.json()) as T;
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof RemoteError || error instanceof RemoteTimeoutError) {
        throw error;
      }

      // Retryable network/connection error
      if (isRetryable(error) && Date.now() + backoff < deadline) {
        process.stderr.write(`  ⏳ Cannot reach server, retrying in ${Math.round(backoff / 1000)}s... (attempt ${attempt})\n`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        continue;
      }

      // AbortError from our own timeout
      if ((error as Error).name === 'AbortError') {
        if (Date.now() + backoff < deadline) {
          process.stderr.write(`  ⏳ Request timed out, retrying in ${Math.round(backoff / 1000)}s... (attempt ${attempt})\n`);
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          continue;
        }
        throw new RemoteTimeoutError(config.timeout);
      }

      throw error;
    }
  }
}

/** GET /cli/pull-docs */
export async function pullDocs(config: ApiClientConfig): Promise<RemoteDocResponse[]> {
  return request<RemoteDocResponse[]>(config, 'GET', '/cli/pull-docs');
}

/** POST /cli/push-docs */
export async function pushDocs(
  config: ApiClientConfig,
  documents: Array<{ path: string; title: string; content: string }>,
): Promise<RemoteDocBulkResponse> {
  return request<RemoteDocBulkResponse>(config, 'POST', '/cli/push-docs', { documents });
}

/** GET /cli/pending-crs */
export async function fetchPendingCRs(config: ApiClientConfig): Promise<RemoteCRResponse[]> {
  return request<RemoteCRResponse[]>(config, 'GET', '/cli/pending-crs');
}

/** POST /cli/push-crs */
export async function pushCRs(
  config: ApiClientConfig,
  changeRequests: Array<{ path: string; title: string; body: string; id?: string }>,
): Promise<RemoteCRBulkResponse> {
  return request<RemoteCRBulkResponse>(config, 'POST', '/cli/push-crs', { change_requests: changeRequests });
}

/** GET /cli/open-bugs */
export async function fetchOpenBugs(config: ApiClientConfig): Promise<RemoteBugResponse[]> {
  return request<RemoteBugResponse[]>(config, 'GET', '/cli/open-bugs');
}

/** POST /cli/push-bugs */
export async function pushBugs(
  config: ApiClientConfig,
  bugs: Array<{ path: string; title: string; body: string; severity?: string; id?: string }>,
): Promise<RemoteBugBulkResponse> {
  return request<RemoteBugBulkResponse>(config, 'POST', '/cli/push-bugs', { bugs });
}

/** POST /cli/delete-docs */
export async function deleteDocs(
  config: ApiClientConfig,
  paths: string[],
): Promise<RemoteDeleteResponse> {
  return request<RemoteDeleteResponse>(config, 'POST', '/cli/delete-docs', { paths });
}

/** POST /cli/delete-crs */
export async function deleteCRs(
  config: ApiClientConfig,
  paths: string[],
): Promise<RemoteDeleteResponse> {
  return request<RemoteDeleteResponse>(config, 'POST', '/cli/delete-crs', { paths });
}

/** POST /cli/delete-bugs */
export async function deleteBugs(
  config: ApiClientConfig,
  paths: string[],
): Promise<RemoteDeleteResponse> {
  return request<RemoteDeleteResponse>(config, 'POST', '/cli/delete-bugs', { paths });
}

/** POST /cli/crs/:crId/applied */
export async function markCRAppliedRemote(
  config: ApiClientConfig,
  crId: string,
): Promise<RemoteCRResponse> {
  return request<RemoteCRResponse>(config, 'POST', `/cli/crs/${crId}/applied`);
}

/** POST /cli/bugs/:bugId/resolved */
export async function markBugResolvedRemote(
  config: ApiClientConfig,
  bugId: string,
): Promise<RemoteBugResponse> {
  return request<RemoteBugResponse>(config, 'POST', `/cli/bugs/${bugId}/resolved`);
}

/** POST /cli/docs/:docId/enriched — Notify remote that a draft doc has been enriched */
export async function markDocEnriched(
  config: ApiClientConfig,
  docId: string,
  content: string,
): Promise<RemoteDocResponse> {
  return request<RemoteDocResponse>(config, 'POST', `/cli/docs/${docId}/enriched`, { content });
}

/** POST /cli/crs/:crId/enriched — Notify remote that a draft CR has been enriched */
export async function markCREnriched(
  config: ApiClientConfig,
  crId: string,
  body: string,
): Promise<RemoteCRResponse> {
  return request<RemoteCRResponse>(config, 'POST', `/cli/crs/${crId}/enriched`, { body });
}

/** POST /cli/bugs/:bugId/enriched — Notify remote that a draft bug has been enriched */
export async function markBugEnriched(
  config: ApiClientConfig,
  bugId: string,
  body: string,
): Promise<RemoteBugResponse> {
  return request<RemoteBugResponse>(config, 'POST', `/cli/bugs/${bugId}/enriched`, { body });
}

/** POST /cli/reset — Reset all project data on remote */
export async function resetProject(
  config: ApiClientConfig,
  confirmSlug: string,
): Promise<RemoteResetResult> {
  return request<RemoteResetResult>(config, 'POST', '/cli/reset', { confirm_slug: confirmSlug });
}
