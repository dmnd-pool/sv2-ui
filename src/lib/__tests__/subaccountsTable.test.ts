import assert from 'node:assert/strict';
import test from 'node:test';

import type { Subaccount, SubaccountShareStats, Worker } from '@/api/types';
import {
  subaccountName,
  parseHashrate,
  rejectionFromStats,
  todayEarnings,
  enrichSubaccount,
  deriveSubaccountsPageStats,
  searchSubaccounts,
  sortSubaccounts,
  subaccountsToCsv,
  formatBtc,
  type EnrichedSubaccount,
} from '@/lib/subaccountsTable';

function row(over: Partial<Subaccount> = {}): Subaccount {
  return { id: '1', ...over };
}
function enriched(over: Partial<EnrichedSubaccount> = {}): EnrichedSubaccount {
  return { id: '1', name: 'X', hashrate: 0, active: 0, offline: 0, offline24h: 0, rejection: null, todayEarnings: 0, ...over };
}
function worker(over: Partial<Worker> = {}): Worker {
  return { name: 'w', hashrate: 1, total_shares: 0, rejected_shares: 0, is_connected: true, ...over };
}

const STATS: SubaccountShareStats = {
  window_hours: 24,
  pplns_accepted: 0,
  pplns_rejected: 0,
  fpps_accepted: 0,
  fpps_rejected: 0,
  accepted: 998,
  rejected: 2,
};

test('subaccountName prefers sub_account, then the other keys, then the id', () => {
  assert.equal(subaccountName(row({ sub_account: 'A', name: 'B' })), 'A');
  assert.equal(subaccountName(row({ sub_account_name: 'C' })), 'C');
  assert.equal(subaccountName(row({ subaccount: 'D' })), 'D');
  assert.equal(subaccountName(row({ name: 'E' })), 'E');
  assert.equal(subaccountName(row({ id: 'zz9' })), 'Subaccount zz9');
});

test('parseHashrate parses the numeric string; 0 when blank or NaN', () => {
  assert.equal(parseHashrate(row({ hashrate: '125000000' })), 125000000);
  assert.equal(parseHashrate(row({ hashrate: '0' })), 0);
  assert.equal(parseHashrate(row({})), 0);
  assert.equal(parseHashrate(row({ hashrate: 'oops' })), 0);
});

test('rejectionFromStats derives rejected/(accepted+rejected); null without shares', () => {
  assert.equal(rejectionFromStats(STATS), 2 / 1000);
  assert.equal(rejectionFromStats({ ...STATS, accepted: 0, rejected: 0 }), null);
  assert.equal(rejectionFromStats(null), null);
});

test("todayEarnings picks today's entry, else 0", () => {
  const now = Date.UTC(2026, 5, 29, 12);
  const today = new Date(now).toISOString().slice(0, 10);
  assert.equal(todayEarnings([{ entry_day: today, btc_generated: 0.0007 }], now), 0.0007);
  assert.equal(todayEarnings([{ entry_day: '2020-01-01', btc_generated: 9 }], now), 0);
  assert.equal(todayEarnings([], now), 0);
});

test('enrichSubaccount combines the row with workers, share_stats, and earnings', () => {
  const now = Date.UTC(2026, 5, 29, 12);
  const today = new Date(now).toISOString().slice(0, 10);
  const day = 24 * 60 * 60 * 1000;
  const workers = [
    worker({ name: 'a', is_connected: true }),
    worker({ name: 'b', is_connected: false, connected_at: new Date(now - 2 * day).toISOString() }),
  ];
  const e = enrichSubaccount(
    row({ id: '7', sub_account: 'Farm', hashrate: '50' }),
    { ...STATS, accepted: 99, rejected: 1 },
    workers,
    [{ entry_day: today, btc_generated: 0.002 }],
    now,
  );
  assert.deepEqual(
    { id: e.id, name: e.name, hashrate: e.hashrate, active: e.active, offline: e.offline, offline24h: e.offline24h, rejection: e.rejection, todayEarnings: e.todayEarnings },
    { id: '7', name: 'Farm', hashrate: 50, active: 1, offline: 1, offline24h: 1, rejection: 1 / 100, todayEarnings: 0.002 },
  );
});

test('deriveSubaccountsPageStats sums active workers, hashrate, and earnings', () => {
  const stats = deriveSubaccountsPageStats([
    enriched({ active: 30, hashrate: 100, todayEarnings: 0.001 }),
    enriched({ active: 1, hashrate: 25, todayEarnings: 0.0004 }),
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.activeWorkers, 31);
  assert.equal(stats.combinedHashrate, 125);
  assert.ok(Math.abs(stats.todayEarnings - 0.0014) < 1e-9);
});

test('searchSubaccounts matches name case-insensitively; blank passes all', () => {
  const rows = [enriched({ name: 'Main Farm' }), enriched({ name: 'Warehouse 01' })];
  assert.equal(searchSubaccounts(rows, 'farm').length, 1);
  assert.equal(searchSubaccounts(rows, 'WARE').length, 1);
  assert.equal(searchSubaccounts(rows, '  ').length, 2);
});

test('sortSubaccounts orders by the chosen key and direction', () => {
  const rows = [enriched({ name: 'Beta', hashrate: 50 }), enriched({ name: 'Alpha', hashrate: 200 })];
  assert.deepEqual(sortSubaccounts(rows, 'name', 'asc').map((s) => s.name), ['Alpha', 'Beta']);
  assert.deepEqual(sortSubaccounts(rows, 'hashrate', 'desc').map((s) => s.hashrate), [200, 50]);
});

test('subaccountsToCsv emits a header, a row per subaccount, and guards formula injection', () => {
  const csv = subaccountsToCsv([
    enriched({ name: '=cmd', active: 3, offline: 1, hashrate: 125, rejection: 0.002, todayEarnings: 0.00042 }),
  ]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /Name/);
  assert.match(lines[1], /'=cmd/);
  assert.match(lines[1], /125/);
  assert.match(lines[1], /0\.20%/);
});

test('formatBtc trims float noise and trailing zeros', () => {
  assert.equal(formatBtc(0.001 + 0.0004), '0.0014');
  assert.equal(formatBtc(0), '0');
  assert.equal(formatBtc(0.00042), '0.00042');
});
