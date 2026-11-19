import type { Payout } from '@/lib/payoutsTable';
import { payoutProgress } from '@/lib/generatedBtcTable';
import { PayoutProgressCard } from '@/pages/generated-btc/GeneratedBtcPage';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';

import { pplnsProjectionFixture } from '@/api/__tests__/pplnsProjectionFixture';
import { GeneratedBtcTable } from '@/components/generated-btc/GeneratedBtcTable';
import type { GeneratedBtcEntry } from '@/api/types';
import {
  generatedBtcForScheme,
  generatedAmount,
  generatedHashrate,
  combinedDailyEarnings,
  averageEntryHashrate,
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
  highestEarningDay,
  searchGeneratedBtc,
  type GeneratedBtcFilter,
  generatedBtcRowId,
} from '@/lib/generatedBtcTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';

function entry(over: Partial<GeneratedBtcEntry> = {}): GeneratedBtcEntry {
  return { entry_day: '2026-06-21', hashrate: 100e12, btc_generated: 0.0001, fpps_btc_generated: 0.0001, pplns_btc_generated: 0, pplns_hashrate: 0, ...over };
}

test('sumGenerated adds only FPPS-generated BTC; 0 when empty', () => {
  const entries = [
    entry({ fpps_btc_generated: 0.001, pplns_btc_generated: 9, btc_generated: 9.001 }),
    entry({ fpps_btc_generated: 0.0004, pplns_btc_generated: 8, btc_generated: 8.0004 }),
  ];
  assert.ok(Math.abs(sumGenerated(entries) - 0.0014) < 1e-12);
  assert.equal(sumGenerated([]), 0);
});

test('both scheme views keep every day, including days with no work in that scheme, like legacy', () => {
  const raw = [
    entry({ entry_day: '2026-06-21', hashrate: 0, fpps_btc_generated: 0, btc_generated: 0.002 }),
    entry({ entry_day: '2026-06-20', hashrate: 100e12, fpps_btc_generated: 0.001, btc_generated: 0.001 }),
  ];
  const fpps = generatedBtcForScheme(raw, true);
  assert.deepEqual(fpps.map((row) => row.entry_day), ['2026-06-21', '2026-06-20']);
  assert.deepEqual(fpps.map(generatedAmount), [0, 0.001]);
  assert.deepEqual(generatedBtcForScheme(raw, false).map(generatedAmount), [0.002, 0]);
});

test('sortGeneratedByDateDesc orders newest entry_day first', () => {
  const out = sortGeneratedByDateDesc([entry({ entry_day: '2026-06-21' }), entry({ entry_day: '2026-07-08' })]);
  assert.deepEqual(out.map((e) => e.entry_day), ['2026-07-08', '2026-06-21']);
});

test('formatGeneratedDate renders the same long UTC date as PPLNS Projection', () => {
  assert.equal(formatGeneratedDate('2026-06-21'), 'Sunday 21 June 2026');
  assert.equal(formatGeneratedDate('2026-07-08'), 'Wednesday 8 July 2026');
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
  const entries = [
    entry({ entry_day: '2026-07-24', fpps_btc_generated: 0.5, pplns_btc_generated: 7, btc_generated: 7.5 }),
    entry({ entry_day: '2026-07-23', fpps_btc_generated: 0.25, pplns_btc_generated: 6, btc_generated: 6.25 }),
  ];
  assert.equal(todayGeneratedBtc(entries, now), 0.5);
  // Late in the UTC day the answer must not slide onto the neighbouring day.
  assert.equal(todayGeneratedBtc(entries, Date.parse('2026-07-24T23:59:59Z')), 0.5);
  // No entry for today yet reads as nothing generated.
  assert.equal(todayGeneratedBtc([entry({ entry_day: '2026-07-20', fpps_btc_generated: 9 })], now), 0);
});

test('highestEarningDay compares FPPS earnings rather than the combined API total', () => {
  const fppsWinner = entry({ entry_day: '2026-07-24', fpps_btc_generated: 2, btc_generated: 2 });
  const pplnsHeavy = entry({ entry_day: '2026-07-23', fpps_btc_generated: 1, pplns_btc_generated: 99, btc_generated: 100 });
  assert.equal(highestEarningDay([pplnsHeavy, fppsWinner]), fppsWinner);
});

test('formatBtc shows the amount as the API sent it, never in exponent form', () => {
  assert.equal(formatBtc(0.0014), '0.0014');
  assert.equal(formatBtc(0.00001342), '0.00001342');
  assert.equal(formatBtc(0), '0');
  assert.equal(formatBtc(1), '1');
  assert.equal(formatBtc(0.0000005), '0.0000005');
  assert.equal(formatBtc(0.001 + 0.0004), '0.0014');
});

test('generatedBtcToCsv exports only FPPS fields, one row per entry, and guards formula injection', () => {
  const csv = generatedBtcToCsv([entry({ entry_day: '2026-06-21', hashrate: 102e12, fpps_btc_generated: 0.00001, pplns_btc_generated: 0.00000342, btc_generated: 0.00001342 })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'entry_day,hashrate,fpps_btc_generated');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '2026-06-21,102000000000000,0.00001');
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
  // A row with no account cannot match an account name.
  assert.equal(searchGeneratedBtc([entry({ account: undefined })], 'main').length, 0);
});

test('searchGeneratedBtc searches visible dates, hashrate and BTC amounts in single-account mode', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', hashrate: 100e12, fpps_btc_generated: 0.0123 }),
    entry({ entry_day: '2026-06-21', hashrate: 50e12, fpps_btc_generated: 0.0045 }),
  ];
  for (const query of ['2026-07-08', 'Wednesday 8 July 2026', '100.00 TH/s', '0.0123', '  JUL  ']) {
    assert.deepEqual(searchGeneratedBtc(rows, query), [rows[0]]);
  }
  assert.deepEqual(searchGeneratedBtc(rows, '0.0045 BTC'), [rows[1]]);
  assert.deepEqual(searchGeneratedBtc(rows, 'no match'), []);
  assert.equal(searchGeneratedBtc(rows, '  '), rows);
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

function aggregateEntry(day: string, accountId: string, btc: number, hashrate: number): GeneratedBtcEntry {
  return { entry_day: day, accountId, account: 'Shared display name', fpps_btc_generated: btc, hashrate, pplns_btc_generated: 100, btc_generated: btc + 100, pplns_hashrate: 0 };
}

test('combined generated summaries sum accounts by day before averaging hashrate or selecting the best day', () => {
  const rows = [aggregateEntry('2026-10-20', '1', 1, 10), aggregateEntry('2026-10-20', '2', 2, 20), aggregateEntry('2026-10-21', '1', 4, 40), aggregateEntry('2026-10-21', '2', 0.5, 5)];
  const unique = dedupeGeneratedBtc([...rows, rows[0]]);
  assert.equal(unique.length, 4, 'matching display names must not merge different accounts');
  const days = combinedDailyEarnings(unique);
  assert.equal(days.length, 2);
  assert.equal(sumGenerated(days), 7.5);
  assert.equal(averageEntryHashrate(days), 37.5);
  assert.equal(highestEarningDay(days)?.fpps_btc_generated, 4.5);
  assert.equal(highestEarningDay(days)?.entry_day, '2026-10-21');
  assert.equal(rows[0].hashrate, 10, 'account rows must remain unchanged');
});

const now = Date.parse('2026-10-21T15:00:00Z');
function progressEntry(entry_day: string, sats: number): GeneratedBtcEntry {
  return { entry_day, fpps_btc_generated: sats / 1e8, pplns_btc_generated: 5, btc_generated: 5 + sats / 1e8, hashrate: 1, pplns_hashrate: 1 };
}
function payout(day: string, amountSats: number, mode: Payout['mode'] = 'fpps', outputIndex = 0): Payout {
  return { date: Date.parse(`${day}T12:00:00Z`) / 1000, amountSats, mode, outputIndex, txid: 'tx', toAddress: 'addr', fromAddress: '' };
}

test('matches the reference FPPS-only balance calculation within the 30-day UTC window', () => {
  const progress = payoutProgress([
    progressEntry('2026-09-21', 400_000), // Outside the window.
    progressEntry('2026-09-22', 50_000), // Inclusive start.
    progressEntry('2026-10-21', 200_000),
    progressEntry('2026-10-22', 100_000), // Future earnings are excluded.
  ], [payout('2026-10-21', 60_000), payout('2026-10-21', 40_000, 'pplns')], now);
  assert.deepEqual(progress, { balanceSats: 190_000, remainingSats: 310_000, percent: 38 });
});

test('an older payout cannot absorb earnings generated on a later day', () => {
  const progress = payoutProgress([progressEntry('2026-10-21', 200_000)], [payout('2026-10-20', 500_000)], now);
  assert.equal(progress.balanceSats, 200_000);
});

test('processes the daily ledger chronologically and never carries a negative balance', () => {
  const progress = payoutProgress([
    progressEntry('2026-10-21', 50_000),
    progressEntry('2026-10-19', 100_000),
    progressEntry('2026-10-20', 20_000),
  ], [payout('2026-10-20', 200_000)], now);
  assert.equal(progress.balanceSats, 50_000);
});

test('rounds each daily earnings amount to satoshis and subtracts separate outputs of the same transaction', () => {
  const progress = payoutProgress([progressEntry('2026-10-21', 200_000.4)], [
    payout('2026-10-21', 10_000, 'fpps', 0),
    payout('2026-10-21', 20_000, 'fpps', 1),
  ], now);
  assert.equal(progress.balanceSats, 170_000);
});

test('empty history starts at zero; reaching or exceeding the minimum clamps progress to 100 percent', () => {
  assert.deepEqual(payoutProgress([], [], now), { balanceSats: 0, remainingSats: 500_000, percent: 0 });
  for (const sats of [500_000, 700_000]) {
    assert.deepEqual(payoutProgress([progressEntry('2026-10-21', sats)], [], now), { balanceSats: sats, remainingSats: 0, percent: 100 });
  }
});

test('progress card distinguishes unknown payout data from a genuine zero balance', () => {
  for (const data of [
    { payouts: undefined, isLoading: true, isError: false },
    { payouts: undefined, isLoading: false, isError: true },
    { payouts: [payout('2026-10-21', 100)], isLoading: false, isError: true },
  ]) {
    const html = renderToStaticMarkup(createElement(PayoutProgressCard, { entries: [], data, isLoading: false, isError: false }));
    assert.doesNotMatch(html, /role="progressbar"/);
    assert.match(html, /Loading payout progress|Payout progress unavailable/);
  }
  const empty = renderToStaticMarkup(createElement(PayoutProgressCard, {
    entries: [], data: { payouts: [], isLoading: false, isError: false }, isLoading: false, isError: false,
  }));
  assert.match(empty, /role="progressbar"/);
  assert.match(empty, /aria-valuenow="0"/);
  assert.match(empty, /0\.005 BTC more needed/);
});


test('PPLNS scheme matches legacy total-minus-FPPS earnings and retained-work hashrate', () => {
  const projection = pplnsProjectionFixture();
  const raw = [entry({ entry_day: '2026-08-31', btc_generated: 0.003, fpps_btc_generated: 0.001,
    pplns_btc_generated: 99, pplns_hashrate: 99 })];
  const [pplns] = generatedBtcForScheme(raw, false, projection);
  assert.equal(generatedAmount(pplns), 0.002);
  assert.equal(generatedHashrate(pplns), 2 ** 32 / 86400);
  const [fpps] = generatedBtcForScheme(raw, true, projection);
  assert.equal(generatedAmount(fpps), 0.001);
  assert.equal(generatedHashrate(fpps), raw[0].hashrate);
  assert.equal(raw[0].btc_generated, 0.003);
  assert.equal(generatedAmount(generatedBtcForScheme([entry({ btc_generated: 0 })], false)[0]), 0);
  assert.equal(generatedHashrate(generatedBtcForScheme(raw, false)[0]), 0);
});

test('inactive PPLNS removes only today projection, preserving historical rewards and FPPS', () => {
  const projection = pplnsProjectionFixture();
  projection.daily_work[0].projected_net_sats = 100_000;
  const raw = [entry({ entry_day: '2026-08-31', btc_generated: 0.003, fpps_btc_generated: 0.001 }),
    entry({ entry_day: '2026-08-30', btc_generated: 0.003, fpps_btc_generated: 0.001 })];
  const inactive = generatedBtcForScheme(raw, false, projection, false, '2026-08-31');
  assert.equal(generatedAmount(inactive[0]), 0.001);
  assert.equal(generatedAmount(inactive[1]), 0.002);
  assert.equal(generatedAmount(generatedBtcForScheme(raw, false, projection, true, '2026-08-31')[0]), 0.002);
  assert.equal(generatedAmount(generatedBtcForScheme(raw, false, projection, false, '2026-09-01')[0]), 0.002);
  assert.equal(generatedAmount(generatedBtcForScheme(raw, true, projection, false, '2026-08-31')[0]), 0.001);
  projection.daily_work[0].projected_net_sats = 999_999;
  assert.equal(generatedAmount(generatedBtcForScheme(raw, false, projection, false, '2026-08-31')[0]), 0);
});

test('aggregate PPLNS hides each inactive account projection with its own report, like legacy', () => {
  const report = (id: string, sats: number) => {
    const projection = pplnsProjectionFixture();
    projection.subaccount_id = id;
    projection.daily_work[0].projected_net_sats = sats;
    return projection;
  };
  const raw = ['123', '456', '789', '999'].map((accountId) => entry({ accountId, entry_day: '2026-08-31',
    btc_generated: 0.003, fpps_btc_generated: 0.001 }));
  const rows = generatedBtcForScheme(raw, false, report('123', 100_000), false, '2026-08-31', true, [
    { projection: report('456', 50_000), activelyMining: false },
    { projection: report('789', 100_000), activelyMining: true },
  ]);
  // Main and inactive subaccount lose their own projection; active and unknown accounts keep theirs.
  assert.deepEqual(rows.map((row) => Math.round(generatedAmount(row) * 1e8)), [100_000, 150_000, 200_000, 200_000]);
  assert.deepEqual(rows.map(generatedHashrate), [0, 0, 0, 0]);
  const daily = combinedDailyEarnings(rows);
  assert.equal(daily.length, 1);
  assert.equal(Math.round(sumGenerated(daily) * 1e8), 650_000);
});

test('selected scheme drives search, summaries, desktop/mobile table and CSV', () => {
  const rows = generatedBtcForScheme([entry({ btc_generated: 0.004, fpps_btc_generated: 0.001 }),
    entry({ entry_day: '2026-06-20', btc_generated: 0.006, fpps_btc_generated: 0.005 })], false);
  assert.ok(Math.abs(sumGenerated(rows) - 0.004) < 1e-12);
  assert.equal(highestEarningDay(rows)?.entry_day, '2026-06-21');
  assert.equal(averageEntryHashrate(rows), 0);
  assert.equal(searchGeneratedBtc(rows, '0.003 BTC').length, 1);
  const csv = generatedBtcToCsv(rows, 'pplns');
  assert.match(csv, /^entry_day,hashrate,btc_generated/);
  assert.match(csv, /2026-06-21,0 H\/s,0.003/);
  const html = renderToStaticMarkup(createElement(GeneratedBtcTable, { entries: rows, scheme: 'PPLNS' }));
  assert.match(html, /PPLNS hashrate/);
  assert.doesNotMatch(html, /FPPS hashrate/);
  assert.equal((html.match(/0.003/g) ?? []).length, 2);
});
