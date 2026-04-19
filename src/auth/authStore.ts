import {
  type Session,
  readSession,
  writeSession,
  clearSession,
  refreshIdle,
  isExpired,
} from './session';

export type SignOutReason = 'user' | 'expired' | 'duplicate_tab';

export interface AuthState {
  session: Session | null;
  signOutReason: SignOutReason | null;
}

export interface AuthStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AuthState;
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
  token: string;
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
  const storage = options.storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const channel =
    options.channel !== undefined
      ? options.channel
      : options.channelFactory
      ? options.channelFactory()
      : defaultChannel();

  if (!storage) {
    throw new Error('createAuthStore: no Storage available');
  }

  const listeners = new Set<() => void>();
  let state: AuthState = {
    session: readSession(storage),
    signOutReason: null,
  };

  const emit = () => {
    for (const l of listeners) l();
  };

  const setState = (next: AuthState) => {
    state = next;
    emit();
  };

  const handleMessage = (msg: unknown) => {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as Partial<ClaimMessage>;
    if (m.type !== CLAIM_MSG) return;
    if (m.tabId === tabId) return;
    if (!state.session) return;
    if (m.token !== state.session.token) return;
    clearSession(storage);
    setState({ session: null, signOutReason: 'duplicate_tab' });
  };

  if (channel) {
    channel.onmessage = (ev: MessageEvent) => handleMessage(ev.data);
    if (state.session) {
      channel.postMessage({ type: CLAIM_MSG, tabId, token: state.session.token } satisfies ClaimMessage);
    }
  }

  return {
    tabId,
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
      channel?.postMessage({ type: CLAIM_MSG, tabId, token: session.token } satisfies ClaimMessage);
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
      listeners.clear();
    },
  };
}
