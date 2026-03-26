import type { ApiClientConfig } from './api-client.js';
import type { WorkerRegistration, WorkerJobAssignment, WorkerJobAnswer } from './worker-types.js';

/**
 * Low-level fetch wrapper for worker endpoints.
 * Unlike the main api-client, worker requests have different timeout needs
 * (e.g. long-poll uses 35s timeout) and don't need full retry logic.
 */
async function workerRequest<T>(
  config: ApiClientConfig,
  method: string,
  path: string,
  body?: unknown,
  timeoutMs?: number,
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? 10_000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      let detail: string;
      try {
        const err = (await res.json()) as { detail?: string };
        detail = err.detail ?? res.statusText;
      } catch {
        detail = res.statusText;
      }
      throw new Error(`Worker API error ${res.status}: ${detail}`);
    }

    // 204 No Content (poll with no job)
    if (res.status === 204) {
      return null as T;
    }

    return (await res.json()) as T;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/** POST /cli/workers/register */
export async function registerWorker(
  config: ApiClientConfig,
  name: string,
  agent: string,
  branch?: string,
  metadata?: Record<string, unknown>,
): Promise<WorkerRegistration> {
  return workerRequest<WorkerRegistration>(
    config, 'POST', '/cli/workers/register',
    { name, agent, branch, metadata },
  );
}

/** POST /cli/workers/:workerId/heartbeat */
export async function workerHeartbeat(
  config: ApiClientConfig,
  workerId: string,
  workerStatus: 'online' | 'busy' = 'online',
): Promise<void> {
  await workerRequest(
    config, 'POST', `/cli/workers/${workerId}/heartbeat`,
    { status: workerStatus },
  );
}

/** GET /cli/workers/:workerId/poll — long-poll (up to 35s timeout) */
export async function workerPoll(
  config: ApiClientConfig,
  workerId: string,
): Promise<WorkerJobAssignment | null> {
  return workerRequest<WorkerJobAssignment | null>(
    config, 'GET', `/cli/workers/${workerId}/poll`,
    undefined,
    35_000, // 35s to exceed server's 30s hold time
  );
}

/** POST /cli/workers/jobs/:jobId/started */
export async function workerJobStarted(
  config: ApiClientConfig,
  jobId: string,
): Promise<void> {
  await workerRequest(config, 'POST', `/cli/workers/jobs/${jobId}/started`);
}

/** POST /cli/workers/jobs/:jobId/output */
export async function workerJobOutput(
  config: ApiClientConfig,
  jobId: string,
  lines: string[],
): Promise<void> {
  await workerRequest(config, 'POST', `/cli/workers/jobs/${jobId}/output`, { lines });
}

/** POST /cli/workers/jobs/:jobId/question */
export async function workerJobQuestion(
  config: ApiClientConfig,
  jobId: string,
  content: string,
): Promise<void> {
  await workerRequest(config, 'POST', `/cli/workers/jobs/${jobId}/question`, { content });
}

/** GET /cli/workers/jobs/:jobId/answers?after_sequence=N */
export async function workerJobAnswers(
  config: ApiClientConfig,
  jobId: string,
  afterSequence: number = 0,
): Promise<WorkerJobAnswer[]> {
  return workerRequest<WorkerJobAnswer[]>(
    config, 'GET', `/cli/workers/jobs/${jobId}/answers?after_sequence=${afterSequence}`,
  );
}

/** POST /cli/workers/jobs/:jobId/completed */
export async function workerJobCompleted(
  config: ApiClientConfig,
  jobId: string,
  exitCode: number,
  changedFiles?: Array<{ path: string; status: 'new' | 'modified' | 'deleted' }>,
): Promise<void> {
  await workerRequest(config, 'POST', `/cli/workers/jobs/${jobId}/completed`, {
    exit_code: exitCode,
    changed_files: changedFiles ?? [],
  });
}
