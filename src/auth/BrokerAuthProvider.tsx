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
 * Broker auth state, kept deliberately lighter than the miner AuthProvider:
 * there is no broker `check_auth` endpoint to rehydrate against and only one
 * broker route today, so this is a sessionStorage-backed marker rather than the
 * full cross-tab + idle-expiry machinery. `readBrokerSession` drops an expired
 * session on read, so a stale session never grants access. When the real broker
 * dashboard lands, this can grow to match the miner provider.
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
