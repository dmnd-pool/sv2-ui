import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getUser, subscribeToDmndAuthRejections } from '@/api';
import { queryClient } from '@/lib/queryClient';
import { createAuthStore, type AuthStore, type SignOutReason } from './authStore';
import { viewingAccountFromAuth, type Session, type ViewingAccountSession } from './session';
import { actionForRejectedRequest, shouldEndSessionAfterValidation } from './sessionValidation';

export type AuthStatus = 'authenticated' | 'anonymous';

export interface AuthContextValue {
  session: Session | null;
  signOutReason: SignOutReason | null;
  status: AuthStatus;
  /** The subaccount being viewed via the switcher, or null for the master account. */
  viewingAccountId: string | null;
  /** AuthResponse-derived identity for the selected subaccount. */
  viewingAccount: ViewingAccountSession | null;
  signIn: (session: Session) => void;
  signOut: (reason?: SignOutReason) => void;
  setViewingAccount: (account: ViewingAccountSession | null) => void;
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

  // Listen for auth rejections from the backend. If the master session is rejected, sign out entirely.
  // If a subaccount session is rejected, drop the subaccount and return to the master account.
  useEffect(
    () =>
      subscribeToDmndAuthRejections(({ accountId: rejectedAccountId }) => {
        const action = actionForRejectedRequest(store.getSnapshot(), rejectedAccountId);
        if (action === 'sign-out') store.signOut('expired');
        else if (action === 'leave-subaccount') store.setViewingAccount(null);
      }),
    [store],
  );

  // Drop all cached account data when the master session changes or signs out. Queries
  // within a session are keyed by the active account id, so master/subaccount switches
  // remain isolated without discarding useful cached data. Keyed on the master id so
  // this does not run on every idle-activity session bump.
  const accountId = state.session?.accountId ?? null;
  const prevAccountIdRef = useRef(accountId);
  useEffect(() => {
    if (prevAccountIdRef.current !== null && prevAccountIdRef.current !== accountId) {
      queryClient.clear();
    }
    prevAccountIdRef.current = accountId;
  }, [accountId]);

  // On startup, validate a session restored from storage against the backend.
  // The auth cookie is HttpOnly so we can't inspect it here; check_auth confirms
  // it's still valid. If it isn't, drop the local session and route to sign-in.
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;
    const restored = store.getSnapshot().session;
    if (!restored) return;
    const restoredViewing = store.getSnapshot().viewingAccount;
    const stillValidatingRestoredSession = () => {
      const current = store.getSnapshot().session;
      return current?.accountId === restored.accountId && current.expiresAt === restored.expiresAt;
    };
    getUser()
      .checkAuth({ accountId: restored.accountId })
      .then((account) => {
        if (!stillValidatingRestoredSession()) return;
        store.updateSessionProfile({
          email: account.email,
          company_name: account.company_name,
          company_primary_location: account.company_primary_location,
          kyb_status: account.kyb_status,
        });
      })
      .catch((error: unknown) => {
        // A temporary network or service failure should leave the local session intact;
        // only an explicit authentication rejection proves that it has expired.
        if (stillValidatingRestoredSession() && shouldEndSessionAfterValidation(error)) {
          store.signOut('expired');
        }
      });

    if (restoredViewing) {
      getUser()
        .checkAuth({ accountId: restoredViewing.accountId })
        .then((account) => {
          const current = store.getSnapshot();
          if (
            current.session?.accountId !== restored.accountId ||
            current.session.expiresAt !== restored.expiresAt ||
            current.viewingAccountId !== restoredViewing.accountId
          ) {
            return;
          }
          queryClient.setQueryData(['account', 'profile', String(account.id)], account);
          store.setViewingAccount(viewingAccountFromAuth(account));
        })
        .catch((error: unknown) => {
          const current = store.getSnapshot();
          if (
            current.session?.accountId === restored.accountId &&
            current.session.expiresAt === restored.expiresAt &&
            current.viewingAccountId === restoredViewing.accountId &&
            shouldEndSessionAfterValidation(error)
          ) {
            // The master login is still valid; only the selected subaccount cookie is
            // gone, so return to main instead of logging the user out entirely.
            store.setViewingAccount(null);
          }
        });
    }
  }, [store]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: state.session,
      signOutReason: state.signOutReason,
      status: state.session ? 'authenticated' : 'anonymous',
      viewingAccountId: state.viewingAccountId,
      viewingAccount: state.viewingAccount,
      signIn: store.signIn,
      signOut: store.signOut,
      setViewingAccount: store.setViewingAccount,
    }),
    [state, store],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
