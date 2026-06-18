import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getDmndClient } from '@/api';
import { createAuthStore, type AuthStore, type SignOutReason } from './authStore';
import type { Session } from './session';

export type AuthStatus = 'authenticated' | 'anonymous';

export interface AuthContextValue {
  session: Session | null;
  signOutReason: SignOutReason | null;
  status: AuthStatus;
  signIn: (session: Session) => void;
  signOut: (reason?: SignOutReason) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_DEBOUNCE_MS = 60 * 1000;
const EXPIRY_CHECK_INTERVAL_MS = 30 * 1000;

interface AuthProviderProps {
  children: ReactNode;
  store?: AuthStore;
}

export function AuthProvider({ children, store: injectedStore }: AuthProviderProps) {
  const ownsStore = useRef(!injectedStore);
  const [store] = useState<AuthStore>(() => injectedStore ?? createAuthStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const lastActivityRef = useRef(0);

  useEffect(() => {
    // Debounced so a stream of mousemoves refreshes the idle deadline at most
    // once a minute instead of writing sessionStorage on every event.
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) return;
      lastActivityRef.current = now;
      store.bumpActivity(now);
    };

    const windowEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove'];
    for (const e of windowEvents) window.addEventListener(e, onActivity);
    document.addEventListener('visibilitychange', onActivity);

    const intervalId = window.setInterval(() => store.checkExpiry(), EXPIRY_CHECK_INTERVAL_MS);

    return () => {
      for (const e of windowEvents) window.removeEventListener(e, onActivity);
      document.removeEventListener('visibilitychange', onActivity);
      window.clearInterval(intervalId);
    };
  }, [store]);

  useEffect(() => {
    const owns = ownsStore.current;
    // Connect the cross-tab channel here (not in the store constructor) so only
    // the mounted store listens; StrictMode's discarded initializer store never
    // does, which keeps a refresh from being seen as a duplicate-tab claim.
    if (owns) store.connect();
    return () => {
      if (owns) store.teardown();
    };
  }, [store]);

  // On startup, validate a session restored from storage against the backend.
  // The auth cookie is HttpOnly so we can't inspect it here; check_auth confirms
  // it's still valid. If it isn't, drop the local session and route to sign-in.
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;
    if (!store.getSnapshot().session) return;
    getDmndClient()
      .checkAuth()
      .catch(() => store.signOut('expired'));
  }, [store]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: state.session,
      signOutReason: state.signOutReason,
      status: state.session ? 'authenticated' : 'anonymous',
      signIn: store.signIn,
      signOut: store.signOut,
    }),
    [state, store],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
