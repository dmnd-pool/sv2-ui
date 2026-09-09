import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPplnsDailyWork,
  formatPplnsWorkDay,
  hasPayablePplnsWork,
  searchPplnsDailyWork,
  totalDailyWorkNetSats,
} from '../pplnsProjection';
import type { PplnsProjectionDailyWork } from '@/api/types';
import { pplnsProjectionFixture } from '@/api/__tests__/pplnsProjectionFixture';

const day = (over: Partial<PplnsProjectionDailyWork> = {}): PplnsProjectionDailyWork => ({
  work_day: '2026-08-31',
  retained_difficulty: 1,
  projected_net_sats: 999,
  already_earned_net_sats: 1,
  total_net_sats: 100,
  earned_history_complete: true,
  ...over,
});

test('the grand total sums every retained day', () => {
  assert.equal(totalDailyWorkNetSats([day({ total_net_sats: 100 }), day({ total_net_sats: 250 })]), 350);
});

test('the grand total of no retained work is zero', () => {
  assert.equal(totalDailyWorkNetSats([]), 0);
});

test('daily work search matches raw and displayed row values', () => {
  const rows = [
    day({ work_day: '2026-08-31', retained_difficulty: 1, total_net_sats: 1000 }),
    day({ work_day: '2026-09-01', retained_difficulty: 2, total_net_sats: 2500 }),
  ];

  assert.deepEqual(searchPplnsDailyWork(rows, 'monday 31 august'), [rows[0]]);
  assert.deepEqual(searchPplnsDailyWork(rows, '2026-09-01'), [rows[1]]);
  assert.deepEqual(searchPplnsDailyWork(rows, '0.00001'), [rows[0]]);
  assert.equal(searchPplnsDailyWork(rows, 'no match').length, 0);
  assert.equal(searchPplnsDailyWork(rows, '  ').length, 2);
});

test('daily work date filtering uses inclusive UTC bounds', () => {
  const rows = [
    day({ work_day: '2026-08-30' }),
    day({ work_day: '2026-08-31' }),
    day({ work_day: '2026-09-01' }),
  ];

  assert.deepEqual(
    filterPplnsDailyWork(rows, {
      sinceMs: Date.parse('2026-08-31T00:00:00Z'),
      untilMs: Date.parse('2026-09-01T23:59:59Z'),
    }),
    [rows[1], rows[2]],
  );
  assert.equal(filterPplnsDailyWork(rows, { sinceMs: null, untilMs: null }), rows);
});

test('work days are formatted in canonical UTC form', () => {
  assert.equal(formatPplnsWorkDay('2026-08-31'), 'Monday 31 August 2026');
  assert.equal(formatPplnsWorkDay('not-a-day'), 'not-a-day');
});

test('positive retained work at horizon zero makes the account payable', () => {
  const projection = pplnsProjectionFixture();
  projection.horizons[0].retained_difficulty = 5;
  assert.ok(hasPayablePplnsWork(projection));
});

test('visibility follows horizon zero rather than the daily rows', () => {
  const projection = pplnsProjectionFixture();
  projection.horizons[0].retained_difficulty = 0;
  projection.daily_work[0].retained_difficulty = 5;
  assert.equal(hasPayablePplnsWork(projection), false);
  assert.equal(hasPayablePplnsWork(null), false);
  assert.equal(hasPayablePplnsWork(undefined), false);
});
