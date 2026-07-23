import { useMemo } from 'react';
import { donutSlices, sumSubaccountStats } from '@/lib/aggregatedStats';
import { useSubaccounts } from './useSubaccounts';

/**
 * Account-wide figures for aggregated mode: every subaccount's stats rolled into one
 * set of numbers plus the per-subaccount hashrate breakdown the combined chart shows.
 * Built from the enriched subaccount list, so it reuses that query rather than issuing
 * its own, and it inherits its loading and error states: while the roll-up is loading
 * or failed the caller shows that state instead of a total that is missing accounts.
 */
export function useAggregatedData(enabled = true) {
  // Gated so the per-subaccount fan-out only runs in aggregated mode; a single-account
  // dashboard never pays for data it does not show.
  const { data, isLoading, isError, refetch } = useSubaccounts(enabled);

  const subs = useMemo(() => data ?? [], [data]);
  const stats = useMemo(() => sumSubaccountStats(subs), [subs]);
  const slices = useMemo(() => donutSlices(subs), [subs]);

  return { stats, slices, subaccounts: subs, isLoading, isError, refetch };
}
