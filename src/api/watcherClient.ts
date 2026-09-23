import { decodeGeneratedBtc } from './generatedBtc';
import { requireArray } from './response';
import { API_BASE } from './client';
import { fetchHashrateHistory } from './hashrateHistory';
import { API_ERROR_MESSAGES } from './errorMessages';
import { decodePplnsProjection, pplnsProjectionMatchesAccount } from './pplnsProjection';
import type {
  GeneratedBtcEntry,
  HashratePoint,
  HashrateSnapshot,
  PayoutRecord,
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

/** Public monitoring reads use a dedicated bearer key and never a dashboard session. */
export interface WatcherClient {
  getWorkers(signal?: AbortSignal): Promise<WorkersResponse>;
  getHashrate(signal?: AbortSignal): Promise<HashrateSnapshot>;
  getHashrateHistory(from: string, to: string, signal?: AbortSignal): Promise<HashratePoint[]>;
  getGeneratedBtc(accountId: string, signal?: AbortSignal): Promise<GeneratedBtcEntry[]>;
  getPayouts(accountId: string, signal?: AbortSignal): Promise<PayoutRecord[]>;
  getFees(signal?: AbortSignal): Promise<SubaccountFees>;
  /** Null when the cache holds no projection for the latest PPLNS boundary yet. */
  getPplnsProjection(accountId: string, signal?: AbortSignal): Promise<PplnsProjection | null>;
}

interface WatcherClientOptions {
  fetchImpl?: typeof fetch;
}

export function createWatcherClient(token: string, options: WatcherClientOptions = {}): WatcherClient {
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);

  async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const response = await fetchImpl(`${API_BASE}${path}?${query}`, {
      method: 'GET',
      signal,
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
    });
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
    getHashrateHistory(from, to, signal) {
      return fetchHashrateHistory(from, to, async (start, end) => {
        const result = await get<unknown>('/api/user/hashrate/historical', { from: start, to: end }, signal);
        return requireArray<HashratePoint>(result);
      });
    },
    async getGeneratedBtc(accountId, signal) {
      const path = `/api/user/sub_account/${encodeURIComponent(accountId)}/generated_btc`;
      const result = await get<unknown>(path, {}, signal);
      return decodeGeneratedBtc(result);
    },
    async getPayouts(accountId, signal) {
      const payouts: PayoutRecord[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;

      for (;;) {
        const params: Record<string, string> = { limit: '100' };
        if (cursor) params.cursor = cursor;
        const page = await get<{ payouts: PayoutRecord[]; next_cursor: string | null }>(
          `/api/v1/user/sub_account/${encodeURIComponent(accountId)}/payouts`,
          params,
          signal,
        );
        if (!Array.isArray(page.payouts)) throw new Error('Invalid payouts response');
        payouts.push(...page.payouts);
        if (!page.next_cursor || page.payouts.length === 0 || seen.has(page.next_cursor)) break;
        seen.add(page.next_cursor);
        cursor = page.next_cursor;
      }

      return payouts;
    },
    getFees(signal) {
      // Current pool + broker fee rates for the linked account. The spec returns the
      // rates as fractions (0.02 = 2%); display helpers convert them to percent.
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
        if (err instanceof WatcherRequestError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
  };
}
