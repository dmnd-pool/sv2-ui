import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratedBtcEntry, Worker } from '@/api/types';
import {
  sumGenerated,
  averageWorkerHashrate,
  workersWithSharesCount,
  sortGeneratedByDateDesc,
  formatGeneratedDate,
  entryDayMs,
  sinceMsForPreset,
  filterGeneratedBtc,
  isGeneratedBtcFilterActive,
  EMPTY_GENERATED_BTC_FILTER,
  formatBtc,
  generatedBtcToCsv,
  dedupeGeneratedBtc,
  filterGeneratedBtcByAccount,
  searchGeneratedBtc,
  type GeneratedBtcFilter,
} from '@/lib/generatedBtcTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';

function entry(over: Partial<GeneratedBtcEntry> = {}): GeneratedBtcEntry {
  return { entry_day: '2026-06-21', hashrate: 100e12, btc_generated: 0.0001, ...over };
}
function worker(over: Partial<Worker> = {}): Worker {
  return { name: 'w', hashrate: 100, total_shares: 1, rejected_shares: 0, is_connected: true, ...over };
}

test('sumGenerated adds btc_generated across entries; 0 when empty', () => {
  assert.ok(Math.abs(sumGenerated([entry({ btc_generated: 0.001 }), entry({ btc_generated: 0.0004 })]) - 0.0014) < 1e-12);
  assert.equal(sumGenerated([]), 0);
});

test('averageWorkerHashrate is the mean over connected workers with a hashrate; 0 when none', () => {
  const workers = [
    worker({ hashrate: 100, is_connected: true }),
    worker({ hashrate: 200, is_connected: true }),
    worker({ hashrate: 999, is_connected: false }), // offline -> ignored
    worker({ hashrate: null, is_connected: true }), // no reading -> ignored
  ];
  assert.equal(averageWorkerHashrate(workers), 150);
  assert.equal(averageWorkerHashrate([]), 0);
  assert.equal(averageWorkerHashrate([worker({ hashrate: null, is_connected: true })]), 0);
});

test('workersWithSharesCount counts workers that submitted any (pplns or fpps) shares', () => {
  const workers = [
    worker({ total_shares: 10, fpps_total_shares: 0 }),
    worker({ total_shares: 0, fpps_total_shares: 5 }),
    worker({ total_shares: 0, fpps_total_shares: 0 }),
    worker({ total_shares: null, fpps_total_shares: null }),
  ];
  assert.equal(workersWithSharesCount(workers), 2);
  assert.equal(workersWithSharesCount([]), 0);
});

test('sortGeneratedByDateDesc orders newest entry_day first', () => {
  const out = sortGeneratedByDateDesc([entry({ entry_day: '2026-06-21' }), entry({ entry_day: '2026-07-08' })]);
  assert.deepEqual(out.map((e) => e.entry_day), ['2026-07-08', '2026-06-21']);
});

test('formatGeneratedDate renders "21 Jun, 2026" in UTC', () => {
  assert.equal(formatGeneratedDate('2026-06-21'), '21 Jun, 2026');
  assert.equal(formatGeneratedDate('2026-07-08'), '8 Jul, 2026');
});

test('entryDayMs is the UTC midnight ms of the day; NaN for an unparseable date', () => {
  assert.equal(entryDayMs(entry({ entry_day: '2026-06-21' })), Date.UTC(2026, 5, 21));
  assert.ok(Number.isNaN(entryDayMs(entry({ entry_day: 'not-a-date' }))));
});

test('sinceMsForPreset returns a UTC-midnight cutoff N-1 days before today', () => {
  const now = Date.UTC(2026, 6, 12, 15, 30); // 2026-07-12 15:30 UTC
  assert.equal(sinceMsForPreset('24h', now), Date.UTC(2026, 6, 12));
  assert.equal(sinceMsForPreset('7d', now), Date.UTC(2026, 6, 6));
  assert.equal(sinceMsForPreset('30d', now), Date.UTC(2026, 5, 13));
});

test('filterGeneratedBtc keeps entries within the since/until day bounds (inclusive); null bounds pass all', () => {
  const es = [entry({ entry_day: '2026-06-21' }), entry({ entry_day: '2026-07-08' })];
  assert.deepEqual(
    filterGeneratedBtc(es, { sinceMs: Date.UTC(2026, 6, 1), untilMs: null }).map((e) => e.entry_day),
    ['2026-07-08'],
  );
  assert.deepEqual(
    filterGeneratedBtc(es, { sinceMs: null, untilMs: Date.UTC(2026, 5, 30) }).map((e) => e.entry_day),
    ['2026-06-21'],
  );
  // inclusive on the exact end day
  assert.deepEqual(
    filterGeneratedBtc(es, { sinceMs: null, untilMs: Date.UTC(2026, 6, 8) }).map((e) => e.entry_day),
    ['2026-06-21', '2026-07-08'],
  );
  assert.equal(filterGeneratedBtc(es, EMPTY_GENERATED_BTC_FILTER).length, 2);
  // an unparseable date is excluded once any bound is set
  assert.equal(
    filterGeneratedBtc([entry({ entry_day: 'bad' })], { sinceMs: Date.UTC(2026, 0, 1), untilMs: null }).length,
    0,
  );
});

test('isGeneratedBtcFilterActive is true only when a bound is set', () => {
  assert.equal(isGeneratedBtcFilterActive(EMPTY_GENERATED_BTC_FILTER), false);
  assert.equal(isGeneratedBtcFilterActive({ sinceMs: 1, untilMs: null }), true);
  assert.equal(isGeneratedBtcFilterActive({ sinceMs: null, untilMs: 1 }), true);
});

test('formatBtc trims float noise and trailing zeros', () => {
  assert.equal(formatBtc(0.001 + 0.0004), '0.0014');
  assert.equal(formatBtc(0), '0');
  assert.equal(formatBtc(0.00001342), '0.00001342');
});

test('generatedBtcToCsv emits the prod schema header, a row per entry, and guards formula injection', () => {
  const csv = generatedBtcToCsv([entry({ entry_day: '2026-06-21', hashrate: 102e12, btc_generated: 0.00001342 })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'entry_day,hashrate,btc_generated');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '2026-06-21,102000000000000,0.00001342');
  // a leading '=' in a cell is neutralized
  const inj = generatedBtcToCsv([entry({ entry_day: '=SUM(A1)', hashrate: 1, btc_generated: 1 })]);
  assert.match(inj.split('\n')[1], /^'=SUM\(A1\)/);
});

test('dedupeGeneratedBtc keeps the first row per (entry_day, account); a single-owner fetch is untouched', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', btc_generated: 0.001, account: MAIN_ACCOUNT_LABEL }),
    entry({ entry_day: '2026-07-08', btc_generated: 0.001, account: 'Client Alpha' }),
    // an exact duplicate (same day, same owner) — collapses to the first
    entry({ entry_day: '2026-07-08', btc_generated: 0.999, account: 'Client Alpha' }),
    entry({ entry_day: '2026-07-09', btc_generated: 0.002, account: 'Client Alpha' }),
  ];
  const out = dedupeGeneratedBtc(rows);
  assert.equal(out.length, 3);
  assert.equal(out.find((e) => e.entry_day === '2026-07-08' && e.account === 'Client Alpha')?.btc_generated, 0.001);
});

test('dedupeGeneratedBtc treats rows with no account as their own bucket', () => {
  const rows = [entry({ entry_day: '2026-07-08', account: undefined }), entry({ entry_day: '2026-07-08', account: undefined })];
  assert.equal(dedupeGeneratedBtc(rows).length, 1);
});

test('filterGeneratedBtcByAccount keeps only the chosen accounts; empty keeps all', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', account: MAIN_ACCOUNT_LABEL }),
    entry({ entry_day: '2026-07-09', account: 'Client Alpha' }),
  ];
  assert.equal(filterGeneratedBtcByAccount(rows, []).length, 2);
  assert.deepEqual(
    filterGeneratedBtcByAccount(rows, ['Client Alpha']).map((e) => e.entry_day),
    ['2026-07-09'],
  );
});

test('searchGeneratedBtc matches the account name case-insensitively; a blank query passes all', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', account: MAIN_ACCOUNT_LABEL }),
    entry({ entry_day: '2026-07-09', account: 'Client Alpha' }),
  ];
  assert.deepEqual(searchGeneratedBtc(rows, 'alpha').map((e) => e.entry_day), ['2026-07-09']);
  assert.equal(searchGeneratedBtc(rows, '').length, 2);
  // a row with no account (single-account mode) never matches a non-empty query
  assert.equal(searchGeneratedBtc([entry({ account: undefined })], 'main').length, 0);
});

// The GeneratedBtcFilter type is exercised through the calls above.
const _typecheck: GeneratedBtcFilter = EMPTY_GENERATED_BTC_FILTER;
void _typecheck;
