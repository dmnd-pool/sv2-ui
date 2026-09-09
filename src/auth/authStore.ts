import {
  type Session,
  readSession,
  writeSession,
  clearSession,
  refreshIdle,
  isExpired,
  persistentStorage,
  type KybStatus,
  type ViewingAccountSession,
} from './session';
import { setDmndAccountId } from '@/api';

export type SignOutReason = 'user' | 'expired' | 'duplicate_tab';

export interface AuthState {
  session: Session | null;
  signOutReason: SignOutReason | null;
  // The subaccount currently being viewed via the account switcher, or null for the
  // master account. Stored per tab so refreshing keeps the account the user selected.
  viewingAccountId: string | null;
  viewingAccount: ViewingAccountSession | null;
}

export interface AuthStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AuthState;
  /** Subscribe to the cross-tab channel; call once from a React effect on mount. */
  connect: () => void;
  signIn: (session: Session) => void;
  signOut: (reason?: SignOutReason) => void;
  /** Refresh display fields from check_auth without resetting account scope or deadlines. */
  updateSessionProfile: (profile: Pick<Session, 'email' | 'company_name' | 'company_primary_location' | 'kyb_status'>) => void;
  /** Scope the dashboard to an authenticated subaccount or back to the master. */
  setViewingAccount: (account: ViewingAccountSession | null) => void;
  bumpActivity: (now?: number) => void;
  checkExpiry: (now?: number) => void;
  tabId: string;
  teardown: () => void;
}

export interface AuthStoreOptions {
  tabId?: string;
  storage?: Storage;
  /** Where a remembered session is kept so it outlives the tab. null disables it. */
  persistentStorage?: Storage | null;
  channel?: BroadcastChannel | null;
  channelFactory?: () => BroadcastChannel | null;
}

const CHANNEL_NAME = 'dmnd_auth';
const CLAIM_MSG = 'CLAIM_SESSION';
const VIEWING_ACCOUNT_KEY = 'dmnd_viewing_account';

interface ClaimMessage {
  type: typeof CLAIM_MSG;
  tabId: string;
  accountId: string;
}

function generateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function defaultChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

export function createAuthStore(options: AuthStoreOptions = {}): AuthStore {
  const tabId = options.tabId ?? generateTabId();
  const storage =
    options.storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const remembered =
    options.persistentStorage !== undefined ? options.persistentStorage ?? undefined : persistentStorage();
  const resolveChannel = (): BroadcastChannel | null =>
    options.channel !== undefined
      ? options.channel
      : options.channelFactory
        ? options.channelFactory()
        : defaultChannel();
  // Opened lazily in connect(), not here, so a store that is constructed but
  // never mounted does not hold a live channel.
  let channel: BroadcastChannel | null = null;

  if (!storage) {
    throw new Error('createAuthStore: no Storage available');
  }

  // A stored selection either matches what log_subaccount returns today or it is
  // dropped, which simply puts the tab back on the master account.
  const readViewingAccount = (): ViewingAccountSession | null => {
    const raw = storage.getItem(VIEWING_ACCOUNT_KEY);
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null) return null;
      const account = value as Record<string, unknown>;
      if (typeof account.accountId !== 'string' || !account.accountId || typeof account.email !== 'string') {
        return null;
      }
      return {
        accountId: account.accountId,
        email: account.email,
        company_name: typeof account.company_name === 'string' ? account.company_name : null,
        company_primary_location:
          typeof account.company_primary_location === 'string' ? account.company_primary_location : null,
        kyb_status: account.kyb_status as KybStatus,
      };
    } catch {
      return null;
    }
  };
  const writeViewingAccount = (value: ViewingAccountSession | null) => {
    if (value) storage.setItem(VIEWING_ACCOUNT_KEY, JSON.stringify(value));
    else storage.removeItem(VIEWING_ACCOUNT_KEY);
  };

  const listeners = new Set<() => void>();
  // Read the remembered slot first: a session there means this browser was explicitly
  // trusted, so it wins over anything left in the tab's own slot.
  const rememberedSession = remembered ? readSession(remembered) : null;
  const restoredSession = rememberedSession ?? readSession(storage);
  let sessionSlot: Storage = rememberedSession && remembered ? remembered : storage;
  const writeCurrentSession = (session: Session) => writeSession(session, sessionSlot);
  // Sign-out clears both slots, so no stale copy can be restored from the other one.
  const clearStoredSession = () => {
    clearSession(storage);
    if (remembered) clearSession(remembered);
    sessionSlot = storage;
  };
  if (!restoredSession) writeViewingAccount(null);
  const restoredViewingAccount = restoredSession ? readViewingAccount() : null;
  if (restoredViewingAccount) writeViewingAccount(restoredViewingAccount);
  else writeViewingAccount(null);
  let state: AuthState = {
    session: restoredSession,
    signOutReason: null,
    viewingAccountId: restoredViewingAccount?.accountId ?? null,
    viewingAccount: restoredViewingAccount,
  };
  // Keep the cloud client's X-Account-ID in lockstep with the session, set
  // synchronously here (not in a React effect) so a restored session has it
  // before the first authed call fires.
  setDmndAccountId(state.viewingAccountId ?? state.session?.accountId ?? null);

  const emit = () => {
    for (const l of listeners) l();
  };

  // The account the cloud client scopes calls to: the viewed subaccount when the
  // switcher is active, otherwise the master session's account.
  const effectiveAccountId = (s: AuthState): string | null =>
    s.viewingAccountId ?? s.session?.accountId ?? null;

  const setState = (next: AuthState) => {
    state = next;
    setDmndAccountId(effectiveAccountId(next));
    emit();
  };

  // A second tab signing in as the same account claims the session; the older
  // tab clears itself so one account isn't live in two places at once.
  const handleMessage = (msg: unknown) => {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as Partial<ClaimMessage>;
    if (m.type !== CLAIM_MSG) return;
    if (m.tabId === tabId) return;
    if (!state.session) return;
    if (m.accountId !== state.session.accountId) return;
    clearStoredSession();
    writeViewingAccount(null);
    setState({ session: null, signOutReason: 'duplicate_tab', viewingAccountId: null, viewingAccount: null });
  };

  // Best-effort cross-tab claim. The channel can be closed (e.g. a StrictMode
  // remount in dev reuses the store after teardown), so posting must not throw.
  const postClaim = (accountId: string) => {
    try {
      channel?.postMessage({ type: CLAIM_MSG, tabId, accountId } satisfies ClaimMessage);
    } catch {
      // channel closed; cross-tab logout degrades but sign-in still works
    }
  };

  return {
    tabId,
    connect() {
      // Subscribe to the cross-tab channel. A restored session does not broadcast a
      // claim: doing so makes a reload race the document being replaced and can clear
      // its own session. Only an explicit sign-in claims the account in another tab.
      // Subscribe from a React effect (not the constructor) so a store that is built but
      // never mounted -- e.g. StrictMode double-invoking the useState
      // initializer in dev -- never listens, and so can't clear another
      // instance's session on a refresh.
      if (channel) return;
      channel = resolveChannel();
      if (channel) {
        channel.onmessage = (ev: MessageEvent) => handleMessage(ev.data);
      }
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      return state;
    },
    signIn(session) {
      // A remembered session goes to localStorage so closing the browser does not end
      // it; otherwise it stays in the tab's own slot. Both are cleared first so only
      // one copy of the session exists, whichever slot it lands in.
      clearStoredSession();
      sessionSlot = session.remember && remembered ? remembered : storage;
      writeSession(session, sessionSlot);
      // A fresh sign-in always starts on the master account, clearing any stale view
      // scope from a previous session.
      writeViewingAccount(null);
      setState({ session, signOutReason: null, viewingAccountId: null, viewingAccount: null });
      postClaim(session.accountId);
    },
    signOut(reason: SignOutReason = 'user') {
      clearStoredSession();
      writeViewingAccount(null);
      setState({ session: null, signOutReason: reason, viewingAccountId: null, viewingAccount: null });
    },
    updateSessionProfile(profile) {
      if (!state.session) return;
      const session = { ...state.session, ...profile };
      writeCurrentSession(session);
      setState({ ...state, session });
    },
    setViewingAccount(account: ViewingAccountSession | null) {
      if (!state.session) return;
      // Only re-scope the view; the master session is untouched, so switching back is
      // just clearing this to null.
      writeViewingAccount(account);
      setState({ ...state, viewingAccountId: account?.accountId ?? null, viewingAccount: account });
    },
    bumpActivity(now?: number) {
      if (!state.session) return;
      if (isExpired(state.session, now)) {
        clearStoredSession();
        writeViewingAccount(null);
        setState({ session: null, signOutReason: 'expired', viewingAccountId: null, viewingAccount: null });
        return;
      }
      // An idle refresh preserves the viewed account: a mere activity tick must not
      // yank the miner out of a subaccount they are viewing.
      const refreshed = refreshIdle(state.session, now);
      writeCurrentSession(refreshed);
      setState({ ...state, session: refreshed });
    },
    checkExpiry(now?: number) {
      if (!state.session) return;
      if (isExpired(state.session, now)) {
        clearStoredSession();
        writeViewingAccount(null);
        setState({ session: null, signOutReason: 'expired', viewingAccountId: null, viewingAccount: null });
      }
    },
    teardown() {
      channel?.close();
      channel = null;
      listeners.clear();
    },
  };
}
