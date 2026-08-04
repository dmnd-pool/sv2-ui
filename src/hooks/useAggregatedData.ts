import { useMemo } from 'react';
import { donutSlices, sumAccountStats } from '@/lib/aggregatedStats';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { todayGeneratedBtc } from '@/lib/generatedBtcTable';
import { deriveWorkersPageStats } from '@/lib/workersTable';
import { sumGeneratedBtc, type EnrichedSubaccount } from '@/lib/subaccountsTable';
import { useSubaccounts } from './useSubaccounts';
import { useAccountAllWorkers, useAccountHashrate, useAccountShareStats } from './useAccountData';
import { useGeneratedBtc } from './useGeneratedBtc';

/**
 * Account-wide figures for aggregated mode: the main account and every subaccount
 * rolled into one set of numbers, plus the per-account hashrate breakdown the combined
 * chart shows. The main account owns workers and earns alongside its subaccounts, so
 * leaving it out under-reported every combined figure.
 *
 * Its figures come from the account-level endpoints that mirror what a subaccount's
 * `/summary` provides, so like is combined with like: `/api/workers/all` for the roster
 * and its active/offline counts, `/api/user/hashrate` for current hashrate,
 * `/api/user/share_stats` for the same 24h accepted/rejected window, and today's entry
 * from `/api/generated_btc` for the same generated-BTC figure as a subaccount's
 * `today_generated_btc` (rather than the on-chain paid total, which measures something
 * else).
 *
 * Loading and error state stays that of the subaccount fan-out, which is the call that
 * can partially fail; a failure there surfaces instead of a total missing accounts.
 */
export function useAggregatedData(enabled = true) {
  // Gated so the per-subaccount fan-out only runs in aggregated mode; a single-account
  // dashboard never pays for data it does not show.
  const { data, isLoading, isError, refetch } = useSubaccounts(enabled);
  const { data: mainWorkers } = useAccountAllWorkers();
  const { data: mainHashrate } = useAccountHashrate();
  const { data: mainShares } = useAccountShareStats(enabled);
  // Gated with the rest: the home page has no other use for the generated-BTC list, so
  // a single-account dashboard should not fetch it at all.
  const { data: mainGenerated } = useGeneratedBtc(enabled);

  const subs = useMemo(() => data ?? [], [data]);

  // The main account expressed in the same per-account shape as an enriched subaccount,
  // so one roll-up covers every account without a second code path.
  const mainAccount = useMemo<EnrichedSubaccount>(() => {
    const workers = mainWorkers ?? [];
    const stats = deriveWorkersPageStats(workers, Date.now());
    return {
      id: MAIN_ACCOUNT_LABEL,
      name: MAIN_ACCOUNT_LABEL,
      hashrate: mainHashrate?.total_hashrate ?? 0,
      active: stats.active,
      offline: stats.offline,
      offline24h: stats.offline24h,
      rejection: stats.rejectionRate,
      accepted: mainShares?.accepted ?? 0,
      rejected: mainShares?.rejected ?? 0,
      todayEarnings: todayGeneratedBtc(mainGenerated ?? [], Date.now()),
      generatedBtc: sumGeneratedBtc(mainGenerated ?? []),
      workers,
    };
  }, [mainWorkers, mainHashrate, mainShares, mainGenerated]);

  // Main first, matching how the account switcher and the payout account list order
  // themselves, so the same account leads every aggregated surface.
  const accounts = useMemo(() => [mainAccount, ...subs], [mainAccount, subs]);
  const stats = useMemo(() => sumAccountStats(accounts), [accounts]);
  const slices = useMemo(() => donutSlices(accounts), [accounts]);

  return { stats, slices, accounts, subaccounts: subs, isLoading, isError, refetch };
}
