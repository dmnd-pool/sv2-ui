import {
  type AccountPermissions,
  type BrokerAccount,
  type BrokerSignupInput,
  type CreateSubaccountInput,
  DmndApiError,
  type DmndClient,
  type DmndSession,
  type HashratePoint,
  type HashrateSnapshot,
  type PayoutAddresses,
  type GeneratedBtcEntry,
  type WatcherLink,
  type RequestOptions,
  type SignupInput,
  type Subaccount,
  type SubaccountSummary,
  type Worker,
  type WorkersResponse,
} from './types';

// The DMND dashboard API is called directly: it sets CORS for our origin and
// allows credentials, so the browser sends the HttpOnly session cookie on every
// call. Overridable for production via VITE_DMND_API_BASE; defaults to staging
// so dev and review never hit production.
export const API_BASE =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DMND_API_BASE ??
  'https://staging-user-dashboard-server.dmnd.work';

/**
 * Auth calls are interactive, so they use a short retry budget: a login that
 * blocks the UI for two minutes is worse than failing fast and letting the user
 * retry. Background callers (share submit, worker activity in later PRs) can
 * pass their own slower profile through DmndClientOptions.
 */
const DEFAULT_PROFILE = Object.freeze({
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

/**
 * The account id sent as X-Account-ID on authed calls. DMND keys the session
 * cookie by account id and requires the header to resolve it, so it's ambient
 * session state (like the cookie) rather than a per-call argument. The auth
 * layer sets it on sign-in/restore and clears it on sign-out.
 */
let accountId: string | null = null;

export function setDmndAccountId(id: string | null): void {
  accountId = id;
}

function resolveOptions(o: DmndClientOptions): ResolvedOptions {
  return {
    // Bind to the global: native fetch throws "Illegal invocation" if called as
    // a method (opts.fetchImpl(...)), since `this` would be `opts`, not window.
    fetchImpl: o.fetchImpl ?? fetch.bind(globalThis),
    maxAttempts: o.maxAttempts ?? DEFAULT_PROFILE.maxAttempts,
    requestTimeoutMs: o.requestTimeoutMs ?? DEFAULT_PROFILE.requestTimeoutMs,
    backoffMs: o.backoffMs ?? DEFAULT_PROFILE.backoffMs,
  };
}

/**
 * Aborts when either the per-request timeout fires or the caller's signal does,
 * so a component that unmounts mid-request cancels cleanly.
 */
function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  const controller = new AbortController();
  if (external.aborted) controller.abort(external.reason);
  else if (timeout.aborted) controller.abort(timeout.reason);
  else {
    external.addEventListener('abort', () => controller.abort(external.reason), { once: true });
    timeout.addEventListener('abort', () => controller.abort(timeout.reason), { once: true });
  }
  return controller.signal;
}

/** Pulls the `message` from a DMND error body (`{code, message}`) when present. */
async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    const data: unknown = JSON.parse(text);
    if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
      return (data as { message: string }).message;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

interface RequestSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Broker endpoints are a separate tree and must not carry the miner X-Account-ID header. */
  omitAccountId?: boolean;
  /** Per-call timeout override (ms). Dense responses (the historical series) need more than the interactive default. */
  timeoutMs?: number;
}

// /api/broker/log returns `referenceCode`, /api/brokers returns `reference_code`;
// normalizeBrokerAccount maps both to `referenceCode`.
interface RawBrokerAccount {
  id: string | number;
  email: string;
  referenceCode?: string;
  reference_code?: string;
}

function normalizeBrokerAccount(raw: RawBrokerAccount): BrokerAccount {
  return {
    id: raw.id,
    email: raw.email,
    referenceCode: raw.referenceCode ?? raw.reference_code ?? '',
  };
}

async function request<T>(
  spec: RequestSpec,
  opts: ResolvedOptions,
  req: RequestOptions = {},
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    if (req.signal?.aborted) throw new DmndApiError('Request cancelled', 'network');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accountId && !spec.omitAccountId) headers['X-Account-ID'] = accountId;

    try {
      const response = await opts.fetchImpl(`${API_BASE}${spec.path}`, {
        method: spec.method,
        headers,
        // DMND auth is cookie-based; send the session cookie on every call. The
        // proxy relays the login Set-Cookie back (de-Secured in dev).
        credentials: 'include',
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: combineSignals(spec.timeoutMs ?? opts.requestTimeoutMs, req.signal),
      });

      if (response.status === 401 || response.status === 403) {
        throw new DmndApiError((await readErrorMessage(response)) ?? 'Not authorized', 'unauthorized');
      }
      if (response.status >= 500) {
        lastError = new DmndApiError(`DMND server error (${response.status})`, 'server');
      } else if (!response.ok) {
        // 4xx with a server message (e.g. weak password) surfaces that message.
        throw new DmndApiError(
          (await readErrorMessage(response)) ?? 'Something went wrong. Please try again.',
          'unknown',
        );
      } else {
        const text = await response.text();
        return (text ? JSON.parse(text) : undefined) as T;
      }
    } catch (err) {
      // Auth and client errors are final; only transient failures retry.
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
  throw new DmndApiError('Cannot reach DMND API server', 'network');
}

export function createDmndClient(options: DmndClientOptions = {}): DmndClient {
  const opts = resolveOptions(options);
  return {
    signup(input: SignupInput, req) {
      // The endpoint wants the fields nested under `register` with `language`
      // (the onboarding app sends "En"); a flat body fails Rocket deserialization
      // and 422s.
      const body = {
        register: {
          email: input.email,
          password: input.password,
          firstName: input.firstName,
          lastName: input.lastName,
          companyName: input.companyName ?? '',
          companyPrimaryLocation: input.companyLocation ?? '',
          referral: input.referralCode ?? null,
          language: 'En',
        },
      };
      return request<void>({ method: 'POST', path: '/api/users', body }, opts, req);
    },
    login(email, password, req) {
      // The live endpoint requires `language` (the dashboard hardcodes "En");
      // without it Rocket fails to deserialize the body and returns 422.
      return request<DmndSession>(
        { method: 'POST', path: '/api/log_user', body: { email, password, language: 'En' } },
        opts,
        req,
      );
    },
    logout(req) {
      return request<void>({ method: 'POST', path: '/api/logout' }, opts, req);
    },
    checkAuth(req) {
      // Validates the session cookie on app startup. The session no longer stores
      // a token, so this call (cookie + X-Account-ID header) is how we confirm
      // the user is still logged in; it throws on 401, which the auth layer
      // treats as signed out.
      return request<DmndSession>({ method: 'GET', path: '/api/check_auth' }, opts, req);
    },
    forgotPassword(email, req) {
      return request<void>({ method: 'POST', path: '/api/forgot_password', body: { email } }, opts, req);
    },
    resetPassword(email, code, twoFaCode, newPassword, req) {
      // Snake_case keys (verified live); `code` comes from the email link, the
      // two_fa_token from the authenticator, new_password from the form.
      return request<void>(
        {
          method: 'POST',
          path: '/api/reset_password',
          body: { email, code, two_fa_token: twoFaCode, new_password: newPassword },
        },
        opts,
        req,
      );
    },
    activate2fa(code, req) {
      // The body field is literally `token` and holds the 6-digit CODE (the
      // session rides in the cookie + X-Account-ID header). Verified live.
      return request<void>({ method: 'PUT', path: '/api/activate_2fa', body: { token: code } }, opts, req);
    },
    newTwoFactor(req) {
      // Returns a session-shaped object carrying a FRESH `two_factor_secret` to
      // re-provision 2FA, even when it is already active (unlike check_auth, which
      // hides the secret once enabled). A GET, so it is safe to call without
      // committing anything; activate2fa is what overwrites the live secret.
      // Verified live: GET /api/new_2fa returns the user object with a 32-char secret.
      return request<DmndSession>({ method: 'GET', path: '/api/new_2fa' }, opts, req);
    },
    setBitcoinAddress(address, twoFaToken, req) {
      // Snake_case body (bundle-verified); sub_account_id is null for the master
      // account. The API rejects an empty/missing two_fa_token with a
      // 2FA-required error, which the Bitcoin step uses to prompt for the code.
      return request<void>(
        {
          method: 'POST',
          path: '/api/bitcoin_address',
          body: { bitcoin_address: address, two_fa_token: twoFaToken, sub_account_id: null },
        },
        opts,
        req,
      );
    },
    async brokerLogin(email, password, req): Promise<BrokerAccount> {
      const raw = await request<RawBrokerAccount>(
        { method: 'POST', path: '/api/broker/log', body: { email, password }, omitAccountId: true },
        opts,
        req,
      );
      return normalizeBrokerAccount(raw);
    },
    async brokerSignup(input: BrokerSignupInput, req): Promise<BrokerAccount> {
      const raw = await request<RawBrokerAccount>(
        {
          method: 'POST',
          path: '/api/brokers',
          omitAccountId: true,
          body: {
            email: input.email,
            password: input.password,
            firstName: input.firstName,
            lastName: input.lastName,
            companyName: input.companyName,
            companyLocation: input.companyLocation,
          },
        },
        opts,
        req,
      );
      return normalizeBrokerAccount(raw);
    },
    getHashrate(req) {
      return request<HashrateSnapshot>({ method: 'GET', path: '/api/user/hashrate' }, opts, req);
    },
    async getHashrateHistory(from, to, req) {
      // /api/user/hashrate/historical returns a dense array (a month is ~16k points),
      // which legitimately takes longer than the interactive default, so give it a
      // wider timeout. Tolerate a non-array (e.g. a scalar for a brand-new account)
      // by collapsing to [] so the chart shows its empty state.
      const params = new URLSearchParams({ from, to });
      const result = await request<unknown>(
        { method: 'GET', path: `/api/user/hashrate/historical?${params.toString()}`, timeoutMs: 20_000 },
        opts,
        req,
      );
      return Array.isArray(result) ? (result as HashratePoint[]) : [];
    },
    getWorkers(from, to, req) {
      const query = new URLSearchParams({ from, to }).toString();
      return request<WorkersResponse>({ method: 'GET', path: `/api/workers?${query}` }, opts, req);
    },
    async getAllWorkers(req) {
      // The roster is paginated (default 200, max 1000). Follow next_cursor so the
      // home's worker total is the full list, not just the first page; capped to
      // avoid looping on a misbehaving cursor.
      const all: Worker[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 50; page++) {
        const params = new URLSearchParams({ limit: '1000' });
        if (cursor) params.set('cursor', cursor);
        const res = await request<WorkersResponse>(
          { method: 'GET', path: `/api/workers/all?${params.toString()}` },
          opts,
          req,
        );
        all.push(...res.workers);
        if (!res.next_cursor || res.next_cursor === cursor || res.workers.length === 0) break;
        cursor = res.next_cursor;
      }
      return all;
    },
    getPayoutAddresses(req) {
      return request<PayoutAddresses>({ method: 'GET', path: '/api/payouts/addresses' }, opts, req);
    },
    async getGeneratedBtc(req) {
      // The daily generated-BTC list is a bare array (empty account -> []). Tolerate a
      // non-array response (e.g. an error object) by collapsing to [] so the page shows
      // its empty state instead of throwing.
      const result = await request<unknown>({ method: 'GET', path: '/api/generated_btc' }, opts, req);
      return Array.isArray(result) ? (result as GeneratedBtcEntry[]) : [];
    },
    getSubaccounts(req) {
      return request<Subaccount[]>({ method: 'GET', path: '/api/user/sub_account' }, opts, req);
    },
    getSubaccountSummary(id, token, req) {
      const q = new URLSearchParams({ token }).toString();
      return request<SubaccountSummary>(
        { method: 'GET', path: `/api/user/sub_account/${encodeURIComponent(id)}/summary?${q}` },
        opts,
        req,
      );
    },
    getSubaccountWorkers(id, token, req) {
      const q = new URLSearchParams({ token }).toString();
      return request<WorkersResponse>(
        { method: 'GET', path: `/api/user/sub_account/${encodeURIComponent(id)}/workers?${q}` },
        opts,
        req,
      );
    },
    getPermissions(req) {
      return request<AccountPermissions>({ method: 'GET', path: '/api/user/permissions' }, opts, req);
    },
    async getWatcherLinks(req) {
      // A bare array (empty account -> []). Tolerate a non-array response by
      // collapsing to [] so the page shows its empty state instead of throwing.
      const result = await request<unknown>({ method: 'GET', path: '/api/api-tokens' }, opts, req);
      return Array.isArray(result) ? (result as WatcherLink[]) : [];
    },
    createWatcherLink(input, req) {
      // Snake_case body: the account the link may read, plus the scopes it grants.
      return request<WatcherLink>(
        {
          method: 'POST',
          path: '/api/api-tokens',
          body: { target_user_id: input.targetUserId, scopes: input.scopes },
        },
        opts,
        req,
      );
    },
    revokeWatcherLink(id, req) {
      return request<void>(
        { method: 'DELETE', path: `/api/api-tokens/${encodeURIComponent(id)}` },
        opts,
        req,
      );
    },
    createSubaccount(input: CreateSubaccountInput, req) {
      // Snake_case body (bundle-verified). The create endpoint takes only the name
      // and payout address; unlike the standalone /api/bitcoin_address it does not
      // require a 2FA token.
      return request<void>(
        {
          method: 'POST',
          path: '/api/user/sub_account',
          body: { sub_account: input.name, bitcoin_address: input.bitcoinAddress },
        },
        opts,
        req,
      );
    },
    logSubaccount(ownerToken, subaccountToken, req) {
      // Issues a subaccount session for the "open in a new logged-in tab" flow.
      // owner_token = the master session token; subaccount_token = the row's token.
      return request<DmndSession>(
        {
          method: 'POST',
          path: '/api/log_subaccount',
          body: { owner_token: ownerToken, subaccount_token: subaccountToken },
        },
        opts,
        req,
      );
    },
  };
}

let activeClient: DmndClient = createDmndClient();

export function setDmndClient(client: DmndClient): void {
  activeClient = client;
}

export function getDmndClient(): DmndClient {
  return activeClient;
}
