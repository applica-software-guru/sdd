import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveApiKey,
  buildApiConfig,
  pullDocs,
  pushDocs,
  fetchPendingCRs,
  fetchOpenBugs,
  markCRAppliedRemote,
  markBugResolvedRemote,
} from '../src/remote/api-client.js';
import { RemoteError, RemoteNotConfiguredError } from '../src/errors.js';
import type { SDDConfig } from '../src/types.js';

function mockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => response,
  });
}

const BASE_CONFIG: SDDConfig = {
  description: 'test',
  remote: {
    url: 'http://test.local/api/v1',
    'api-key': 'config-key-123',
  },
};

const API = { baseUrl: 'http://test.local/api/v1', apiKey: 'key123' };

describe('resolveApiKey', () => {
  const originalEnv = process.env.SDD_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SDD_API_KEY = originalEnv;
    } else {
      delete process.env.SDD_API_KEY;
    }
  });

  it('returns env var when set', () => {
    process.env.SDD_API_KEY = 'env-key-456';
    expect(resolveApiKey(BASE_CONFIG)).toBe('env-key-456');
  });

  it('falls back to config api-key when env var is unset', () => {
    delete process.env.SDD_API_KEY;
    expect(resolveApiKey(BASE_CONFIG)).toBe('config-key-123');
  });

  it('returns null when neither is available', () => {
    delete process.env.SDD_API_KEY;
    expect(resolveApiKey({ description: 'test' })).toBeNull();
  });
});

describe('buildApiConfig', () => {
  afterEach(() => {
    delete process.env.SDD_API_KEY;
  });

  it('builds config from SDDConfig', () => {
    delete process.env.SDD_API_KEY;
    const result = buildApiConfig(BASE_CONFIG);
    expect(result.baseUrl).toBe('http://test.local/api/v1');
    expect(result.apiKey).toBe('config-key-123');
  });

  it('strips trailing slashes from URL', () => {
    delete process.env.SDD_API_KEY;
    const config: SDDConfig = {
      description: 'test',
      remote: { url: 'http://test.local/api/v1/', 'api-key': 'k' },
    };
    expect(buildApiConfig(config).baseUrl).toBe('http://test.local/api/v1');
  });

  it('throws when remote not configured', () => {
    expect(() => buildApiConfig({ description: 'test' })).toThrow(RemoteNotConfiguredError);
  });

  it('throws when no API key available', () => {
    delete process.env.SDD_API_KEY;
    const config: SDDConfig = { description: 'test', remote: { url: 'http://test.local' } };
    expect(() => buildApiConfig(config)).toThrow(RemoteNotConfiguredError);
  });
});

describe('API client functions', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('pullDocs sends GET with auth header', async () => {
    const mock = mockFetch([]);
    globalThis.fetch = mock;

    const result = await pullDocs(API);
    expect(result).toEqual([]);
    expect(mock).toHaveBeenCalledWith(
      'http://test.local/api/v1/cli/pull-docs',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer key123',
        }),
      }),
    );
  });

  it('pushDocs sends POST with body', async () => {
    const mock = mockFetch({ created: 1, updated: 0, documents: [] });
    globalThis.fetch = mock;

    const docs = [{ path: 'product/vision.md', title: 'Vision', content: 'body' }];
    await pushDocs(API, docs);

    expect(mock).toHaveBeenCalledWith(
      'http://test.local/api/v1/cli/push-docs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ documents: docs }),
      }),
    );
  });

  it('fetchPendingCRs sends GET to correct endpoint', async () => {
    const mock = mockFetch([]);
    globalThis.fetch = mock;

    await fetchPendingCRs(API);
    expect(mock).toHaveBeenCalledWith(
      'http://test.local/api/v1/cli/pending-crs',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('fetchOpenBugs sends GET to correct endpoint', async () => {
    const mock = mockFetch([]);
    globalThis.fetch = mock;

    await fetchOpenBugs(API);
    expect(mock).toHaveBeenCalledWith(
      'http://test.local/api/v1/cli/open-bugs',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('markCRAppliedRemote sends POST with cr ID', async () => {
    const mock = mockFetch({ id: 'abc', status: 'applied' });
    globalThis.fetch = mock;

    await markCRAppliedRemote(API, 'abc-123');
    expect(mock).toHaveBeenCalledWith(
      'http://test.local/api/v1/cli/crs/abc-123/applied',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('markBugResolvedRemote sends POST with bug ID', async () => {
    const mock = mockFetch({ id: 'xyz', status: 'resolved' });
    globalThis.fetch = mock;

    await markBugResolvedRemote(API, 'xyz-456');
    expect(mock).toHaveBeenCalledWith(
      'http://test.local/api/v1/cli/bugs/xyz-456/resolved',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws RemoteError on non-OK response', async () => {
    globalThis.fetch = mockFetch({ detail: 'Invalid API key' }, false, 401);

    await expect(pullDocs(API)).rejects.toThrow(RemoteError);
    await expect(pullDocs(API)).rejects.toThrow('Remote error (401)');
  });

  it('handles non-JSON error responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('not json'); },
    });

    await expect(pullDocs(API)).rejects.toThrow('Internal Server Error');
  });
});
