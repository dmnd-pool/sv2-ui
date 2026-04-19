import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  isExpired,
  refreshIdle,
  remainingMs,
  readSession,
  writeSession,
  clearSession,
  maskToken,
  STORAGE_KEY,
  FIXED_TTL_MS,
  IDLE_TTL_MS,
} from './session';
import type { PoolAddress } from '@/api/dmnd';

const poolUrls: PoolAddress[] = [{ host: 'pool.dmnd.work', port: 3333 }];
const baseInput = { token: 'tok_abcdef123456', poolUrls };

describe('createSession', () => {
  it('sets fixed expiry at now + 8h', () => {
    const now = 1_000_000_000_000;
    const s = createSession({ ...baseInput, now });
    expect(s.expiresAt).toBe(now + FIXED_TTL_MS);
  });

  it('sets idle expiry at now + 30min', () => {
    const now = 1_000_000_000_000;
    const s = createSession({ ...baseInput, now });
    expect(s.idleExpiresAt).toBe(now + IDLE_TTL_MS);
  });

  it('preserves the token and pool urls from input', () => {
    const s = createSession(baseInput);
    expect(s.token).toBe(baseInput.token);
    expect(s.poolUrls).toEqual(poolUrls);
  });
});

describe('isExpired', () => {
  it('is false immediately after creation', () => {
    const now = 1_000_000_000_000;
    const s = createSession({ ...baseInput, now });
    expect(isExpired(s, now)).toBe(false);
  });

  it('is true when idle expiry passed even if fixed has not', () => {
    const now = 1_000_000_000_000;
    const s = createSession({ ...baseInput, now });
    expect(isExpired(s, now + IDLE_TTL_MS + 1)).toBe(true);
  });

  it('is true when fixed expiry passed even if idle was refreshed', () => {
    const now = 1_000_000_000_000;
    let s = createSession({ ...baseInput, now });
    s = refreshIdle(s, now + FIXED_TTL_MS - 1);
    expect(isExpired(s, now + FIXED_TTL_MS + 1)).toBe(true);
  });
});

describe('refreshIdle', () => {
  it('bumps idle expiry but not fixed expiry', () => {
    const now = 1_000_000_000_000;
    const s = createSession({ ...baseInput, now });
    const later = now + 10 * 60 * 1000;
    const refreshed = refreshIdle(s, later);
    expect(refreshed.idleExpiresAt).toBe(later + IDLE_TTL_MS);
    expect(refreshed.expiresAt).toBe(s.expiresAt);
  });
});

describe('remainingMs', () => {
  it('returns 0 for expired session', () => {
    const s = createSession({ ...baseInput, now: 0 });
    expect(remainingMs(s, FIXED_TTL_MS + 1)).toBe(0);
  });

  it('returns the smaller of fixed and idle remaining', () => {
    const now = 1_000_000_000_000;
    const s = createSession({ ...baseInput, now });
    expect(remainingMs(s, now)).toBe(IDLE_TTL_MS);
  });
});

describe('read/write/clear', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a valid session', () => {
    const s = createSession(baseInput);
    writeSession(s);
    expect(readSession()).toEqual(s);
  });

  it('returns null when storage is empty', () => {
    expect(readSession()).toBeNull();
  });

  it('returns null and clears storage when session is expired', () => {
    const s = createSession({ ...baseInput, now: 0 });
    writeSession(s);
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json');
    expect(readSession()).toBeNull();
  });

  it('returns null when token is empty', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...createSession(baseInput), token: '' }),
    );
    expect(readSession()).toBeNull();
  });

  it('returns null when poolUrls is not an array', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...createSession(baseInput), poolUrls: 'oops' }),
    );
    expect(readSession()).toBeNull();
  });

  it('returns null when a pool entry is missing fields', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...createSession(baseInput), poolUrls: [{ host: 'x' }] }),
    );
    expect(readSession()).toBeNull();
  });

  it('clearSession removes the key', () => {
    const s = createSession(baseInput);
    writeSession(s);
    clearSession();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('maskToken', () => {
  it('returns a single ellipsis for short tokens', () => {
    expect(maskToken('abc')).toBe('…');
  });

  it('shows only the last six chars for long tokens', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('…klmnop');
  });
});
