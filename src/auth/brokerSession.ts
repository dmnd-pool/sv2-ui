import { FIXED_TTL_MS, IDLE_TTL_MS } from './session';

export const BROKER_STORAGE_KEY = 'dmnd_broker_session';

/**
 * The browser-side broker session. Brokers are a separate auth tree from miners
 * (cookie-based, no token, no X-Account-ID), so this is stored under its own key
 * and never mixed with the miner session. The two timestamps mirror the miner
 * session as a UX convenience; the cookie is the real session and is enforced
 * server-side.
 */
export interface BrokerSession {
  brokerId: string;
  email: string;
  referenceCode: string;
  expiresAt: number;
  idleExpiresAt: number;
}

export interface CreateBrokerSessionInput {
  brokerId: string;
  email: string;
  referenceCode: string;
  now?: number;
}

export function createBrokerSession(input: CreateBrokerSessionInput): BrokerSession {
  const now = input.now ?? Date.now();
  return {
    brokerId: input.brokerId,
    email: input.email,
    referenceCode: input.referenceCode,
    expiresAt: now + FIXED_TTL_MS,
    idleExpiresAt: now + IDLE_TTL_MS,
  };
}

export function isBrokerSessionExpired(s: BrokerSession, now: number = Date.now()): boolean {
  return now >= s.expiresAt || now >= s.idleExpiresAt;
}

export function readBrokerSession(storage: Storage = sessionStorage): BrokerSession | null {
  try {
    const raw = storage.getItem(BROKER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidBrokerSession(parsed)) return null;
    if (isBrokerSessionExpired(parsed)) {
      storage.removeItem(BROKER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeBrokerSession(s: BrokerSession, storage: Storage = sessionStorage): void {
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify(s));
}

export function clearBrokerSession(storage: Storage = sessionStorage): void {
  storage.removeItem(BROKER_STORAGE_KEY);
}

function isValidBrokerSession(v: unknown): v is BrokerSession {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.brokerId === 'string' &&
    s.brokerId.length > 0 &&
    typeof s.email === 'string' &&
    typeof s.referenceCode === 'string' &&
    typeof s.expiresAt === 'number' &&
    typeof s.idleExpiresAt === 'number'
  );
}
