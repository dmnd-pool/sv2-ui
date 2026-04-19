import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import { createAuthStore } from './authStore';
import { createSession, FIXED_TTL_MS } from './session';
import type { PoolAddress } from '@/api/dmnd';

const poolUrls: PoolAddress[] = [{ host: 'pool.dmnd.work', port: 3333 }];

function wrapperWithStore(store = createAuthStore({ channel: null })) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider store={store}>{children}</AuthProvider>;
  };
}

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });

  it('starts anonymous when no session', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWithStore() });
    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
  });

  it('becomes authenticated after signIn and re-renders', () => {
    const store = createAuthStore({ channel: null });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWithStore(store) });

    const s = createSession({ token: 'tok_abc', poolUrls });
    act(() => {
      result.current.signIn(s);
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.session?.token).toBe('tok_abc');
    expect(result.current.session?.poolUrls).toEqual(poolUrls);
  });

  it('surfaces signOutReason=expired when store detects expiry', () => {
    const store = createAuthStore({ channel: null });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWithStore(store) });

    const now = 1_000_000_000_000;
    act(() => {
      store.signIn(createSession({ token: 'tok_abc', poolUrls, now }));
    });
    act(() => {
      store.checkExpiry(now + FIXED_TTL_MS + 1);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.signOutReason).toBe('expired');
  });
});
