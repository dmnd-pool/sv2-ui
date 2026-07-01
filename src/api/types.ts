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
 * One point in the hashrate time series (GET /api/user/hashrate/historical,
 * verified live: a dense array, ~one sample every two minutes). The date field is
 * `observed_at`, matching the live snapshot; callers downsample before charting.
 */
export interface HashratePoint {
  observed_at: string;
  pplns_hashrate: number;
  fpps_hashrate: number;
  total_hashrate: number;
  account_id?: number;
}

/**
 * A single worker row (GET /api/workers and /api/workers/all). Per the spec the
 * numeric fields are nullable and `connected_at` is a unix timestamp.
 */
export interface Worker {
  name: string;
  hashrate: number | null;
  total_shares: number | null;
  rejected_shares: number | null;
  fpps_total_shares?: number | null;
  fpps_rejected_shares?: number | null;
  is_connected: boolean;
  connected_at?: number | null;
  is_fpps?: boolean | null;
}

/** Paginated workers response (verified live: { workers, next_cursor }). */
export interface WorkersResponse {
  workers: Worker[];
  next_cursor: string | null;
}

/** The account's pool payout addresses (GET /api/payouts/addresses, verified live). */
export interface PayoutAddresses {
  fpps_payout_address: string;
  pplns_payout_address: string;
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
   * Hashrate time series for the performance chart over an RFC3339 [from, to]
   * window (GET /api/user/hashrate/historical). The result is dense, so callers
   * downsample before charting; a non-array response still collapses to [].
   */
  getHashrateHistory(from: string, to: string, req?: RequestOptions): Promise<HashratePoint[]>;
  /** One page of workers for a date range (GET /api/workers); used by the workers page. */
  getWorkers(from: string, to: string, req?: RequestOptions): Promise<WorkersResponse>;
  /** The full worker roster (GET /api/workers/all, following every page); home counts. */
  getAllWorkers(req?: RequestOptions): Promise<Worker[]>;
  /** The account's FPPS + PPLNS payout addresses, used to compute today's earnings. */
  getPayoutAddresses(req?: RequestOptions): Promise<PayoutAddresses>;
}
