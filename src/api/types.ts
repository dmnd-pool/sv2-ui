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

/**
 * Broker login (`/api/broker/log`) and signup (`/api/brokers`) return the broker
 * id, email, and a referral/reference code. The spec spells that code two ways
 * (login `referenceCode`, signup `reference_code`); the client normalizes both
 * to `referenceCode`. Brokers are a separate auth tree from miners: no token,
 * cookie-based session.
 */
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
  brokerLogin(email: string, password: string, req?: RequestOptions): Promise<BrokerAccount>;
  brokerSignup(input: BrokerSignupInput, req?: RequestOptions): Promise<BrokerAccount>;
}
