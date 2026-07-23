import test from 'node:test';
import assert from 'node:assert/strict';
import type { EnrichedSubaccount } from '@/lib/subaccountsTable';
import { sumSubaccountStats, donutSlices } from '@/lib/aggregatedStats';

function sub(over: Partial<EnrichedSubaccount> = {}): EnrichedSubaccount {
  return {
    id: '1',
    name: 'sub',
    hashrate: 0,
    active: 0,
    offline: 0,
    offline24h: 0,
    rejection: null,
    accepted: 0,
    rejected: 0,
    todayEarnings: 0,
    workers: [],
    ...over,
  };
}

test('sumSubaccountStats sums workers/hashrate/earnings and combines rejection from raw shares', () => {
  const subs = [
    sub({ id: 'a', active: 3, offline: 1, offline24h: 1, hashrate: 10, todayEarnings: 0.5, accepted: 1000, rejected: 10 }),
    sub({ id: 'b', active: 2, offline: 0, offline24h: 0, hashrate: 20, todayEarnings: 0.25, accepted: 500, rejected: 5 }),
    sub({ id: 'c', active: 0, offline: 2, offline24h: 2, hashrate: 5, todayEarnings: 0.125, accepted: 2000, rejected: 40 }),
  ];
  const agg = sumSubaccountStats(subs);
  assert.equal(agg.totalWorkers, 8); // (3+1)+(2+0)+(0+2)
  assert.equal(agg.activeWorkers, 5);
  assert.equal(agg.offlineWorkers, 3);
  assert.equal(agg.offline24h, 3);
  assert.equal(agg.combinedHashrate, 35);
  assert.equal(agg.todayEarnings, 0.875); // 0.5 + 0.25 + 0.125, binary-exact
  // combined rate is totalRejected / (totalAccepted + totalRejected), not an average of per-sub rates
  const expected = 55 / (3500 + 55);
  assert.ok(agg.rejectionRate !== null && Math.abs(agg.rejectionRate - expected) < 1e-9);
});

test('sumSubaccountStats on an empty list is all zeros with a null rate', () => {
  const agg = sumSubaccountStats([]);
  assert.equal(agg.totalWorkers, 0);
  assert.equal(agg.activeWorkers, 0);
  assert.equal(agg.offlineWorkers, 0);
  assert.equal(agg.offline24h, 0);
  assert.equal(agg.combinedHashrate, 0);
  assert.equal(agg.todayEarnings, 0);
  assert.equal(agg.rejectionRate, null);
});

test('sumSubaccountStats returns a null rate when no sub has any shares', () => {
  const subs = [
    sub({ id: 'a', active: 2, hashrate: 10, accepted: 0, rejected: 0 }),
    sub({ id: 'b', active: 1, hashrate: 5, accepted: 0, rejected: 0 }),
  ];
  const agg = sumSubaccountStats(subs);
  assert.equal(agg.rejectionRate, null); // null, not 0 and not NaN, from a 0/0 denominator
  assert.equal(agg.totalWorkers, 3);
});

test('donutSlices maps every sub in order, keeping a zero-hashrate sub', () => {
  const subs = [
    sub({ id: 'a', name: 'Alpha', hashrate: 10 }),
    sub({ id: 'b', name: 'Bravo', hashrate: 0 }),
    sub({ id: 'c', name: 'Charlie', hashrate: 5 }),
  ];
  assert.deepEqual(donutSlices(subs), [
    { id: 'a', name: 'Alpha', hashrate: 10 },
    { id: 'b', name: 'Bravo', hashrate: 0 },
    { id: 'c', name: 'Charlie', hashrate: 5 },
  ]);
});
