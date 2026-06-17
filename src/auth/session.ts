export const FIXED_TTL_MS = 8 * 60 * 60 * 1000;
export const IDLE_TTL_MS = 30 * 60 * 1000;
export const STORAGE_KEY = 'dmnd_session';

/**
 * The browser-side session. Auth itself lives in the backend's HttpOnly cookie,
 * which JS can't read, so we keep only lightweight, non-sensitive data: the
 * account id (sent as X-Account-ID on authed calls) and the email for display.
 * Lives in sessionStorage (per tab, gone on tab close). The two timestamps are a
 * UX convenience; real expiry is enforced server-side (the cookie + check_auth),
 * so the user is sent back to sign-in promptly rather than discovering a dead
 * session mid-action.
 */
export interface Session {
  accountId: string;
  email: string;
  expiresAt: number;
  idleExpiresAt: number;
}

export interface CreateSessionInput {
  accountId: string;
  email: string;
  now?: number;
}

export function createSession(input: CreateSessionInput): Session {
  const now = input.now ?? Date.now();
  return {
    accountId: input.accountId,
    email: input.email,
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

export function readSession(storage: Storage = sessionStorage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
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

function isValidSession(v: unknown): v is Session {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.accountId === 'string' &&
    s.accountId.length > 0 &&
    typeof s.email === 'string' &&
    typeof s.expiresAt === 'number' &&
    typeof s.idleExpiresAt === 'number'
  );
}
