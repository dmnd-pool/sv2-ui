import assert from 'node:assert/strict';
import test from 'node:test';

import type { HashratePoint } from '@/api/types';
import {
  downsampleHashrate,
  hashrateChangeFrom24HoursAgo,
  hashrateComparisonWindow,
  rangeToWindow,
} from '../hashrateHistory';

const NOW = Date.UTC(2026, 5, 30, 12, 0, 0); // 2026-06-30T12:00:00Z
const CURRENT_OBSERVED_AT = '2026-06-30T11:58:00Z';

test('rangeToWindow ends at now and starts the range earlier (RFC3339)', () => {
  const { from, to } = rangeToWindow('1H', NOW);
  assert.equal(to, '2026-06-30T12:00:00.000Z');
  assert.equal(from, '2026-06-30T11:00:00.000Z');
  assert.equal(rangeToWindow('6H', NOW).from, '2026-06-30T06:00:00.000Z');
  assert.equal(rangeToWindow('24H', NOW).from, '2026-06-29T12:00:00.000Z');
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

test('hashrateComparisonWindow is centred 24 hours before the live snapshot, not wall-clock now', () => {
  assert.deepEqual(hashrateComparisonWindow(CURRENT_OBSERVED_AT, NOW), {
    from: '2026-06-29T11:53:00.000Z',
    to: '2026-06-29T12:03:00.000Z',
  });
});

test('hashrateComparisonWindow is unavailable for missing, invalid, or stale snapshots', () => {
  assert.equal(hashrateComparisonWindow(null, NOW), null);
  assert.equal(hashrateComparisonWindow('not-a-date', NOW), null);
  assert.equal(hashrateComparisonWindow('2026-06-30T11:49:59Z', NOW), null);
});

test('hashrateChangeFrom24HoursAgo compares with the raw sample nearest the exact target', () => {
  const points = [
    point('2026-06-30T12:00:00Z', 75, 75),
    point('2026-06-29T11:58:00Z', 40, 60),
    point('2026-06-29T12:00:00Z', 50, 70),
  ];
  assert.equal(hashrateChangeFrom24HoursAgo(125, CURRENT_OBSERVED_AT, points, NOW), 25);
  assert.equal(hashrateChangeFrom24HoursAgo(75, CURRENT_OBSERVED_AT, points, NOW), -25);
});

test('hashrateChangeFrom24HoursAgo is unavailable without a usable baseline or current snapshot', () => {
  assert.equal(hashrateChangeFrom24HoursAgo(100, CURRENT_OBSERVED_AT, [], NOW), null);
  assert.equal(
    hashrateChangeFrom24HoursAgo(100, CURRENT_OBSERVED_AT, [point('2026-06-29T11:58:00Z', 0, 0)], NOW),
    null,
  );
  assert.equal(
    hashrateChangeFrom24HoursAgo(Number.NaN, CURRENT_OBSERVED_AT, [point('2026-06-29T11:58:00Z', 50, 50)], NOW),
    null,
  );
  assert.equal(
    hashrateChangeFrom24HoursAgo(100, null, [point('2026-06-29T11:58:00Z', 50, 50)], NOW),
    null,
  );
});

test('hashrateChangeFrom24HoursAgo rejects a baseline more than five minutes from the target', () => {
  const distant = [point('2026-06-29T12:03:01Z', 50, 50)];
  assert.equal(hashrateChangeFrom24HoursAgo(125, CURRENT_OBSERVED_AT, distant, NOW), null);
});

test('hashrateChangeFrom24HoursAgo rejects a stale live snapshot', () => {
  const baseline = [point('2026-06-29T11:49:59Z', 50, 50)];
  assert.equal(hashrateChangeFrom24HoursAgo(125, '2026-06-30T11:49:59Z', baseline, NOW), null);
});
