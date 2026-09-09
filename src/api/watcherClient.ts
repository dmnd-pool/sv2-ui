import { API_BASE, isPplnsProjectionMissing } from './client';
import { API_ERROR_MESSAGES } from './errorMessages';
import { decodePplnsProjection, pplnsProjectionMatchesAccount } from './pplnsProjection';
import type {
  GeneratedBtcEntry,
  HashratePoint,
  HashrateSnapshot,
  PplnsProjection,
  SubaccountFees,
  WorkersResponse,
} from './types';

class WatcherRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'WatcherRequestError';
  }
}

/**
 * A client for the public Watcher View. Unlike the authenticated client, it sends
 * NO session cookie and NO X-Account-ID header: the watcher link's `token` in the
 * query is the only credential, and the page runs for an anonymous visitor. Sending
 * the owner's session here would leak it to whoever holds the link, so every call is
 * a bare, credential-free fetch.
 */
export interface WatcherClient {
  getWorkers(signal?: AbortSignal): Promise<WorkersResponse>;
  getHashrate(signal?: AbortSignal): Promise<HashrateSnapshot>;
  getHashrateHistory(from: string, to: string, signal?: AbortSignal): Promise<HashratePoint[]>;
  getGeneratedBtc(signal?: AbortSignal): Promise<GeneratedBtcEntry[]>;
  getFees(signal?: AbortSignal): Promise<SubaccountFees>;
  /** Null when the cache holds no projection for the latest PPLNS boundary yet. */
  getPplnsProjection(accountId: string, signal?: AbortSignal): Promise<PplnsProjection | null>;
}

interface WatcherClientOptions {
  fetchImpl?: typeof fetch;
}

export function createWatcherClient(token: string, options: WatcherClientOptions = {}): WatcherClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const query = new URLSearchParams({ ...params, token }).toString();
    // No credentials, no X-Account-ID: the token is the only thing sent.
    const response = await fetchImpl(`${API_BASE}${path}?${query}`, { method: 'GET', signal });
    if (response.status === 401 || response.status === 403) {
      throw new WatcherRequestError('This Watcher link is no longer valid.', response.status);
    }
    if (!response.ok) {
      throw new WatcherRequestError(API_ERROR_MESSAGES.watcher, response.status);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    async getWorkers(signal) {
      const workers: WorkersResponse['workers'] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;

      for (;;) {
        const params: Record<string, string> = { limit: '1000' };
        if (cursor) params.cursor = cursor;
        const page = await get<WorkersResponse>('/api/workers/all', params, signal);
        workers.push(...page.workers);
        if (!page.next_cursor || page.workers.length === 0 || seen.has(page.next_cursor)) break;
        seen.add(page.next_cursor);
        cursor = page.next_cursor;
      }

      return { workers, next_cursor: null };
    },
    getHashrate(signal) {
      return get<HashrateSnapshot>('/api/user/hashrate', {}, signal);
    },
    async getHashrateHistory(from, to, signal) {
      const result = await get<unknown>('/api/user/hashrate/historical', { from, to }, signal);
      return Array.isArray(result) ? (result as HashratePoint[]) : [];
    },
    async getGeneratedBtc(signal) {
      // `/api/generated_btc` is session-authenticated and rejects a watcher token with a
      // bare 401, which made an earnings-only link look dead. The token-authenticated
      // route is `/api/user/generated_btc` (verified live: valid token 200, bogus/absent
      // token 401, and it still enforces the token's scopes).
      const result = await get<unknown>('/api/user/generated_btc', {}, signal);
      return Array.isArray(result) ? (result as GeneratedBtcEntry[]) : [];
    },
    getFees(signal) {
      // Current pool + broker fee rates for the linked account. The spec returns the
      // rates already in percent (2 = 2%), so the view shows the number verbatim.
      return get<SubaccountFees>('/api/user/fees', {}, signal);
    },
    async getPplnsProjection(accountId, signal) {
      try {
        const payload = await get<unknown>(
          `/api/user/sub_account/${encodeURIComponent(accountId)}/pplns_projection`,
          {},
          signal,
        );
        const projection = decodePplnsProjection(payload);
        if (!pplnsProjectionMatchesAccount(projection, accountId)) {
          throw new Error('PPLNS projection account does not match the request');
        }
        return projection;
      } catch (err) {
        if (err instanceof WatcherRequestError && isPplnsProjectionMissing(err.status, err.message)) {
          return null;
        }
        throw err;
      }
    },
  };
}
