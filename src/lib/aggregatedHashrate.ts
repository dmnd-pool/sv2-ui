import type { HashrateMeasure, HashratePoint, SubaccountHashratePoint } from '@/api/types';

// The account-level series reports bare numbers in H/s while the per-subaccount series
// tags each figure with a unit (observed live as "TH/s"). Everything is normalised to
// H/s before being combined so a subaccount can never be added at the wrong magnitude.
const UNIT_MULTIPLIERS: Record<string, number> = {
  'H/S': 1,
  'KH/S': 1e3,
  'MH/S': 1e6,
  'GH/S': 1e9,
  'TH/S': 1e12,
  'PH/S': 1e15,
  'EH/S': 1e18,
};

/**
 * A reported measure in H/s. A missing measure is no reading (0). An unrecognised unit
 * is also treated as no reading rather than assumed to be H/s: guessing would silently
 * understate that account by orders of magnitude in the combined series, and a visible
 * gap is safer than a wrong total.
 */
export function measureToHashPerSecond(measure: HashrateMeasure | null | undefined): number {
  if (!measure || typeof measure.value !== 'number') return 0;
  const multiplier = UNIT_MULTIPLIERS[String(measure.unit).toUpperCase()];
  return multiplier === undefined ? 0 : measure.value * multiplier;
}

/** Convert a subaccount's nested series into the same plain H/s shape as the account series. */
export function subaccountSeriesToPoints(points: SubaccountHashratePoint[]): HashratePoint[] {
  return points.map((p) => ({
    observed_at: p.observed_at,
    pplns_hashrate: measureToHashPerSecond(p.pplns_hashrate),
    fpps_hashrate: measureToHashPerSecond(p.fpps_hashrate),
    total_hashrate: measureToHashPerSecond(p.total_hashrate),
  }));
}

/**
 * Combine several accounts' series into one by adding the readings that share a
 * timestamp (the pool samples every account on the same schedule, so timestamps line
 * up). A timestamp only some accounts reported is kept with the readings that exist,
 * which is the honest total for that moment rather than dropping a real sample. The
 * result is ordered oldest first so the chart draws left to right.
 */
export function sumHashrateSeries(series: HashratePoint[][]): HashratePoint[] {
  const byTimestamp = new Map<string, HashratePoint>();
  for (const points of series) {
    for (const p of points) {
      const existing = byTimestamp.get(p.observed_at);
      if (existing) {
        existing.pplns_hashrate += p.pplns_hashrate;
        existing.fpps_hashrate += p.fpps_hashrate;
        existing.total_hashrate += p.total_hashrate;
      } else {
        byTimestamp.set(p.observed_at, {
          observed_at: p.observed_at,
          pplns_hashrate: p.pplns_hashrate,
          fpps_hashrate: p.fpps_hashrate,
          total_hashrate: p.total_hashrate,
        });
      }
    }
  }
  return [...byTimestamp.values()].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
}
