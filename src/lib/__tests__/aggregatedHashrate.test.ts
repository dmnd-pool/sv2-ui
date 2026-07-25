import test from 'node:test';
import assert from 'node:assert/strict';
import type { HashratePoint, SubaccountHashratePoint } from '@/api/types';
import { measureToHashPerSecond, subaccountSeriesToPoints, sumHashrateSeries } from '@/lib/aggregatedHashrate';

function point(over: Partial<HashratePoint> = {}): HashratePoint {
  return { observed_at: '2026-07-24T00:00:00Z', pplns_hashrate: 0, fpps_hashrate: 0, total_hashrate: 0, ...over };
}

test('measureToHashPerSecond converts each reported unit to H/s', () => {
  assert.equal(measureToHashPerSecond({ value: 2, unit: 'TH/s' }), 2e12);
  assert.equal(measureToHashPerSecond({ value: 5, unit: 'GH/s' }), 5e9);
  assert.equal(measureToHashPerSecond({ value: 3, unit: 'MH/s' }), 3e6);
  assert.equal(measureToHashPerSecond({ value: 7, unit: 'H/s' }), 7);
});

test('measureToHashPerSecond treats a missing or unrecognised measure as no reading', () => {
  assert.equal(measureToHashPerSecond(null), 0);
  assert.equal(measureToHashPerSecond(undefined), 0);
  // An unfamiliar unit must not be silently scaled as if it were H/s, which would
  // understate a subaccount by orders of magnitude in the combined series.
  assert.equal(measureToHashPerSecond({ value: 9, unit: 'ZH/s' }), 0);
});

test('subaccountSeriesToPoints normalises the nested per-subaccount shape to H/s numbers', () => {
  const raw: SubaccountHashratePoint[] = [
    {
      observed_at: '2026-07-24T00:00:00Z',
      pplns_hashrate: { value: 1, unit: 'TH/s' },
      fpps_hashrate: { value: 2, unit: 'TH/s' },
      total_hashrate: { value: 3, unit: 'TH/s' },
    },
  ];
  assert.deepEqual(subaccountSeriesToPoints(raw), [
    { observed_at: '2026-07-24T00:00:00Z', pplns_hashrate: 1e12, fpps_hashrate: 2e12, total_hashrate: 3e12 },
  ]);
});

test('sumHashrateSeries adds every account reading at the same timestamp', () => {
  const main = [point({ observed_at: 't1', pplns_hashrate: 10, fpps_hashrate: 1, total_hashrate: 11 })];
  const sub = [point({ observed_at: 't1', pplns_hashrate: 20, fpps_hashrate: 2, total_hashrate: 22 })];
  assert.deepEqual(sumHashrateSeries([main, sub]), [
    { observed_at: 't1', pplns_hashrate: 30, fpps_hashrate: 3, total_hashrate: 33 },
  ]);
});

test('sumHashrateSeries keeps a timestamp only some accounts reported, and orders by time', () => {
  const main = [point({ observed_at: '2026-07-24T00:02:00Z', total_hashrate: 5 })];
  const sub = [point({ observed_at: '2026-07-24T00:00:00Z', total_hashrate: 7 })];
  const merged = sumHashrateSeries([main, sub]);
  assert.deepEqual(
    merged.map((p) => p.observed_at),
    ['2026-07-24T00:00:00Z', '2026-07-24T00:02:00Z'],
  );
  // A sample no other account reported still carries that account's real reading.
  assert.equal(merged[0].total_hashrate, 7);
  assert.equal(merged[1].total_hashrate, 5);
});

test('sumHashrateSeries handles no accounts and empty series', () => {
  assert.deepEqual(sumHashrateSeries([]), []);
  assert.deepEqual(sumHashrateSeries([[], []]), []);
});
