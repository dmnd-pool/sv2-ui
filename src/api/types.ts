export type DmndApiErrorCode = 'unauthorized' | 'network' | 'server' | 'unknown';

export class DmndApiError extends Error {
  constructor(
    message: string,
    public readonly code: DmndApiErrorCode,
  ) {
    super(message);
    this.name = 'DmndApiError';
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * The user/session object returned by /api/log_user (verified live). `token` is
 * the SV2 pool credential and the auth carrier; `api_token` is for the public
 * API. The remaining fields model the full login response; only `token`, `id`,
 * and `email` are used today.
 */
export interface DmndSession {
  token: string;
  /** Account id; sent back as X-Account-ID on authed calls. Always present in real responses. */
  id: string;
  email: string;
  two_factor_secret: string | null;
  bitcoin_addresses?: Record<string, unknown> | string[];
  language?: string;
  active?: boolean;
  api_token?: string;
  fpps_token?: string;
  selling_hash_rate?: boolean;
}

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  companyLocation?: string;
  referralCode?: string;
}

export interface BrokerAccount {
  id: string | number;
  email: string;
  referenceCode: string;
}

export interface BrokerSignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companyLocation: string;
}

/**
 * Live hashrate snapshot (GET /api/user/hashrate, verified live). Carries
 * total_hashrate and an observed_at timestamp in addition to the per-scheme
 * rates. All hashrates are H/s.
 */
export interface HashrateSnapshot {
  pplns_hashrate: number;
  fpps_hashrate: number;
  total_hashrate: number;
  observed_at?: string;
  account_id?: number;
}

/** Chart range options (from the dashboard bundle). Custom date range is deferred. */
export type HashrateRange = '1H' | '1D' | '7D' | '30D';

/**
 * One point in the hashrate time series for the performance chart. The point
 * shape (timestamp + per-scheme rates) is confirmed from the dashboard bundle;
 * the populated endpoint response is not yet verifiable on a no-activity account.
 */
export interface HashratePoint {
  timestamp: string;
  pplns_hashrate: number;
  fpps_hashrate: number;
  total_hashrate: number;
}

/** A single worker row (GET /api/workers). Field names confirmed from the bundle. */
export interface Worker {
  name: string;
  hashrate: number;
  total_shares: number;
  rejected_shares: number;
  fpps_total_shares?: number;
  fpps_rejected_shares?: number;
  is_connected: boolean;
  connected_at?: string | null;
  is_fpps?: boolean;
}

/** Paginated workers response (verified live: { workers, next_cursor }). */
export interface WorkersResponse {
  workers: Worker[];
  next_cursor: string | null;
}

// Auth is cookie-based: once login sets the session cookie, the proxy forwards
// it on every call, so these methods don't take a token argument.
export interface DmndClient {
  signup(input: SignupInput, req?: RequestOptions): Promise<void>;
  login(email: string, password: string, req?: RequestOptions): Promise<DmndSession>;
  logout(req?: RequestOptions): Promise<void>;
  /** Validates the session cookie (used on app startup to restore a session). */
  checkAuth(req?: RequestOptions): Promise<DmndSession>;
  forgotPassword(email: string, req?: RequestOptions): Promise<void>;
  resetPassword(
    email: string,
    code: string,
    twoFaCode: string,
    newPassword: string,
    req?: RequestOptions,
  ): Promise<void>;
  /** Confirm TOTP setup with the 6-digit code from the authenticator app. */
  activate2fa(code: string, req?: RequestOptions): Promise<void>;
  /**
   * Set the payout address. The API requires a live `two_fa_token`; pass an
   * empty string to let the caller detect a 2FA-required response and prompt
   * for the code (the try-then-ask flow the Bitcoin step uses).
   */
  setBitcoinAddress(address: string, twoFaToken: string, req?: RequestOptions): Promise<void>;
  brokerLogin(email: string, password: string, req?: RequestOptions): Promise<BrokerAccount>;
  brokerSignup(input: BrokerSignupInput, req?: RequestOptions): Promise<BrokerAccount>;
  /** Live hashrate snapshot for the account (auto-polled on the home). */
  getHashrate(req?: RequestOptions): Promise<HashrateSnapshot>;
  /**
   * Hashrate time series for the performance chart. The populated shape is not
   * yet confirmable on a no-activity account, so the implementation tolerates a
   * non-array response and returns [] (the chart's empty state).
   */
  getHashrateHistory(range: HashrateRange, req?: RequestOptions): Promise<HashratePoint[]>;
  /** Per-worker roster for a date range; drives the worker stat cards. */
  getWorkers(from: string, to: string, req?: RequestOptions): Promise<WorkersResponse>;
}
