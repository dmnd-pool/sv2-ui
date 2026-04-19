import type { PoolAddress } from '@/api/dmnd';

export const FIXED_TTL_MS = 8 * 60 * 60 * 1000;
export const IDLE_TTL_MS = 30 * 60 * 1000;
export const STORAGE_KEY = 'dmnd_session';

/**
 * Session is the opaque DMND token plus the pool address list we received
 * when that token was validated. DMND has no concept of email/role/etc — the
 * token is the only credential, and the pool list is returned from the same
 * call that proves the token is valid. Caching it here means downstream code
 * (pool preset, connection-info card) never needs to re-authenticate.
 */
export interface Session {
  token: string;
  poolUrls: PoolAddress[];
  expiresAt: number;
  idleExpiresAt: number;
}

export interface CreateSessionInput {
  token: string;
  poolUrls: PoolAddress[];
  now?: number;
}

export function createSession(input: CreateSessionInput): Session {
  const now = input.now ?? Date.now();
  return {
    token: input.token,
    poolUrls: input.poolUrls,
    expiresAt: now + FIXED_TTL_MS,
    idleExpiresAt: now + IDLE_TTL_MS,
  };
}

export function isExpired(s: Session, now: number = Date.now()): boolean {
  return now >= s.expiresAt || now >= s.idleExpiresAt;
}

export function refreshIdle(s: Session, now: number = Date.now()): Session {
  return { ...s, idleExpiresAt: now + IDLE_TTL_MS };
}

export function remainingMs(s: Session, now: number = Date.now()): number {
  return Math.max(0, Math.min(s.expiresAt, s.idleExpiresAt) - now);
}

export function readSession(storage: Storage = sessionStorage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) return null;
    if (isExpired(parsed)) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(s: Session, storage: Storage = sessionStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSession(storage: Storage = sessionStorage): void {
  storage.removeItem(STORAGE_KEY);
}

function isPoolAddress(v: unknown): v is PoolAddress {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  return typeof a.host === 'string' && typeof a.port === 'number';
}

function isValidSession(v: unknown): v is Session {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.token === 'string' &&
    s.token.length > 0 &&
    Array.isArray(s.poolUrls) &&
    s.poolUrls.every(isPoolAddress) &&
    typeof s.expiresAt === 'number' &&
    typeof s.idleExpiresAt === 'number'
  );
}

/**
 * Returns a partial view of the token for UI display. Never reveal the full
 * token unless the user explicitly asks (copy-to-clipboard).
 */
export function maskToken(token: string): string {
  if (token.length <= 6) return '…';
  return `…${token.slice(-6)}`;
}
