import {
  type Session,
  readSession,
  writeSession,
  clearSession,
  refreshIdle,
  isExpired,
} from './session';
import { setDmndAccountId } from '@/api';

export type SignOutReason = 'user' | 'expired' | 'duplicate_tab';

export interface AuthState {
  session: Session | null;
  signOutReason: SignOutReason | null;
}

export interface AuthStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AuthState;
  /** Subscribe to the cross-tab channel; call once from a React effect on mount. */
  connect: () => void;
  signIn: (session: Session) => void;
  signOut: (reason?: SignOutReason) => void;
  bumpActivity: (now?: number) => void;
  checkExpiry: (now?: number) => void;
  tabId: string;
  teardown: () => void;
}

export interface AuthStoreOptions {
  tabId?: string;
  storage?: Storage;
  channel?: BroadcastChannel | null;
  channelFactory?: () => BroadcastChannel | null;
}

const CHANNEL_NAME = 'dmnd_auth';
const CLAIM_MSG = 'CLAIM_SESSION';

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

  const listeners = new Set<() => void>();
  let state: AuthState = {
    session: readSession(storage),
    signOutReason: null,
  };
  // Keep the cloud client's X-Account-ID in lockstep with the session, set
  // synchronously here (not in a React effect) so a restored session has it
  // before the first authed call fires.
  setDmndAccountId(state.session?.accountId ?? null);

  const emit = () => {
    for (const l of listeners) l();
  };

  const setState = (next: AuthState) => {
    state = next;
    setDmndAccountId(next.session?.accountId ?? null);
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
    clearSession(storage);
    setState({ session: null, signOutReason: 'duplicate_tab' });
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
      // Subscribe to the cross-tab channel and claim the current session. Run
      // from a React effect (not the constructor) so a store that is built but
      // never mounted -- e.g. StrictMode double-invoking the useState
      // initializer in dev -- never listens, and so can't clear another
      // instance's session on a refresh.
      if (channel) return;
      channel = resolveChannel();
      if (channel) {
        channel.onmessage = (ev: MessageEvent) => handleMessage(ev.data);
        if (state.session) postClaim(state.session.accountId);
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
      writeSession(session, storage);
      setState({ session, signOutReason: null });
      postClaim(session.accountId);
    },
    signOut(reason: SignOutReason = 'user') {
      clearSession(storage);
      setState({ session: null, signOutReason: reason });
    },
    bumpActivity(now?: number) {
      if (!state.session) return;
      const refreshed = refreshIdle(state.session, now);
      writeSession(refreshed, storage);
      setState({ session: refreshed, signOutReason: state.signOutReason });
    },
    checkExpiry(now?: number) {
      if (!state.session) return;
      if (isExpired(state.session, now)) {
        clearSession(storage);
        setState({ session: null, signOutReason: 'expired' });
      }
    },
    teardown() {
      channel?.close();
      channel = null;
      listeners.clear();
    },
  };
}
