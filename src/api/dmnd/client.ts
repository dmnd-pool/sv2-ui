import {
  DmndApiError,
  type DmndClient,
  type PoolAddress,
  type RequestOptions,
} from './types';

const BASE_PATH = '/dmnd-api';

/**
 * dmnd-client's own cadence (src/config.rs:461) is 8 retries / 15s timeout /
 * 3s backoff — designed for a long-lived background daemon. For interactive
 * login that worst-case blocks the UI for ~2 minutes, which is unacceptable.
 * We expose both profiles so background callers (share submit, worker
 * activity — future PRs) can match the daemon exactly while login uses the
 * fast profile.
 */
export const BACKGROUND_RETRY_PROFILE = Object.freeze({
  maxAttempts: 8,
  requestTimeoutMs: 15_000,
  backoffMs: 3_000,
});

export const INTERACTIVE_RETRY_PROFILE = Object.freeze({
  maxAttempts: 3,
  requestTimeoutMs: 5_000,
  backoffMs: 500,
});

export interface DmndClientOptions {
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  requestTimeoutMs?: number;
  backoffMs?: number;
}

interface ResolvedOptions {
  fetchImpl: typeof fetch;
  maxAttempts: number;
  requestTimeoutMs: number;
  backoffMs: number;
}

function resolveOptions(o: DmndClientOptions): ResolvedOptions {
  return {
    fetchImpl: o.fetchImpl ?? fetch,
    maxAttempts: o.maxAttempts ?? BACKGROUND_RETRY_PROFILE.maxAttempts,
    requestTimeoutMs: o.requestTimeoutMs ?? BACKGROUND_RETRY_PROFILE.requestTimeoutMs,
    backoffMs: o.backoffMs ?? BACKGROUND_RETRY_PROFILE.backoffMs,
  };
}

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  const controller = new AbortController();
  const onAbort = () => controller.abort(external.reason);
  const onTimeout = () => controller.abort(timeout.reason);
  if (external.aborted) controller.abort(external.reason);
  else if (timeout.aborted) controller.abort(timeout.reason);
  else {
    external.addEventListener('abort', onAbort, { once: true });
    timeout.addEventListener('abort', onTimeout, { once: true });
  }
  return controller.signal;
}

async function postJson<T>(
  path: string,
  body: unknown,
  opts: ResolvedOptions,
  req: RequestOptions = {},
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    if (req.signal?.aborted) {
      throw new DmndApiError('Request cancelled', 'network');
    }
    try {
      const response = await opts.fetchImpl(`${BASE_PATH}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: combineSignals(opts.requestTimeoutMs, req.signal),
      });

      if (response.status === 401 || response.status === 403) {
        throw new DmndApiError('Invalid token', 'unauthorized');
      }
      if (response.status >= 500) {
        lastError = new DmndApiError(`DMND server error (${response.status})`, 'server');
      } else if (!response.ok) {
        throw new DmndApiError(`Unexpected status ${response.status}`, 'unknown');
      } else {
        return (await response.json()) as T;
      }
    } catch (err) {
      if (err instanceof DmndApiError && (err.code === 'unauthorized' || err.code === 'unknown')) {
        throw err;
      }
      lastError = err;
    }

    if (attempt < opts.maxAttempts) {
      await new Promise((r) => setTimeout(r, opts.backoffMs));
    }
  }

  if (lastError instanceof DmndApiError) throw lastError;
  throw new DmndApiError('Cannot reach DMND cloud API', 'network');
}

export function createDmndClient(options: DmndClientOptions = {}): DmndClient {
  const opts = resolveOptions(options);
  return {
    getPoolUrls(token, req) {
      return postJson<PoolAddress[]>('/api/pool/urls', { token }, opts, req);
    },
  };
}

let activeClient: DmndClient = createDmndClient(INTERACTIVE_RETRY_PROFILE);

export function setDmndClient(client: DmndClient) {
  activeClient = client;
}

export function getDmndClient(): DmndClient {
  return activeClient;
}
