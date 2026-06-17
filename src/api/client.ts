import {
  DmndApiError,
  type DmndClient,
  type DmndSession,
  type RequestOptions,
  type SignupInput,
} from './types';

// The DMND dashboard API is called directly: it sets CORS for our origin and
// allows credentials, so the browser sends the HttpOnly session cookie on every
// call. Overridable for production via VITE_DMND_API_BASE; defaults to staging
// so dev and review never hit production.
const API_BASE =
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
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
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
    if (accountId) headers['X-Account-ID'] = accountId;

    try {
      const response = await opts.fetchImpl(`${API_BASE}${spec.path}`, {
        method: spec.method,
        headers,
        // DMND auth is cookie-based; send the session cookie on every call. The
        // proxy relays the login Set-Cookie back (de-Secured in dev).
        credentials: 'include',
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: combineSignals(opts.requestTimeoutMs, req.signal),
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
  throw new DmndApiError('Cannot reach DMND cloud API', 'network');
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
  };
}

let activeClient: DmndClient = createDmndClient();

export function setDmndClient(client: DmndClient): void {
  activeClient = client;
}

export function getDmndClient(): DmndClient {
  return activeClient;
}
