import assert from 'node:assert/strict';
import test from 'node:test';

import type { Subaccount, SubaccountShareStats, SubaccountSummary, Worker } from '@/api/types';
import {
  subaccountName,
  parseHashrate,
  rejectionFromStats,
  enrichSubaccount,
  deriveSubaccountsPageStats,
  searchSubaccounts,
  sortSubaccounts,
  subaccountsToCsv,
  formatBtc,
  applySubaccountFilter,
  isSubaccountFilterActive,
  EMPTY_SUBACCOUNT_FILTER,
  type EnrichedSubaccount,
  type SubaccountFilter,
} from '@/lib/subaccountsTable';

function row(over: Partial<Subaccount> = {}): Subaccount {
  return {
    id: '1',
    sub_account: 'X',
    token: 't',
    api_token: 'a',
    fpps_token: null,
    hashrate: '',
    bitcoin_addresses: {},
    ...over,
  };
}
function enriched(over: Partial<EnrichedSubaccount> = {}): EnrichedSubaccount {
  return { id: '1', name: 'X', hashrate: 0, active: 0, offline: 0, offline24h: 0, rejection: null, accepted: 0, rejected: 0, todayEarnings: 0, workers: [], ...over };
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

test('subaccountName uses sub_account (trimmed), falling back to the id when blank', () => {
  assert.equal(subaccountName(row({ sub_account: 'A' })), 'A');
  assert.equal(subaccountName(row({ sub_account: '  Farm  ' })), 'Farm');
  assert.equal(subaccountName(row({ sub_account: '', id: 'zz9' })), 'Subaccount zz9');
  assert.equal(subaccountName(row({ sub_account: '   ', id: 'zz9' })), 'Subaccount zz9');
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

function summary(over: Partial<SubaccountSummary> = {}): SubaccountSummary {
  return { sub_account_id: 1, hashrate: null, share_stats: null, fees: null, today_generated_btc: null, ...over };
}

test('enrichSubaccount combines the row with workers and the summary (rejection + earnings)', () => {
  const now = Date.UTC(2026, 5, 29, 12);
  const day = 24 * 60 * 60 * 1000;
  const workers = [
    worker({ name: 'a', is_connected: true }),
    worker({ name: 'b', is_connected: false, connected_at: Math.floor((now - 2 * day) / 1000) }),
  ];
  const e = enrichSubaccount(
    row({ id: '7', sub_account: 'Farm', hashrate: '50' }),
    summary({ share_stats: { ...STATS, accepted: 99, rejected: 1 }, today_generated_btc: 0.002 }),
    workers,
    now,
  );
  assert.deepEqual(
    { id: e.id, name: e.name, hashrate: e.hashrate, active: e.active, offline: e.offline, offline24h: e.offline24h, rejection: e.rejection, todayEarnings: e.todayEarnings },
    { id: '7', name: 'Farm', hashrate: 50, active: 1, offline: 1, offline24h: 1, rejection: 1 / 100, todayEarnings: 0.002 },
  );
  // Raw share counts are carried through for correct cross-subaccount rejection.
  assert.equal(e.accepted, 99);
  assert.equal(e.rejected, 1);
});

test('enrichSubaccount defaults raw share counts to 0 without a summary', () => {
  const e = enrichSubaccount(row({ id: '8', sub_account: 'NoStats', hashrate: '0' }), null, [], Date.UTC(2026, 5, 29, 12));
  assert.equal(e.accepted, 0);
  assert.equal(e.rejected, 0);
});

test('enrichSubaccount defaults rejection to null and earnings to 0 when the summary is missing', () => {
  const now = Date.UTC(2026, 5, 29, 12);
  const e = enrichSubaccount(row({ id: '9', sub_account: 'NoSummary', hashrate: '10' }), null, [], now);
  assert.equal(e.rejection, null);
  assert.equal(e.todayEarnings, 0);
  assert.equal(e.hashrate, 10);
  assert.equal(e.active, 0);
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

const f = (over: Partial<SubaccountFilter> = {}): SubaccountFilter => ({ ...EMPTY_SUBACCOUNT_FILTER, ...over });

test('isSubaccountFilterActive is true only when a facet is set', () => {
  assert.equal(isSubaccountFilterActive(EMPTY_SUBACCOUNT_FILTER), false);
  assert.equal(isSubaccountFilterActive(f({ status: 'healthy' })), true);
  assert.equal(isSubaccountFilterActive(f({ sortBy: 'hashrate_desc' })), true);
});

test('applySubaccountFilter: empty filter passes all, default order is name asc', () => {
  const rows = [enriched({ id: '1', name: 'Beta' }), enriched({ id: '2', name: 'alpha' })];
  assert.deepEqual(applySubaccountFilter(rows, EMPTY_SUBACCOUNT_FILTER).map((s) => s.name), ['alpha', 'Beta']);
});

test('applySubaccountFilter: status buckets (healthy / has offline / >24h)', () => {
  const rows = [
    enriched({ id: 'h', offline: 0, offline24h: 0 }),
    enriched({ id: 'o', offline: 2, offline24h: 0 }),
    enriched({ id: 'd', offline: 3, offline24h: 1 }),
  ];
  assert.deepEqual(applySubaccountFilter(rows, f({ status: 'healthy' })).map((s) => s.id), ['h']);
  // "has offline" includes the >24h subset (both o and d have offline > 0)
  assert.deepEqual(applySubaccountFilter(rows, f({ status: 'has_offline' })).map((s) => s.id).sort(), ['d', 'o']);
  assert.deepEqual(applySubaccountFilter(rows, f({ status: 'has_offline_24h' })).map((s) => s.id), ['d']);
});

test('applySubaccountFilter: rejection buckets with inclusive 1%-3% edges; null excluded when active', () => {
  const rows = [
    enriched({ id: 'lt', rejection: 0.005 }),
    enriched({ id: 'lo', rejection: 0.01 }), // exactly 1% -> in the 1%-3% bucket
    enriched({ id: 'hi', rejection: 0.03 }), // exactly 3% -> in the 1%-3% bucket
    enriched({ id: 'gt', rejection: 0.05 }),
    enriched({ id: 'nul', rejection: null }),
  ];
  assert.deepEqual(applySubaccountFilter(rows, f({ rejection: 'lt1' })).map((s) => s.id), ['lt']);
  assert.deepEqual(applySubaccountFilter(rows, f({ rejection: '1to3' })).map((s) => s.id).sort(), ['hi', 'lo']);
  assert.deepEqual(applySubaccountFilter(rows, f({ rejection: 'gt3' })).map((s) => s.id), ['gt']);
  // a null rejection (no shares) matches no bucket, so it is filtered out
  assert.equal(applySubaccountFilter(rows, f({ rejection: 'lt1' })).some((s) => s.id === 'nul'), false);
});

test('applySubaccountFilter: sort by hashrate and earnings, both directions', () => {
  const rows = [
    enriched({ id: 'a', hashrate: 50, todayEarnings: 0.003 }),
    enriched({ id: 'b', hashrate: 200, todayEarnings: 0.001 }),
  ];
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'hashrate_desc' })).map((s) => s.id), ['b', 'a']);
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'hashrate_asc' })).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'earnings_desc' })).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'earnings_asc' })).map((s) => s.id), ['b', 'a']);
});

test('applySubaccountFilter: status and rejection combine (AND), then sort', () => {
  const rows = [
    enriched({ id: 'keep', offline: 1, rejection: 0.02, hashrate: 10 }),
    enriched({ id: 'wrongStatus', offline: 0, rejection: 0.02, hashrate: 99 }),
    enriched({ id: 'wrongRej', offline: 1, rejection: 0.5, hashrate: 99 }),
  ];
  const out = applySubaccountFilter(rows, f({ status: 'has_offline', rejection: '1to3', sortBy: 'hashrate_desc' }));
  assert.deepEqual(out.map((s) => s.id), ['keep']);
});
