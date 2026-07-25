import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/auth';
import { useAggregatedMode } from './useAggregatedMode';
import { useHasSubaccounts } from './useSubaccounts';

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
 *
 * There is nothing to aggregate without subaccounts either, and because the banner that
 * carries the only exit control is itself shown only when subaccounts exist, a stored
 * `true` on an account with none would leave the mode on with no way to turn it off.
 * That combination is cleared at the source below rather than merely hidden, so the
 * stored preference can never strand the dashboard in a mode it cannot leave.
 */
export function AggregatedModeProvider({ children }: { children: ReactNode }) {
  const { viewingAccountId } = useAuth();
  const { aggregated, setAggregated } = useAggregatedMode();
  const { hasSubaccounts, isLoading: subaccountsLoading } = useHasSubaccounts();

  // Only act once the list has actually loaded: mid-load the count reads as zero, and
  // clearing on that would wipe a legitimate preference on every refresh.
  const noSubaccounts = !subaccountsLoading && !hasSubaccounts;
  useEffect(() => {
    if (aggregated && noSubaccounts) setAggregated(false);
  }, [aggregated, noSubaccounts, setAggregated]);

  const value = useMemo(
    () => ({ aggregated: aggregated && viewingAccountId === null && !noSubaccounts, setAggregated }),
    [aggregated, viewingAccountId, noSubaccounts, setAggregated],
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
