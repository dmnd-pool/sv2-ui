import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkerStatCardsView } from '@/components/home/WorkerStatCards';
import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratedBtcEntry, Subaccount, SubaccountShareStats, SubaccountSummary, Worker } from '@/api/types';
import {
  subaccountName,
  parseHashrate,
  hasSubaccountHashrate,
  rejectionFromStats,
  enrichSubaccount,
  deriveSubaccountsPageStats,
  searchSubaccounts,
  sortSubaccounts,
  subaccountsToCsv,
  withGeneratedBtc,
  sumGeneratedBtc,
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
    fpps_token: null,
    hashrate: '',
    bitcoin_addresses: {},
    ...over,
  };
}
function enriched(over: Partial<EnrichedSubaccount> = {}): EnrichedSubaccount {
  return { id: '1', name: 'X', hashrate: 0, pplns: 0, fpps: 0, active: 0, offline: 0, pplnsPassword: 't', fppsPassword: null, rejection: null, accepted: 0, rejected: 0, todayEarnings: 0, generatedBtc: null, workers: [], ...over };
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

test('hasSubaccountHashrate is true only when a subaccount reports a positive rate', () => {
  assert.equal(hasSubaccountHashrate([row({ hashrate: '0' }), row({ hashrate: '125000000' })]), true);
  assert.equal(hasSubaccountHashrate([row({ hashrate: '0' }), row({ hashrate: '' })]), false);
});

test('rejectionFromStats derives rejected/(accepted+rejected); null without shares', () => {
  assert.equal(rejectionFromStats(STATS), 2 / 1000);
  assert.equal(rejectionFromStats({ ...STATS, accepted: 0, rejected: 0 }), null);
  assert.equal(rejectionFromStats(null), null);
});

function summary(over: Partial<SubaccountSummary> = {}): SubaccountSummary {
  return {
    sub_account_id: '1',
    hashrate: { account_id: '1', observed_at: null, pplns_hashrate: 0, fpps_hashrate: 0, total_hashrate: 0 },
    share_stats: STATS,
    fees: { pool_fee: 0.02, broker_fee: 0 },
    today_generated_btc: null,
    ...over,
  };
}

test('subaccount live totals use the same persisted snapshot as chart history, including zero', () => {
  const snapshot = { account_id: '1', observed_at: '2026-10-21T12:00:00Z', pplns_hashrate: 10, fpps_hashrate: 20, total_hashrate: 30 };
  const legacy = row({ hashrate: '900' });
  const live = enrichSubaccount(legacy, summary({ hashrate: snapshot }), []);
  assert.equal(live.hashrate, snapshot.total_hashrate);
  assert.equal(live.hashrate, live.pplns + live.fpps);
  assert.equal(enrichSubaccount(legacy, summary({ hashrate: { ...snapshot, total_hashrate: 0, pplns_hashrate: 0, fpps_hashrate: 0 } }), []).hashrate, 0);
});

test('enrichSubaccount combines the row with workers and the summary (rejection + earnings)', () => {
  const workers = [
    worker({ name: 'a', is_connected: true }),
    worker({ name: 'b', is_connected: true }),
  ];
  const e = enrichSubaccount(
    row({ id: '7', sub_account: 'Farm', hashrate: '50' }),
    summary({ hashrate: { account_id: '7', observed_at: null, pplns_hashrate: 50, fpps_hashrate: 0, total_hashrate: 50 }, share_stats: { ...STATS, accepted: 99, rejected: 1 }, today_generated_btc: 0.002 }),
    workers,
  );
  assert.deepEqual(
    { id: e.id, name: e.name, hashrate: e.hashrate, active: e.active, offline: e.offline, rejection: e.rejection, todayEarnings: e.todayEarnings },
    { id: '7', name: 'Farm', hashrate: 50, active: 2, offline: 0, rejection: 1 / 100, todayEarnings: 0.002 },
  );
  assert.equal(e.pplnsPassword, 't');
  assert.equal(e.fppsPassword, null);
  // Raw share counts are carried through for correct cross-subaccount rejection.
  assert.equal(e.accepted, 99);
  assert.equal(e.rejected, 1);
});

test('enrichSubaccount defaults raw share counts to 0 without a summary', () => {
  const e = enrichSubaccount(row({ id: '8', sub_account: 'NoStats', hashrate: '0' }), null, []);
  assert.equal(e.accepted, 0);
  assert.equal(e.rejected, 0);
});

test('enrichSubaccount defaults rejection to null and earnings to 0 when the summary is missing', () => {
  const e = enrichSubaccount(row({ id: '9', sub_account: 'NoSummary', hashrate: '10' }), null, []);
  assert.equal(e.rejection, null);
  assert.equal(e.todayEarnings, 0);
  assert.equal(e.hashrate, 10);
  assert.equal(e.active, 0);
});

test('deriveSubaccountsPageStats sums hashrate and earnings without worker counts', () => {
  const stats = deriveSubaccountsPageStats([
    enriched({ active: 30, hashrate: 100, todayEarnings: 0.001 }),
    enriched({ active: 1, hashrate: 25, todayEarnings: 0.0004 }),
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.combinedHashrate, 125);
  assert.ok(Math.abs(stats.todayEarnings - 0.0014) < 1e-9);
});

test('summary rejection rate weights subaccounts by submitted shares', () => {
  const stats = deriveSubaccountsPageStats([
    enriched({ accepted: 990, rejected: 10, rejection: 0.01 }),
    enriched({ accepted: 0, rejected: 10, rejection: 1 }),
    enriched({ accepted: 0, rejected: 0, rejection: null }),
  ]);
  assert.equal(stats.averageRejectionRate, 20 / 1010);
});

test('summary rejection rate distinguishes no shares from zero rejections', () => {
  assert.equal(deriveSubaccountsPageStats([]).averageRejectionRate, null);
  assert.equal(deriveSubaccountsPageStats([enriched()]).averageRejectionRate, null);
  assert.equal(deriveSubaccountsPageStats([enriched({ accepted: 100 })]).averageRejectionRate, 0);
});

test('searchSubaccounts matches every displayed field; blank passes all', () => {
  const rows = [
    enriched({
      id: 'farm-id',
      name: 'Main Farm',
      active: 4,
      pplnsPassword: 'pplns-secret',
      fppsPassword: 'fpps-secret',
      hashrate: 125_000_000,
      rejection: 0.012,
      generatedBtc: 0.4,
      todayEarnings: 0.02,
    }),
    enriched({ id: 'warehouse-id', name: 'Warehouse 01' }),
  ];
  assert.equal(searchSubaccounts(rows, 'farm').length, 1);
  assert.equal(searchSubaccounts(rows, 'WARE').length, 1);
  assert.equal(searchSubaccounts(rows, 'farm-id').length, 1);
  assert.equal(searchSubaccounts(rows, 'pplns-secret').length, 1);
  assert.equal(searchSubaccounts(rows, 'fpps-secret').length, 1);
  assert.equal(searchSubaccounts(rows, '125.00 MH/s').length, 1);
  assert.equal(searchSubaccounts(rows, '1.20%').length, 1);
  assert.equal(searchSubaccounts(rows, '0.4 BTC').length, 0);
  assert.equal(searchSubaccounts(rows, '0.02 BTC').length, 1);
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
  assert.equal(isSubaccountFilterActive(f({ rejection: 'lt1' })), true);
  assert.equal(isSubaccountFilterActive(f({ sortBy: 'hashrate_desc' })), true);
});

test('applySubaccountFilter: empty filter passes all, default order is name asc', () => {
  const rows = [enriched({ id: '1', name: 'Beta' }), enriched({ id: '2', name: 'alpha' })];
  assert.deepEqual(applySubaccountFilter(rows, EMPTY_SUBACCOUNT_FILTER).map((s) => s.name), ['alpha', 'Beta']);
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
    enriched({ id: 'a', hashrate: 50, generatedBtc: 0.003, todayEarnings: 0.001 }),
    enriched({ id: 'b', hashrate: 200, generatedBtc: 0.001, todayEarnings: 0.003 }),
  ];
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'hashrate_desc' })).map((s) => s.id), ['b', 'a']);
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'hashrate_asc' })).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'earnings_desc' })).map((s) => s.id), ['b', 'a']);
  assert.deepEqual(applySubaccountFilter(rows, f({ sortBy: 'earnings_asc' })).map((s) => s.id), ['a', 'b']);
});

test('applySubaccountFilter: rejection and sorting combine', () => {
  const rows = [
    enriched({ id: 'keep', rejection: 0.02, hashrate: 10 }),
    enriched({ id: 'first', rejection: 0.02, hashrate: 99 }),
    enriched({ id: 'wrongRej', rejection: 0.5, hashrate: 100 }),
  ];
  const out = applySubaccountFilter(rows, f({ rejection: '1to3', sortBy: 'hashrate_desc' }));
  assert.deepEqual(out.map((s) => s.id), ['first', 'keep']);
});

function gen(account: string, fpps: number, pplns = 0): GeneratedBtcEntry {
  return { entry_day: '2026-08-01', hashrate: 0, btc_generated: fpps + pplns, fpps_btc_generated: fpps, pplns_btc_generated: pplns, pplns_hashrate: 0, account };
}

test('withGeneratedBtc sums FPPS BTC from the account-tagged entries', () => {
  const subs = [enriched({ id: '1', name: 'Alpha' }), enriched({ id: '2', name: 'Beta' })];
  const out = withGeneratedBtc(subs, [gen('Alpha', 0.5, 20), gen('Alpha', 0.25, 30), gen('Beta', 1, 40)]);
  assert.equal(out[0].generatedBtc, 0.75);
  assert.equal(out[1].generatedBtc, 1);
});

test('withGeneratedBtc replaces the misleading newest-row amount with the selected UTC day', () => {
  const entries = [
    { entry_day: '2026-08-12', hashrate: 0, btc_generated: 8.25, fpps_btc_generated: 0.25, pplns_btc_generated: 8, pplns_hashrate: 0, account: 'Alpha' },
    { entry_day: '2026-08-11', hashrate: 0, btc_generated: 16, fpps_btc_generated: 9, pplns_btc_generated: 7, pplns_hashrate: 0, account: 'Alpha' },
  ];
  const [out] = withGeneratedBtc([enriched({ name: 'Alpha', todayEarnings: 9 })], entries, Date.parse('2026-08-12T18:00:00Z'));
  assert.equal(out.todayEarnings, 0.25);
});

test('withGeneratedBtc reports null (not 0) when an account has no entries', () => {
  const subs = [enriched({ id: '1', name: 'Alpha' }), enriched({ id: '2', name: 'Beta' })];
  const out = withGeneratedBtc(subs, [gen('Alpha', 0.5)]);
  assert.equal(out[0].generatedBtc, 0.5);
  assert.equal(out[1].generatedBtc, null, 'an account with no entries is unknown');
});

test('withGeneratedBtc ignores entries belonging to another account', () => {
  const out = withGeneratedBtc([enriched({ name: 'Alpha' })], [gen('Main account', 9), gen('Alpha', 0.1)]);
  assert.equal(out[0].generatedBtc, 0.1);
});

test('subaccountsToCsv exports today FPPS earnings instead of lifetime BTC', () => {
  const csv = subaccountsToCsv([
    enriched({ name: 'Alpha', active: 2, hashrate: 1000, rejection: 0.01, generatedBtc: 0.5, todayEarnings: 0.25 }),
  ]);
  const [header, first] = csv.split('\n');
  assert.equal(header, "Name,Hashrate,Rejection rate,\"Today's generated BTC (FPPS, UTC)\"");
  assert.equal(first, 'Alpha,1.00 KH/s,1.00%,0.25');
});

test('subaccountsToCsv does not depend on lifetime history availability', () => {
  const csv = subaccountsToCsv([enriched({ name: 'Alpha', generatedBtc: null })]);
  assert.equal(csv.split('\n')[1].split(',')[3], '0');
});

test('sumGeneratedBtc totals only FPPS from untagged entries and reports null when there are none', () => {
  assert.equal(sumGeneratedBtc([gen('', 0.5, 9), gen('', 0.25, 8)]), 0.75);
  assert.equal(sumGeneratedBtc([]), null);
});

test('aggregate home earnings display supplied confirmed payouts rather than accrued generated earnings', () => {
  const aggregated = { totalWorkers: 0, activeWorkers: 0, offlineWorkers: 0, combinedHashrate: 0, todayEarnings: 9, rejectionRate: null };
  const html = renderToStaticMarkup(createElement(WorkerStatCardsView, { aggregated, payout: { amountSats: 1_000_000, date: Date.UTC(2026, 9, 20) / 1000 } }));
  assert.match(html, />0\.01<\/span>/);
  assert.match(html, /Paid on Tuesday 20 October 2026 \(UTC\)/);
  assert.doesNotMatch(html, /Generated today|>9<\/span>/);
  const unknown = renderToStaticMarkup(createElement(WorkerStatCardsView, { aggregated }));
  assert.doesNotMatch(unknown, />9<\/span>/);
});
