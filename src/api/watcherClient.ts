import { API_BASE } from './client';
import type { GeneratedBtcEntry, HashratePoint, HashrateSnapshot, SubaccountFees, WorkersResponse } from './types';

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
      throw new Error('This Watcher link is no longer valid.');
    }
    if (!response.ok) {
      throw new Error(`Watcher request failed (${response.status})`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    getWorkers(signal) {
      return get<WorkersResponse>('/api/workers/all', { limit: '1000' }, signal);
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
  };
}
