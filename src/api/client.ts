import { decodeGeneratedBtc } from './generatedBtc';
import { requireArray } from './response';
import {
  type AccountPermissions,
  type BrokerAccount,
  type BrokerMiner,
  type BrokerSignupInput,
  type CreateSubaccountInput,
  DmndApiError,
  isAuthenticatorCodeError,
  type DmndClient,
  type DmndSession,
  type HashratePoint,
  type HashrateSnapshot,
  type PayoutQuery,
  type PayoutRecord,
  type WatcherLink,
  type CreatedWatcherLink,
  type RequestOptions,
  type SignupInput,
  type Subaccount,
  type SubaccountShareStats,
  type SubaccountSummary,
  type Worker,
  type WorkersResponse,
} from './types';
import { fetchHashrateHistory } from './hashrateHistory';
import { API_ERROR_MESSAGES } from './errorMessages';
import { decodePplnsProjection, pplnsProjectionMatchesAccount } from './pplnsProjection';

// The DMND dashboard API is called directly: it sets CORS for our origin and
// allows credentials, so the browser sends the HttpOnly session cookie on every
// call. Overridable for production via VITE_DMND_API_BASE; defaults to staging
// so dev and review never hit production.
export const API_BASE =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DMND_API_BASE ??
  'https://staging-user-dashboard-server.dmnd.work';

/** Default retry profile. Stateful authentication calls override this below. */
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

export interface DmndAuthRejection {
  /** The account whose cookie/header pair the backend rejected. */
  accountId: string | null;
}

type AuthRejectionListener = (rejection: DmndAuthRejection) => void;

const authRejectionListeners = new Set<AuthRejectionListener>();

/**
 * Reports a rejected authenticated request to the auth layer. This keeps the
 * transport independent of React while allowing an expired HttpOnly cookie to
 * end the matching browser session immediately instead of becoming a page error.
 */
export function subscribeToDmndAuthRejections(listener: AuthRejectionListener): () => void {
  authRejectionListeners.add(listener);
  return () => authRejectionListeners.delete(listener);
}

function reportAuthRejection(rejection: DmndAuthRejection): void {
  for (const listener of authRejectionListeners) {
    try {
      listener(rejection);
    } catch {
      // A UI listener must never replace the API error the caller expects.
    }
  }
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
  /** A 401 may reject the second factor while the session remains valid. */
  stepUp?: boolean;
  /** Per-call timeout override (ms). Dense responses (the historical series) need more than the interactive default. */
  timeoutMs?: number;
  /** Per-call retry override. Stateful requests should not be replayed automatically. */
  maxAttempts?: number;
  /** An auth failure is expected while probing for an optional account session. */
  suppressAuthRejection?: boolean;
}

interface PayoutPage {
  payouts: PayoutRecord[];
  next_cursor: string | null;
}

async function request<T>(
  spec: RequestSpec,
  opts: ResolvedOptions,
  req: RequestOptions = {},
): Promise<T> {
  let lastError: unknown = null;
  const maxAttempts = spec.maxAttempts ?? opts.maxAttempts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (req.signal?.aborted) throw new DmndApiError(API_ERROR_MESSAGES.cancelled, 'network');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const requestAccountId = req.accountId ?? accountId;
    if (requestAccountId && !spec.omitAccountId) {
      headers['X-Account-ID'] = requestAccountId;
    }

    if (spec.stepUp && req.totpToken) headers['X-TOTP-Token'] = req.totpToken;

    try {
      const response = await opts.fetchImpl(`${API_BASE}${spec.path}`, {
        method: spec.method,
        headers,
        // Authentication is cookie-based, so direct calls to the configured API
        // origin must include the HttpOnly session cookie.
        credentials: 'include',
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: combineSignals(spec.timeoutMs ?? opts.requestTimeoutMs, req.signal),
      });

      if (response.status === 401 || response.status === 403) {
        const error = new DmndApiError(
          (await readErrorMessage(response)) ?? API_ERROR_MESSAGES.unauthorized,
          'unauthorized',
          response.status,
        );
        if (response.status === 401 && !spec.suppressAuthRejection && !spec.omitAccountId && requestAccountId &&
            !(spec.stepUp && isAuthenticatorCodeError(error))) {
          reportAuthRejection({ accountId: requestAccountId });
        }
        throw error;
      }
      const serverMessage = response.ok ? undefined : await readErrorMessage(response);
      if (response.status >= 500) {
        if (serverMessage === 'Invalid referral code') {
          throw new DmndApiError("Invalid referral code", 'other');
        }
        lastError = new DmndApiError(API_ERROR_MESSAGES.server, 'server', response.status);
      } else if (!response.ok) {
        // 4xx with a server message (e.g. weak password) surfaces that message.
        throw new DmndApiError(serverMessage || 'Something went wrong. Please try again.', 'other', response.status);
      } else {
        const text = await response.text();
        return (text ? JSON.parse(text) : undefined) as T;
      }
    } catch (err) {
      // Auth and client errors are final; only transient failures retry.
      if (err instanceof DmndApiError && (err.code === 'unauthorized' || err.code === 'other')) {
        throw err;
      }
      lastError = err;
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, opts.backoffMs));
    }
  }

  if (lastError instanceof DmndApiError) throw lastError;
  throw new DmndApiError(API_ERROR_MESSAGES.network, 'network');
}

/** Read one account's unscaled H/s history, splitting server-limited date ranges. */
function requestRawHashrateHistory(
  from: string,
  to: string,
  opts: ResolvedOptions,
  req: RequestOptions,
  suppressAuthRejection = false,
): Promise<HashratePoint[]> {
  return fetchHashrateHistory(from, to, async (start, end) => {
    const params = new URLSearchParams({ from: start, to: end });
    const result = await request<unknown>(
      {
        method: 'GET',
        path: `/api/v1/user/hashrate/historical?${params}`,
        timeoutMs: 20_000,
        suppressAuthRejection,
      },
      opts,
      req,
    );
    return requireArray<HashratePoint>(result);
  });
}

/** Follow the cursor API so callers always receive the complete requested window. */
async function requestAllPayouts(
  path: string,
  query: PayoutQuery,
  opts: ResolvedOptions,
  req: RequestOptions,
): Promise<PayoutRecord[]> {
  const payouts: PayoutRecord[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const params = new URLSearchParams({ limit: '100' });
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (cursor) params.set('cursor', cursor);
    const page = await request<PayoutPage>(
      { method: 'GET', path: `${path}?${params.toString()}`, timeoutMs: 20_000 },
      opts,
      req,
    );
    if (!Array.isArray(page.payouts)) throw new Error('Invalid payouts response');
    payouts.push(...page.payouts);
    if (!page.next_cursor || page.payouts.length === 0 || seen.has(page.next_cursor)) break;
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  return payouts;
}

export function createUser(options: DmndClientOptions = {}): DmndClient {
  const opts = resolveOptions(options);
  const issueSubaccountSession = (
    ownerToken: string,
    subaccountToken: string,
    req: RequestOptions = {},
  ) => request<DmndSession>(
    {
      method: 'POST',
      path: '/api/log_subaccount',
      body: { owner_token: ownerToken, subaccount_token: subaccountToken },
      maxAttempts: 1,
    },
    opts,
    req,
  );

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
    login(email, password, totpToken, req) {
      // The endpoint requires `language` (the dashboard hardcodes "En");
      // without it Rocket fails to deserialize the body and returns 422.
      return request<DmndSession>(
        {
          method: 'POST',
          path: '/api/log_user',
          timeoutMs: 30_000,
          maxAttempts: 1,
          body: {
            email,
            password,
            language: 'En',
            ...(totpToken ? { totp_token: totpToken } : {}),
          },
        },
        opts,
        req,
      );
    },
    logout(req) {
      return request<void>({ method: 'POST', path: '/api/logout' }, opts, req);
    },
    checkAuth(req) {
      // Validate the selected dashboard session on startup and profile refresh.
      return request<DmndSession>({ method: 'GET', path: '/api/check_auth' }, opts, req);
    },
    forgotPassword(email, req) {
      return request<void>({ method: 'POST', path: '/api/forgot_password', body: { email } }, opts, req);
    },
    resetPassword(email, code, twoFaCode, newPassword, req) {
      // Recovery fields: `code` comes from the email link, the
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
      // session rides in the cookie + X-Account-ID header).
      return request<DmndSession>(
        { method: 'PUT', path: '/api/activate_2fa', body: { token: code }, stepUp: true, maxAttempts: 1 },
        opts,
        req,
      );
    },
    newTwoFactor(req) {
      // Fetch one pending secret; activation confirms it using the new factor's code.
      return request<DmndSession>(
        { method: 'GET', path: '/api/new_2fa', stepUp: true, maxAttempts: 1 }, opts, req,
      );
    },
    setBitcoinAddress(address, twoFaToken, req) {
      // For the selected session, sub_account_id is null for the master
      // account. The API rejects an empty/missing two_fa_token with a
      // 2FA-required error, which the Bitcoin step uses to prompt for the code.
      return request<void>(
        {
          method: 'POST',
          path: '/api/bitcoin_address',
          stepUp: true,
          maxAttempts: 1,
          body: { bitcoin_address: address, two_fa_token: twoFaToken, sub_account_id: null },
        },
        opts,
        req,
      );
    },
    brokerLogin(email, password, req) {
      return request<BrokerAccount>(
        { method: 'POST', path: '/api/broker/log', body: { email, password }, omitAccountId: true },
        opts,
        req,
      );
    },
    brokerMiners(fromBlockHeight, req) {
      // Broker calls are cookie-authenticated and must never carry the miner
      // account header. Omitting the height makes the server fail with
      // "from_block_height is required".
      return request<BrokerMiner[]>(
        {
          method: 'GET',
          path: `/api/broker/miners?from_block_height=${encodeURIComponent(String(fromBlockHeight))}`,
          omitAccountId: true,
        },
        opts,
        req,
      );
    },
    brokerSignup(input: BrokerSignupInput, req) {
      return request<BrokerAccount>(
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
    },
    getHashrate(req) {
      return request<HashrateSnapshot>({ method: 'GET', path: '/api/user/hashrate' }, opts, req);
    },
    getHashrateHistory(from, to, req) {
      return requestRawHashrateHistory(from, to, opts, req ?? {});
    },
    async getSubaccountHashrateHistory(id, from, to, ownerToken, subaccountToken, req) {
      const ownerRequest = req ?? {};
      try {
        // A previously opened subaccount already has its own HttpOnly cookie. Probe it
        // first so chart polling and page reloads do not rotate sessions unnecessarily.
        return await requestRawHashrateHistory(
          from,
          to,
          opts,
          { ...ownerRequest, accountId: id },
          true,
        );
      } catch (error) {
        if (!(error instanceof DmndApiError) || error.status !== 401) throw error;
      }

      // The master-authorized account switch flow issues the missing subaccount cookie.
      // Its returned id is authoritative for the cookie name and subsequent header.
      const subaccountSession = await issueSubaccountSession(ownerToken, subaccountToken, ownerRequest);
      return requestRawHashrateHistory(
        from,
        to,
        opts,
        { ...ownerRequest, accountId: String(subaccountSession.id) },
      );
    },
    getShareStats(req) {
      return request<SubaccountShareStats>({ method: 'GET', path: '/api/user/share_stats' }, opts, req);
    },
    async getAllWorkers(req) {
      // The roster is paginated (default 200, max 1000). Follow next_cursor to the end
      // so the roster is the full list however large the account is; a repeated or
      // already-seen cursor means the server is looping and ends the walk.
      const all: Worker[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      for (;;) {
        const params = new URLSearchParams({ limit: '1000' });
        if (cursor) params.set('cursor', cursor);
        const res = await request<WorkersResponse>(
          { method: 'GET', path: `/api/workers/all?${params.toString()}` },
          opts,
          req,
        );
        all.push(...res.workers);
        if (!res.next_cursor || res.workers.length === 0 || seen.has(res.next_cursor)) break;
        seen.add(res.next_cursor);
        cursor = res.next_cursor;
      }
      return all;
    },
    getPayouts(query = {}, req = {}) {
      return requestAllPayouts('/api/v1/user/payouts', query, opts, req);
    },
    async getGeneratedBtc(req) {
      const result = await request<unknown>(
        { method: 'GET', path: '/api/generated_btc', timeoutMs: 20_000 }, opts, req,
      );
      return decodeGeneratedBtc(result);
    },
    getSubaccounts(req) {
      return request<Subaccount[]>({ method: 'GET', path: '/api/user/sub_account' }, opts, req);
    },
    getSubaccountSummary(id, req) {
      return request<SubaccountSummary>(
        { method: 'GET', path: `/api/user/sub_account/${encodeURIComponent(id)}/summary` },
        opts,
        req,
      );
    },
    async getSubaccountWorkers(id, req) {
      const workers: Worker[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      for (;;) {
        const params = new URLSearchParams({ limit: '1000' });
        if (cursor) params.set('cursor', cursor);
        const page = await request<WorkersResponse>(
          {
            method: 'GET',
            path: `/api/user/sub_account/${encodeURIComponent(id)}/workers?${params.toString()}`,
          },
          opts,
          req,
        );
        workers.push(...page.workers);
        if (!page.next_cursor || page.workers.length === 0 || seen.has(page.next_cursor)) break;
        seen.add(page.next_cursor);
        cursor = page.next_cursor;
      }
      return { workers, next_cursor: null };
    },
    async getSubaccountGeneratedBtc(id, req) {
      const result = await request<unknown>(
        { method: 'GET', path: `/api/user/sub_account/${encodeURIComponent(id)}/generated_btc`, timeoutMs: 20_000 },
        opts,
        req,
      );
      return decodeGeneratedBtc(result);
    },
    getSubaccountPayouts(id, query = {}, req = {}) {
      return requestAllPayouts(
        `/api/v1/user/sub_account/${encodeURIComponent(id)}/payouts`,
        query,
        opts,
        req,
      );
    },
    getPermissions(req) {
      return request<AccountPermissions>({ method: 'GET', path: '/api/user/permissions' }, opts, req);
    },
    async getWatcherLinks(req) {
      const result = await request<unknown>({ method: 'GET', path: '/api/api-tokens' }, opts, req);
      return requireArray<WatcherLink>(result);
    },
    createWatcherLink(input, req) {
      // Snake_case body: the account the link may read, plus the scopes it grants.
      return request<CreatedWatcherLink>(
        {
          method: 'POST',
          path: '/api/api-tokens',
          stepUp: true,
          maxAttempts: 1,
          body: { target_user_id: input.targetUserId, scopes: input.scopes },
        },
        opts,
        req,
      );
    },
    revokeWatcherLink(id, req) {
      return request<void>(
        { method: 'DELETE', path: `/api/api-tokens/${encodeURIComponent(id)}`, stepUp: true, maxAttempts: 1 },
        opts,
        req,
      );
    },
    createSubaccount(input: CreateSubaccountInput, req) {
      // The request uses snake_case fields. The create endpoint takes only the name
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
      // The server requires the owner session; the body fields are mining credentials.
      return issueSubaccountSession(ownerToken, subaccountToken, req);
    },
    async getPplnsProjection(id, req) {
      try {
        const payload = await request<unknown>(
          { method: 'GET', path: `/api/user/sub_account/${encodeURIComponent(id)}/pplns_projection` },
          opts,
          req,
        );
        const projection = decodePplnsProjection(payload);
        if (!pplnsProjectionMatchesAccount(projection, id)) {
          throw new Error('PPLNS projection account does not match the request');
        }
        return projection;
      } catch (err) {
        if (err instanceof DmndApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}

let activeClient: DmndClient = createUser();

export function setDmndClient(client: DmndClient): void {
  activeClient = client;
}

export function getUser(): DmndClient {
  return activeClient;
}
