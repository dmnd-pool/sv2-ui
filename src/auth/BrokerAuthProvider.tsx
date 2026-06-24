import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  type BrokerSession,
  readBrokerSession,
  writeBrokerSession,
  clearBrokerSession,
} from './brokerSession';

export interface BrokerAuthContextValue {
  session: BrokerSession | null;
  signIn: (session: BrokerSession) => void;
  signOut: () => void;
}

const BrokerAuthContext = createContext<BrokerAuthContextValue | null>(null);

/**
 * Broker auth state backed by sessionStorage. There is no broker `check_auth`
 * endpoint to rehydrate against, so there is no cross-tab or idle-expiry
 * machinery; `readBrokerSession` drops an expired session on read.
 */
export function BrokerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BrokerSession | null>(() => readBrokerSession());

  const value = useMemo<BrokerAuthContextValue>(
    () => ({
      session,
      signIn: (next) => {
        writeBrokerSession(next);
        setSession(next);
      },
      signOut: () => {
        clearBrokerSession();
        setSession(null);
      },
    }),
    [session],
  );

  return <BrokerAuthContext.Provider value={value}>{children}</BrokerAuthContext.Provider>;
}

export function useBrokerAuth(): BrokerAuthContextValue {
  const ctx = useContext(BrokerAuthContext);
  if (!ctx) {
    throw new Error('useBrokerAuth must be used within a BrokerAuthProvider');
  }
  return ctx;
}
