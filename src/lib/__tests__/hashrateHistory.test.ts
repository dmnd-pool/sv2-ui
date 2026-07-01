import assert from 'node:assert/strict';
import test from 'node:test';

import type { HashratePoint } from '@/api/types';
import { downsampleHashrate, rangeToWindow } from '../hashrateHistory';

const NOW = Date.UTC(2026, 5, 30, 12, 0, 0); // 2026-06-30T12:00:00Z

test('rangeToWindow ends at now and starts the range earlier (RFC3339)', () => {
  const { from, to } = rangeToWindow('1H', NOW);
  assert.equal(to, '2026-06-30T12:00:00.000Z');
  assert.equal(from, '2026-06-30T11:00:00.000Z');
  assert.equal(rangeToWindow('1D', NOW).from, '2026-06-29T12:00:00.000Z');
  assert.equal(rangeToWindow('7D', NOW).from, '2026-06-23T12:00:00.000Z');
});

function point(observed_at: string, pplns: number, fpps: number): HashratePoint {
  return { observed_at, pplns_hashrate: pplns, fpps_hashrate: fpps, total_hashrate: pplns + fpps };
}

test('downsampleHashrate returns points unchanged when at or under the cap', () => {
  const pts = [point('a', 1, 1), point('b', 2, 2)];
  assert.deepEqual(downsampleHashrate(pts, 2), pts);
  assert.deepEqual(downsampleHashrate(pts, 5), pts);
});

test('downsampleHashrate buckets and averages, staying within the cap', () => {
  const pts = Array.from({ length: 10 }, (_, i) => point(String(i), i, i * 2));
  const out = downsampleHashrate(pts, 5);
  assert.ok(out.length <= 5);
  // 10 points into buckets of 2: first bucket = avg of points 0 and 1.
  assert.equal(out[0].pplns_hashrate, 0.5);
  assert.equal(out[0].fpps_hashrate, 1);
  // the bucket carries the LAST sample's timestamp so the line ends at now.
  assert.equal(out[out.length - 1].observed_at, '9');
});

test('downsampleHashrate with maxPoints 0 yields an empty series', () => {
  assert.deepEqual(downsampleHashrate([point('a', 1, 1)], 0), []);
});
