import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuthStore } from './authStore';
import { createSession, FIXED_TTL_MS, IDLE_TTL_MS, STORAGE_KEY } from './session';
import type { PoolAddress } from '@/api/dmnd';

class MockChannel implements Pick<BroadcastChannel, 'name' | 'postMessage' | 'close' | 'onmessage'> {
  static instances: MockChannel[] = [];
  onmessage: ((this: BroadcastChannel, ev: MessageEvent) => unknown) | null = null;
  onmessageerror: ((this: BroadcastChannel, ev: MessageEvent) => unknown) | null = null;
  constructor(public name: string) {
    MockChannel.instances.push(this);
  }
  postMessage(data: unknown): void {
    for (const ch of MockChannel.instances) {
      if (ch === this) continue;
      ch.onmessage?.call(ch as unknown as BroadcastChannel, { data } as MessageEvent);
    }
  }
  close(): void {
    const i = MockChannel.instances.indexOf(this);
    if (i >= 0) MockChannel.instances.splice(i, 1);
  }
  static reset() {
    MockChannel.instances = [];
  }
}

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear(): void {
    this.m.clear();
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  key(i: number): string | null {
    return Array.from(this.m.keys())[i] ?? null;
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}

const poolUrls: PoolAddress[] = [{ host: 'pool.dmnd.work', port: 3333 }];
const baseSession = (token = 'tok_abc') => createSession({ token, poolUrls });

beforeEach(() => {
  sessionStorage.clear();
  MockChannel.reset();
});

describe('createAuthStore', () => {
  it('hydrates from storage on creation', () => {
    const s = baseSession();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    const store = createAuthStore({ channel: null });
    expect(store.getSnapshot().session).toEqual(s);
  });

  it('signIn writes to storage, broadcasts CLAIM, and notifies subscribers', () => {
    const ch = new MockChannel('dmnd_auth');
    const store = createAuthStore({ tabId: 'A', channel: ch as unknown as BroadcastChannel });
    const spy = vi.fn();
    store.subscribe(spy);

    const s = baseSession();
    store.signIn(s);

    expect(store.getSnapshot().session).toEqual(s);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(s));
    expect(spy).toHaveBeenCalled();
  });

  it('signOut clears storage and sets signOutReason', () => {
    const store = createAuthStore({ channel: null });
    store.signIn(baseSession());
    store.signOut('user');
    expect(store.getSnapshot().session).toBeNull();
    expect(store.getSnapshot().signOutReason).toBe('user');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('duplicate-tab defense via BroadcastChannel', () => {
  it('older tab signs out when a newer tab CLAIMs the same token', () => {
    const storageA = new MemStorage();
    const storageB = new MemStorage();
    const chA = new MockChannel('dmnd_auth');
    const storeA = createAuthStore({
      tabId: 'A',
      channel: chA as unknown as BroadcastChannel,
      storage: storageA,
    });
    storeA.signIn(baseSession());

    const chB = new MockChannel('dmnd_auth');
    const storeB = createAuthStore({
      tabId: 'B',
      channel: chB as unknown as BroadcastChannel,
      storage: storageB,
    });
    storeB.signIn(baseSession());

    expect(storeA.getSnapshot().session).toBeNull();
    expect(storeA.getSnapshot().signOutReason).toBe('duplicate_tab');
    expect(storeB.getSnapshot().session).not.toBeNull();
  });

  it('ignores CLAIM from self', () => {
    const ch = new MockChannel('dmnd_auth');
    const store = createAuthStore({ tabId: 'A', channel: ch as unknown as BroadcastChannel });
    const s = baseSession();
    store.signIn(s);

    ch.onmessage?.call(ch as unknown as BroadcastChannel, {
      data: { type: 'CLAIM_SESSION', tabId: 'A', token: s.token },
    } as MessageEvent);

    expect(store.getSnapshot().session).not.toBeNull();
  });

  it('ignores CLAIM with different token', () => {
    const storageA = new MemStorage();
    const storageB = new MemStorage();
    const chA = new MockChannel('dmnd_auth');
    const storeA = createAuthStore({
      tabId: 'A',
      channel: chA as unknown as BroadcastChannel,
      storage: storageA,
    });
    storeA.signIn(baseSession('tok_abc'));

    const chB = new MockChannel('dmnd_auth');
    const storeB = createAuthStore({
      tabId: 'B',
      channel: chB as unknown as BroadcastChannel,
      storage: storageB,
    });
    storeB.signIn(baseSession('different'));

    expect(storeA.getSnapshot().session).not.toBeNull();
    expect(storeA.getSnapshot().session?.token).toBe('tok_abc');
  });

  it('ignores malformed channel messages', () => {
    const ch = new MockChannel('dmnd_auth');
    const store = createAuthStore({ tabId: 'A', channel: ch as unknown as BroadcastChannel });
    store.signIn(baseSession());

    ch.onmessage?.call(ch as unknown as BroadcastChannel, { data: null } as MessageEvent);
    ch.onmessage?.call(ch as unknown as BroadcastChannel, { data: 'garbage' } as MessageEvent);
    ch.onmessage?.call(ch as unknown as BroadcastChannel, {
      data: { type: 'WRONG_TYPE', tabId: 'B', token: 'tok_abc' },
    } as MessageEvent);

    expect(store.getSnapshot().session).not.toBeNull();
  });
});

describe('bumpActivity + checkExpiry', () => {
  it('bumpActivity refreshes idle expiry in storage', () => {
    const store = createAuthStore({ channel: null });
    const now = 1_000_000_000_000;
    const s = createSession({ token: 't', poolUrls, now });
    store.signIn(s);

    const later = now + 10 * 60 * 1000;
    store.bumpActivity(later);

    const current = store.getSnapshot().session!;
    expect(current.idleExpiresAt).toBe(later + IDLE_TTL_MS);
  });

  it('checkExpiry signs out with reason=expired when past fixed TTL', () => {
    const store = createAuthStore({ channel: null });
    const now = 1_000_000_000_000;
    store.signIn(createSession({ token: 't', poolUrls, now }));

    store.checkExpiry(now + FIXED_TTL_MS + 1);

    expect(store.getSnapshot().session).toBeNull();
    expect(store.getSnapshot().signOutReason).toBe('expired');
  });

  it('bumpActivity is a no-op when there is no session', () => {
    const store = createAuthStore({ channel: null });
    expect(() => store.bumpActivity(1)).not.toThrow();
    expect(store.getSnapshot().session).toBeNull();
  });
});
