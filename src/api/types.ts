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
export type HashrateRange = '1H' | '6H' | '24H' | '7D';

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

/**
 * One daily generated-BTC entry (GET /api/generated_btc, verified live).
 * `entry_day` is a date string (YYYY-MM-DD), `hashrate` is that day's average in
 * H/s, and `btc_generated` is the gross BTC accrued that day before payout
 * adjustments. The endpoint returns a bare array (empty account -> []).
 */
export interface GeneratedBtcEntry {
  entry_day: string;
  hashrate: number;
  btc_generated: number;
  // Which account this day's entry belongs to, set only in aggregated mode where rows
  // span the main account and every subaccount.
  account?: string;
}

/**
 * Accepted/rejected share counts for a subaccount over a window
 * (GET /api/user/sub_account/{id}/share_stats, verified live). Rejection rate is
 * derived from `rejected / (accepted + rejected)`.
 */
export interface SubaccountShareStats {
  window_hours: number;
  pplns_accepted: number;
  pplns_rejected: number;
  fpps_accepted: number;
  fpps_rejected: number;
  accepted: number;
  rejected: number;
}

/**
 * Pool + broker fee rates, already expressed in percent (2 = 2%), per the spec's
 * `/api/user/fees` "rates (%)" and prod's "Pool fee %" / "Broker fee %" columns.
 * From GET /api/user/fees and GET /api/user/sub_account/{id}/fees.
 */
export interface SubaccountFees {
  pool_fee: number;
  broker_fee: number;
}

/** A subaccount row from GET /api/user/sub_account. `sub_account` is the name; `hashrate` is a numeric string. */
export interface Subaccount {
  id: string;
  sub_account: string;
  token: string;
  api_token: string;
  fpps_token: string | null;
  hashrate: string;
  bitcoin_addresses: Record<string, boolean>;
}

/** GET /api/user/sub_account/{id}/summary?token= : one response with the row's stats, fees, and today's BTC. */
export interface SubaccountSummary {
  sub_account_id: number;
  hashrate: HashrateSnapshot | null;
  share_stats: SubaccountShareStats | null;
  fees: SubaccountFees | null;
  today_generated_btc: number | null;
}

/**
 * The read-only data a watcher link may access. One scope per data surface; the
 * link's holder can read nothing else.
 */
export type WatcherScope = 'hashrate_read' | 'workers_read' | 'earnings_read' | 'rejects_read' | 'fees_read';

/**
 * A watcher link (GET /api/api-tokens, verified live). `user_id` is the account the
 * link can read (the master account or one of its subaccounts) and is what the
 * shareable URL embeds alongside `token`. `expires_at` is null for links that never
 * expire, which is every link the API issues today.
 */
export interface WatcherLink {
  id: string;
  user_id: string;
  token: string;
  owner_email: string;
  owner_first_name: string | null;
  scopes: WatcherScope[];
  created_at: string;
  expires_at: string | null;
}

/** The fields the create-watcher-link form collects (mapped to the snake_case body). */
export interface CreateWatcherLinkInput {
  targetUserId: string;
  scopes: WatcherScope[];
}

/** Account capability flags (GET /api/user/permissions; snake_case, bundle-verified). */
export interface AccountPermissions {
  view_sub_accounts: boolean;
  create_sub_account: boolean;
  edit_btc_address: boolean;
}

/** Fields the create-subaccount form collects (mapped to the snake_case API body). */
export interface CreateSubaccountInput {
  name: string;
  bitcoinAddress: string;
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
   * Fetch a fresh 2FA provisioning secret to re-set-up (reset) two-factor auth,
   * returning the session object with a non-null `two_factor_secret`. A GET, so it
   * does not itself change the live secret; activate2fa commits the new one.
   */
  newTwoFactor(req?: RequestOptions): Promise<DmndSession>;
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
  /** The account's daily generated-BTC entries (GET /api/generated_btc); a bare array, empty when none. */
  getGeneratedBtc(req?: RequestOptions): Promise<GeneratedBtcEntry[]>;
  /** The account's subaccounts (master only); a lightweight list, enriched per-row. */
  getSubaccounts(req?: RequestOptions): Promise<Subaccount[]>;
  /** Per-subaccount hashrate, share stats, fees, and today's BTC in one response. */
  getSubaccountSummary(id: string, token: string, req?: RequestOptions): Promise<SubaccountSummary>;
  /** Per-subaccount worker roster; active/offline counts derive from this. */
  getSubaccountWorkers(id: string, token: string, req?: RequestOptions): Promise<WorkersResponse>;
  /** The subaccount's daily generated-BTC entries; a bare array, empty when none. */
  getSubaccountGeneratedBtc(id: string, token: string, req?: RequestOptions): Promise<GeneratedBtcEntry[]>;
  /** Capability flags gating the Create button and the page itself. */
  getPermissions(req?: RequestOptions): Promise<AccountPermissions>;
  /** The account's watcher links (GET /api/api-tokens); a bare array, empty when none. */
  getWatcherLinks(req?: RequestOptions): Promise<WatcherLink[]>;
  /** Issue a watcher link for one account (master or subaccount) with the given scopes. */
  createWatcherLink(input: CreateWatcherLinkInput, req?: RequestOptions): Promise<WatcherLink>;
  /** Revoke a watcher link by id; it stops working immediately. */
  revokeWatcherLink(id: string, req?: RequestOptions): Promise<void>;
  /** Create a subaccount under the master account. */
  createSubaccount(input: CreateSubaccountInput, req?: RequestOptions): Promise<void>;
  /**
   * Issue a session for a subaccount so it can be opened in a new, already-logged-in
   * tab. Returns the subaccount session; the caller does NOT swap the current
   * session (the new tab carries its own server-set cookie).
   */
  logSubaccount(ownerToken: string, subaccountToken: string, req?: RequestOptions): Promise<DmndSession>;
}
