import type { GeneratedBtcEntry } from './generatedBtc';
import type { PplnsProjection } from './pplnsProjection';

export type {
  PplnsProjection,
  PplnsProjectionDailyWork,
  PplnsProjectionHorizon,
} from './pplnsProjection';

export type DmndApiErrorCode = 'unauthorized' | 'network' | 'server' | 'other';

export class DmndApiError extends Error {
  constructor(
    message: string,
    public readonly code: DmndApiErrorCode,
    /**
     * The HTTP status behind the failure, set whenever the server answered with one.
     */
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'DmndApiError';
  }
}

/** The current step-up rejection is distinct from an expired dashboard session. */
export function isAuthenticatorCodeError(error: unknown): boolean {
  return error instanceof DmndApiError && error.status === 401 && error.message === 'Invalid authenticator code';
}

export interface RequestOptions {
  signal?: AbortSignal;
  accountId?: string;
  /** Current authenticator code for key management and replacing enrolled 2FA. */
  totpToken?: string;
}

/**
 * Account data returned by session endpoints. `token` and `fpps_token` are mining
 * credentials; dashboard authentication uses the separate HttpOnly cookie.
 */
export interface DmndSession {
  token: string;
  /** Account id; sent back as X-Account-ID on authed calls. Always present in real responses. */
  id: string;
  email: string;
  company_name: string | null;
  company_primary_location: string | null;
  kyb_status: 'NotStarted' | 'InReview' | 'Approved' | 'Rejected';
  two_factor_secret: string | null;
  bitcoin_addresses: Record<string, boolean>;
  language?: string;
  active?: boolean;
  fpps_token?: string | null;
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

/**
 * A miner assigned to a broker's referral code, from `GET /api/broker/miners`.
 */
export interface BrokerMiner {
  id: string;
  name: string;
  hashrate: number;
  /** A work counter, not an earnings figure: no endpoint returns broker earnings. */
  total_work: number;
  /** Fractional rate (0.02 = 2%), as stored in users_data. */
  broker_fee: number;
}

export interface BrokerAccount {
  id: string;
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
 * Live hashrate snapshot (GET /api/user/hashrate). Carries
 * total_hashrate and an observed_at timestamp in addition to the per-scheme
 * rates. All hashrates are H/s.
 */
export interface HashrateSnapshot {
  pplns_hashrate: number;
  fpps_hashrate: number;
  total_hashrate: number;
  observed_at?: string | null;
  account_id: string;
}

/** Preset chart ranges; custom windows are supplied as explicit timestamps. */
export type HashrateRange = '1H' | '6H' | '24H' | '7D';

/**
 * One point in the hashrate time series (GET /api/user/hashrate/historical,
 * a dense array sampled about every two minutes). The date field is
 * `observed_at`, matching the live snapshot; callers downsample before charting.
 */
export interface HashratePoint {
  observed_at: string;
  pplns_hashrate: number;
  fpps_hashrate: number;
  total_hashrate: number;
  /** Absent on chart points composed from multiple accounts. */
  account_id?: string;
}

/**
 * A single worker row (GET /api/workers and /api/workers/all). The
 * numeric fields are nullable and `connected_at` is Unix milliseconds.
 */
export interface Worker {
  name: string;
  hashrate: number | null;
  total_shares: number | null;
  rejected_shares: number | null;
  fpps_hashrate?: number | null;
  fpps_total_shares?: number | null;
  fpps_rejected_shares?: number | null;
  is_connected: boolean;
  connected_at?: number | null;
}

/** Paginated workers response (verified live: { workers, next_cursor }). */
export interface WorkersResponse {
  workers: Worker[];
  next_cursor: string | null;
}

/** One confirmed payout output returned by the v1 payout-history endpoints. */
export interface PayoutRecord {
  txid: string;
  output_index: number;
  kind: 'fpps' | 'pplns';
  address: string;
  amount_sats: number;
  confirmed_at: number;
}

/** Optional inclusive UTC date window (`YYYY-MM-DD`); the server defaults to 30 days. */
export interface PayoutQuery {
  from?: string;
  to?: string;
}

export type { GeneratedBtcEntry } from './generatedBtc';

/**
 * Accepted/rejected share counts for a subaccount over a window
 * (GET /api/user/sub_account/{id}/share_stats). Rejection rate is
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
 * Pool + broker fee rates expressed as fractions (0.02 = 2%).
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
  fpps_token: string | null;
  hashrate: string;
  bitcoin_addresses: Record<string, boolean>;
}

/** GET /api/user/sub_account/{id}/summary: stats, fractional fees, and today's FPPS BTC. */
export interface SubaccountSummary {
  sub_account_id: string;
  hashrate: HashrateSnapshot;
  share_stats: SubaccountShareStats;
  fees: SubaccountFees;
  today_generated_btc: number | null;
}

/**
 * The read-only data a watcher link may access. One scope per data surface; the
 * link's holder can read nothing else.
 */
export type WatcherScope = 'hashrate_read' | 'workers_read' | 'earnings_read' | 'rejects_read' | 'fees_read';

/**
 * A watcher link (GET /api/api-tokens). `user_id` is the account the
 * link can read (the master account or one of its subaccounts) and is what the
 * shareable URL embeds alongside `token`. Secrets unavailable for historical keys
 * are null; `expires_at` is null for non-expiring keys.
 */
export interface WatcherLink {
  id: string;
  user_id: string;
  token: string | null;
  token_prefix: string;
  last_used_at: string | null;
  owner_email: string;
  owner_first_name: string | null;
  scopes: WatcherScope[];
  created_at: string;
  expires_at: string | null;
}

/** Creation returns the secret and scope, without list-only ownership metadata. */
export interface CreatedWatcherLink {
  id: string;
  user_id: string;
  token: string;
  scopes: WatcherScope[];
  expires_at: string | null;
}

/** The fields the create-watcher-link form collects (mapped to the snake_case body). */
export interface CreateWatcherLinkInput {
  targetUserId: string;
  scopes: WatcherScope[];
}

/** Account capability flags (GET /api/user/permissions; snake_case). */
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

// The browser includes the dashboard session cookie and X-Account-ID on authenticated calls.
export interface DmndClient {
  signup(input: SignupInput, req?: RequestOptions): Promise<void>;
  /**
   * Signs in with email/password and, for an enrolled account, the current
   * authenticator code. Omitting `totpToken` lets the server signal that the
   * second factor is required without issuing a session cookie.
   */
  login(email: string, password: string, totpToken?: string, req?: RequestOptions): Promise<DmndSession>;
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
  activate2fa(code: string, req?: RequestOptions): Promise<DmndSession>;
  /**
   * Fetch a fresh 2FA provisioning secret to re-set-up (reset) two-factor auth,
   * returning the session object with a non-null `two_factor_secret`. A GET, so it
   * does not itself change the live secret; activate2fa commits the new one.
   * Both calls require the current factor in req.totpToken for enrolled accounts.
   */
  newTwoFactor(req?: RequestOptions): Promise<DmndSession>;
  /**
   * Set the payout address. The API requires a live `two_fa_token`; pass an
   * empty string to let the caller detect a 2FA-required response and prompt
   * for the code (the try-then-ask flow the Bitcoin step uses).
   */
  setBitcoinAddress(address: string, twoFaToken: string, req?: RequestOptions): Promise<void>;
  brokerLogin(email: string, password: string, req?: RequestOptions): Promise<BrokerAccount>;
  /**
   * The miners assigned to this broker's referral code. `fromBlockHeight` is
   * required by the server (it 500s without it) and is sent as `from_block_height`;
   * camelCase is rejected.
   */
  brokerMiners(fromBlockHeight: number, req?: RequestOptions): Promise<BrokerMiner[]>;
  brokerSignup(input: BrokerSignupInput, req?: RequestOptions): Promise<BrokerAccount>;
  /** Live hashrate snapshot for the account (auto-polled on the home). */
  getHashrate(req?: RequestOptions): Promise<HashrateSnapshot>;
  /**
   * Hashrate time series for the performance chart over an RFC3339 [from, to]
   * window (GET /api/user/hashrate/historical). The result is dense, so callers
   * downsample before charting. Windows longer than seven days use successive requests.
   */
  getHashrateHistory(from: string, to: string, req?: RequestOptions): Promise<HashratePoint[]>;
  /** The account's own 24h accepted/rejected counts (GET /api/user/share_stats). */
  getShareStats(req?: RequestOptions): Promise<SubaccountShareStats>;
  /**
   * Raw H/s history for an owned subaccount. Reuses its dashboard cookie when one
   * exists, otherwise issues that cookie through the owner's account-switch flow.
   */
  getSubaccountHashrateHistory(
    id: string,
    from: string,
    to: string,
    ownerToken: string,
    subaccountToken: string,
    req?: RequestOptions,
  ): Promise<HashratePoint[]>;
  /** The full worker roster (GET /api/workers/all, following every page); home counts. */
  getAllWorkers(req?: RequestOptions): Promise<Worker[]>;
  /** Confirmed payouts for the account tree, following every server page. */
  getPayouts(query?: PayoutQuery, req?: RequestOptions): Promise<PayoutRecord[]>;
  /** The account's daily generated-BTC entries (GET /api/generated_btc); a bare array, empty when none. */
  getGeneratedBtc(req?: RequestOptions): Promise<GeneratedBtcEntry[]>;
  /** The account's subaccounts (master only); a lightweight list, enriched per-row. */
  getSubaccounts(req?: RequestOptions): Promise<Subaccount[]>;
  /** Session-authenticated summary for a subaccount owned by the signed-in master. */
  getSubaccountSummary(id: string, req?: RequestOptions): Promise<SubaccountSummary>;
  /** Session-authenticated live worker roster for an owned subaccount. */
  getSubaccountWorkers(id: string, req?: RequestOptions): Promise<WorkersResponse>;
  /** Session-authenticated daily generated-BTC entries for an owned subaccount. */
  getSubaccountGeneratedBtc(id: string, req?: RequestOptions): Promise<GeneratedBtcEntry[]>;
  /** Confirmed payouts for one owned subaccount, following every server page. */
  getSubaccountPayouts(id: string, query?: PayoutQuery, req?: RequestOptions): Promise<PayoutRecord[]>;
  /** Capability flags gating the Create button and the page itself. */
  getPermissions(req?: RequestOptions): Promise<AccountPermissions>;
  /** The account's watcher links (GET /api/api-tokens); a bare array, empty when none. */
  getWatcherLinks(req?: RequestOptions): Promise<WatcherLink[]>;
  /** Issue a watcher link for one account (master or subaccount) with the given scopes. */
  createWatcherLink(input: CreateWatcherLinkInput, req?: RequestOptions): Promise<CreatedWatcherLink>;
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
  /**
   * The cached PPLNS projection for an account (GET /api/user/sub_account/{id}/pplns_projection),
   * including its source metadata, horizon scenarios, and daily work. Returns null
   * when no projection is available yet (404 / cache not refreshed).
   */
  getPplnsProjection(id: string, req?: RequestOptions): Promise<PplnsProjection | null>;
}
