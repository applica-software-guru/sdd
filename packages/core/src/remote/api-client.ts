import type { SDDConfig } from '../types.js';
import { RemoteError, RemoteNotConfiguredError } from '../errors.js';
import type {
  RemoteDocResponse,
  RemoteDocBulkResponse,
  RemoteCRResponse,
  RemoteBugResponse,
} from './types.js';

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
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
export function buildApiConfig(config: SDDConfig): ApiClientConfig {
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
  };
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

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message: string;
    try {
      const err = (await res.json()) as { detail?: string };
      message = err.detail ?? res.statusText;
    } catch {
      message = res.statusText;
    }
    throw new RemoteError(res.status, message);
  }

  return (await res.json()) as T;
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

/** GET /cli/open-bugs */
export async function fetchOpenBugs(config: ApiClientConfig): Promise<RemoteBugResponse[]> {
  return request<RemoteBugResponse[]>(config, 'GET', '/cli/open-bugs');
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
