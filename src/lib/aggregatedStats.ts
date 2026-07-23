import type { EnrichedSubaccount } from '@/lib/subaccountsTable';

export interface AggregatedStats {
  totalWorkers: number;
  activeWorkers: number;
  offlineWorkers: number;
  offline24h: number;
  combinedHashrate: number;
  todayEarnings: number;
  rejectionRate: number | null;
}

/**
 * Roll per-subaccount figures into one account-wide set of stat-card numbers.
 * The combined rejection rate is recomputed from the summed raw accepted/rejected
 * counts rather than by averaging each sub's rate, so subaccounts with very
 * different share volumes are weighted correctly. The rate is null when there are
 * no shares at all (a 0/0 denominator), and an empty list yields all zeros with a
 * null rate.
 */
export function sumSubaccountStats(subs: EnrichedSubaccount[]): AggregatedStats {
  let activeWorkers = 0;
  let offlineWorkers = 0;
  let offline24h = 0;
  let combinedHashrate = 0;
  let todayEarnings = 0;
  let accepted = 0;
  let rejected = 0;
  for (const s of subs) {
    activeWorkers += s.active;
    offlineWorkers += s.offline;
    offline24h += s.offline24h;
    combinedHashrate += s.hashrate;
    todayEarnings += s.todayEarnings;
    accepted += s.accepted;
    rejected += s.rejected;
  }
  const totalShares = accepted + rejected;
  return {
    totalWorkers: activeWorkers + offlineWorkers,
    activeWorkers,
    offlineWorkers,
    offline24h,
    combinedHashrate,
    todayEarnings,
    rejectionRate: totalShares > 0 ? rejected / totalShares : null,
  };
}

export interface DonutSlice {
  id: string;
  name: string;
  hashrate: number;
}

/**
 * One donut slice per subaccount, in input order, carrying only what the chart
 * needs. Zero-hashrate subs are kept so the legend still lists every subaccount;
 * slice colors are assigned by the component, not here.
 */
export function donutSlices(subs: EnrichedSubaccount[]): DonutSlice[] {
  return subs.map((s) => ({ id: s.id, name: s.name, hashrate: s.hashrate }));
}
