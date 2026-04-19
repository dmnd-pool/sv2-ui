import { describe, it, expect, vi } from 'vitest';
import { createDmndClient, INTERACTIVE_RETRY_PROFILE } from './client';
import { DmndApiError } from './types';

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}
function status(code: number) {
  return { ok: false, status: code, json: async () => ({}) } as Response;
}

describe('DMND client', () => {
  it('sends token in request body, never in headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok([]));
    const client = createDmndClient({ fetchImpl, backoffMs: 0 });

    await client.getPoolUrls('tok_abc');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/dmnd-api/api/pool/urls');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ token: 'tok_abc' });
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('returns the pool address array on 2xx', async () => {
    const addrs = [{ host: 'mainnet.dmnd.work', port: 3333 }];
    const fetchImpl = vi.fn().mockResolvedValue(ok(addrs));
    const client = createDmndClient({ fetchImpl, backoffMs: 0 });

    await expect(client.getPoolUrls('tok')).resolves.toEqual(addrs);
  });

  it('throws DmndApiError(unauthorized) on 401 without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(401));
    const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 8 });

    const err = await client.getPoolUrls('bad').catch((e) => e);
    expect(err).toBeInstanceOf(DmndApiError);
    expect(err.code).toBe('unauthorized');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws DmndApiError(unauthorized) on 403 without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(403));
    const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 8 });

    const err = await client.getPoolUrls('bad').catch((e) => e);
    expect(err.code).toBe('unauthorized');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws DmndApiError(network) after exhausting retries on network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

    const err = await client.getPoolUrls('tok').catch((e) => e);
    expect(err).toBeInstanceOf(DmndApiError);
    expect(err.code).toBe('network');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('throws DmndApiError(server) after exhausting retries on 5xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(503));
    const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

    const err = await client.getPoolUrls('tok').catch((e) => e);
    expect(err.code).toBe('server');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries on 5xx and succeeds when a later attempt returns 200', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(status(502))
      .mockResolvedValueOnce(ok([{ host: 'a', port: 1 }]));
    const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 5 });

    await expect(client.getPoolUrls('tok')).resolves.toEqual([{ host: 'a', port: 1 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('aborts immediately when the caller signal is already aborted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok([]));
    const client = createDmndClient({ fetchImpl, backoffMs: 0 });
    const ctrl = new AbortController();
    ctrl.abort();

    const err = await client.getPoolUrls('tok', { signal: ctrl.signal }).catch((e) => e);
    expect(err).toBeInstanceOf(DmndApiError);
    expect(err.code).toBe('network');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('exposes interactive and background retry profiles', () => {
    expect(INTERACTIVE_RETRY_PROFILE.maxAttempts).toBeLessThan(8);
    expect(INTERACTIVE_RETRY_PROFILE.requestTimeoutMs).toBeLessThan(15_000);
  });
});
