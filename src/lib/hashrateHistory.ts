import type { HashratePoint, HashrateRange } from '@/api/types';

const RANGE_MS: Record<HashrateRange, number> = {
  '1H': 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Maps a chart range to the RFC3339 `{from,to}` window the historical endpoint
 * expects (`/api/user/hashrate/historical?from=&to=`). `to` is now; `from` is the
 * range earlier.
 */
export function rangeToWindow(range: HashrateRange, nowMs: number): { from: string; to: string } {
  return {
    from: new Date(nowMs - RANGE_MS[range]).toISOString(),
    to: new Date(nowMs).toISOString(),
  };
}

/**
 * The historical endpoint returns dense samples (~one every two minutes, so a week
 * is ~5000 points). Recharts is SVG-backed and degrades past ~1000 points per
 * series, so bucket the points into at most `maxPoints` groups and average each
 * bucket. Averaging rather than sampling keeps the trend honest when a bucket
 * spans several samples. The newest point anchors to the latest sample so the line
 * still ends at "now".
 */
export function downsampleHashrate(points: HashratePoint[], maxPoints: number): HashratePoint[] {
  if (maxPoints <= 0) return [];
  if (points.length <= maxPoints) return points;

  const bucketSize = Math.ceil(points.length / maxPoints);
  const out: HashratePoint[] = [];
  for (let i = 0; i < points.length; i += bucketSize) {
    const bucket = points.slice(i, i + bucketSize);
    let pplns = 0;
    let fpps = 0;
    let total = 0;
    for (const p of bucket) {
      pplns += p.pplns_hashrate;
      fpps += p.fpps_hashrate;
      total += p.total_hashrate;
    }
    const n = bucket.length;
    out.push({
      observed_at: bucket[n - 1].observed_at,
      pplns_hashrate: pplns / n,
      fpps_hashrate: fpps / n,
      total_hashrate: total / n,
    });
  }
  return out;
}
