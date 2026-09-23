import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratedBtcEntry } from '@/api/types';
import {
  sumGenerated,
  sortGeneratedByDateDesc,
  formatGeneratedDate,
  entryDayMs,
  sinceMsForPreset,
  filterGeneratedBtc,
  isGeneratedBtcFilterActive,
  EMPTY_GENERATED_BTC_FILTER,
  formatBtc,
  todayGeneratedBtc,
  generatedBtcToCsv,
  dedupeGeneratedBtc,
  filterGeneratedBtcByAccount,
  searchGeneratedBtc,
  type GeneratedBtcFilter,
  generatedBtcRowId,
} from '@/lib/generatedBtcTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';

function entry(over: Partial<GeneratedBtcEntry> = {}): GeneratedBtcEntry {
  return { entry_day: '2026-06-21', hashrate: 100e12, btc_generated: 0.0001, fpps_btc_generated: 0.0001, pplns_btc_generated: 0, pplns_hashrate: 0, ...over };
}

test('sumGenerated adds btc_generated across entries; 0 when empty', () => {
  assert.ok(Math.abs(sumGenerated([entry({ btc_generated: 0.001 }), entry({ btc_generated: 0.0004 })]) - 0.0014) < 1e-12);
  assert.equal(sumGenerated([]), 0);
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

test('todayGeneratedBtc picks the entry for the current UTC day', () => {
  const now = Date.parse('2026-07-24T09:30:00Z');
  const entries = [entry({ entry_day: '2026-07-24', btc_generated: 0.5 }), entry({ entry_day: '2026-07-23', btc_generated: 0.25 })];
  assert.equal(todayGeneratedBtc(entries, now), 0.5);
  // Late in the UTC day the answer must not slide onto the neighbouring day.
  assert.equal(todayGeneratedBtc(entries, Date.parse('2026-07-24T23:59:59Z')), 0.5);
  // No entry for today yet reads as nothing generated.
  assert.equal(todayGeneratedBtc([entry({ entry_day: '2026-07-20', btc_generated: 9 })], now), 0);
});

test('formatBtc shows the amount as the API sent it, never in exponent form', () => {
  assert.equal(formatBtc(0.0014), '0.0014');
  assert.equal(formatBtc(0.00001342), '0.00001342');
  assert.equal(formatBtc(0), '0');
  assert.equal(formatBtc(1), '1');
  assert.equal(formatBtc(0.0000005), '0.0000005');
  assert.equal(formatBtc(0.001 + 0.0004), '0.0014');
});

test('generatedBtcToCsv exports both payment modes and zero hashrate, a row per entry, and guards formula injection', () => {
  const csv = generatedBtcToCsv([entry({ entry_day: '2026-06-21', hashrate: 102e12, fpps_btc_generated: 0.00001, pplns_btc_generated: 0.00000342, btc_generated: 0.00001342 })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'entry_day,hashrate,pplns_hashrate,fpps_btc_generated,pplns_btc_generated,btc_generated');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '2026-06-21,102000000000000,0,0.00001,0.00000342,0.00001342');
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

test('generatedBtcRowId distinguishes the same day across accounts', () => {
  // In aggregated mode one calendar day appears once per account, so the day alone
  // cannot identify a row.
  const a = { entry_day: '2026-08-01', hashrate: 1, btc_generated: 1 };
  assert.equal(generatedBtcRowId(a), generatedBtcRowId({ ...a }));
  assert.notEqual(
    generatedBtcRowId({ ...a, account: 'Main account' }),
    generatedBtcRowId({ ...a, account: 'Main Farm' }),
  );
  assert.notEqual(generatedBtcRowId(a), generatedBtcRowId({ ...a, account: 'Main Farm' }));
});
