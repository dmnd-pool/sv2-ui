import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/auth';
import { useAggregatedMode } from './useAggregatedMode';

interface AggregatedModeValue {
  aggregated: boolean;
  setAggregated: (next: boolean) => void;
}

const AggregatedModeContext = createContext<AggregatedModeValue | null>(null);

/**
 * Shares the aggregated-dashboard flag across the shell so the top-bar toggle, the
 * banner, and each page read and update the same value in one tab. The underlying
 * hook still persists to localStorage and syncs across tabs; the context only keeps
 * the same-tab consumers in step (two independent useState copies would not).
 *
 * Aggregating only makes sense while looking at the main account, so the value every
 * consumer reads is ANDed with `viewingAccountId === null` here -- the one place every
 * page/toggle/banner goes through. The raw preference (from useAggregatedMode) still
 * persists and keeps updating via setAggregated, so switching back to the main account
 * restores it exactly as the miner left it; only its EFFECT is suppressed while
 * drilled into a subaccount. Without this, a subaccount has no subaccounts of its own,
 * so `getSubaccounts()` under a subaccount session returns an empty list (verified
 * live) and every aggregated-mode consumer would render as if the account had none --
 * including the account switcher itself, which would then have no way back to main.
 */
export function AggregatedModeProvider({ children }: { children: ReactNode }) {
  const { viewingAccountId } = useAuth();
  const { aggregated, setAggregated } = useAggregatedMode();
  const value = useMemo(
    () => ({ aggregated: aggregated && viewingAccountId === null, setAggregated }),
    [aggregated, viewingAccountId, setAggregated],
  );
  return <AggregatedModeContext.Provider value={value}>{children}</AggregatedModeContext.Provider>;
}

export function useAggregatedModeContext(): AggregatedModeValue {
  const ctx = useContext(AggregatedModeContext);
  if (!ctx) {
    throw new Error('useAggregatedModeContext must be used within an AggregatedModeProvider');
  }
  return ctx;
}
