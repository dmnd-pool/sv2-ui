import test from 'node:test';
import assert from 'node:assert/strict';
import type { BlockstreamTx } from '@/lib/blockstream';
import {
  buildPayouts,
  sortPayoutsByDateDesc,
  searchPayouts,
  filterPayouts,
  payoutsToCsv,
  formatBtcFromSats,
  truncateMiddle,
  formatPayoutDate,
  mempoolTxUrl,
  sinceForPreset,
  isPayoutFilterActive,
  sortPayoutsByAmount,
  payoutsInRange,
  exportPresetRange,
  monthInfo,
  clampRange,
  EMPTY_PAYOUT_FILTER,
  type Payout,
} from '@/lib/payoutsTable';

const USER = new Set(['bc1quser', 'bc1qalt']);
const WALLET = 'bc1qpool';

function tx(over: Partial<BlockstreamTx> & { txid: string }): BlockstreamTx {
  return {
    status: { confirmed: true, block_time: 1_718_000_000 },
    vout: [],
    ...over,
  };
}
function payout(over: Partial<Payout> = {}): Payout {
  return { date: 1_718_000_000, txid: 't', amountSats: 1000, mode: 'pplns', toAddress: 'bc1quser', fromAddress: WALLET, ...over };
}

test('buildPayouts: one row per tx that pays the user, summing the user outputs', () => {
  const txs: BlockstreamTx[] = [
    tx({ txid: 'a', vout: [{ scriptpubkey_address: 'bc1quser', value: 200 }, { scriptpubkey_address: 'bc1qother', value: 5 }] }),
    tx({ txid: 'b', vout: [{ scriptpubkey_address: 'bc1quser', value: 100 }, { scriptpubkey_address: 'bc1qalt', value: 50 }] }), // two user outputs -> summed
    tx({ txid: 'c', vout: [{ scriptpubkey_address: 'bc1qother', value: 999 }] }), // pays no user address -> excluded
  ];
  const rows = buildPayouts(txs, 'pplns', WALLET, USER);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => [r.txid, r.amountSats, r.mode, r.toAddress, r.fromAddress]),
    [
      ['a', 200, 'pplns', 'bc1quser', WALLET],
      ['b', 150, 'pplns', 'bc1quser', WALLET], // first matched user address wins for the column
    ],
  );
});

test('buildPayouts: skips unconfirmed txs (no block_time)', () => {
  const txs: BlockstreamTx[] = [
    tx({ txid: 'u', status: { confirmed: false }, vout: [{ scriptpubkey_address: 'bc1quser', value: 500 }] }),
  ];
  assert.equal(buildPayouts(txs, 'fpps', WALLET, USER).length, 0);
});

test('sortPayoutsByDateDesc orders newest first', () => {
  const rows = [payout({ txid: 'old', date: 100 }), payout({ txid: 'new', date: 300 }), payout({ txid: 'mid', date: 200 })];
  assert.deepEqual(sortPayoutsByDateDesc(rows).map((r) => r.txid), ['new', 'mid', 'old']);
});

test('searchPayouts matches the txid case-insensitively; blank passes all', () => {
  const rows = [payout({ txid: 'A4C91D7bf3' }), payout({ txid: 'ff00aa' })];
  assert.equal(searchPayouts(rows, 'a4c91d').length, 1);
  assert.equal(searchPayouts(rows, 'FF00').length, 1);
  assert.equal(searchPayouts(rows, '   ').length, 2);
  assert.equal(searchPayouts(rows, 'zzz').length, 0);
});

test('filterPayouts by mode and since-date, combined (AND)', () => {
  const rows = [
    payout({ txid: 'p_old', mode: 'pplns', date: 100 }),
    payout({ txid: 'p_new', mode: 'pplns', date: 300 }),
    payout({ txid: 'f_new', mode: 'fpps', date: 300 }),
  ];
  assert.deepEqual(filterPayouts(rows, EMPTY_PAYOUT_FILTER).map((r) => r.txid), ['p_old', 'p_new', 'f_new']);
  assert.deepEqual(filterPayouts(rows, { ...EMPTY_PAYOUT_FILTER, mode: 'pplns' }).map((r) => r.txid), ['p_old', 'p_new']);
  assert.deepEqual(filterPayouts(rows, { ...EMPTY_PAYOUT_FILTER, sinceSec: 250 }).map((r) => r.txid), ['p_new', 'f_new']);
  assert.deepEqual(filterPayouts(rows, { mode: 'pplns', sinceSec: 250 }).map((r) => r.txid), ['p_new']);
});

test('formatBtcFromSats converts and trims trailing zeros', () => {
  assert.equal(formatBtcFromSats(241000), '0.00241');
  assert.equal(formatBtcFromSats(0), '0');
  assert.equal(formatBtcFromSats(100000000), '1');
});

test('truncateMiddle shortens long strings and leaves short ones intact', () => {
  assert.equal(truncateMiddle('a4c91d0000000000007bf3', 6, 4), 'a4c91d...7bf3');
  assert.equal(truncateMiddle('bc1q00000000007h9f', 4, 4), 'bc1q...7h9f');
  assert.equal(truncateMiddle('short', 6, 4), 'short'); // no truncation when already short
});

test('mempoolTxUrl builds the explorer link', () => {
  assert.equal(mempoolTxUrl('abc123'), 'https://mempool.space/tx/abc123');
});

test('sinceForPreset subtracts the right window from now', () => {
  const now = Date.UTC(2026, 5, 30, 0, 0, 0);
  assert.equal(sinceForPreset('24h', now), Math.floor(now / 1000) - 86400);
  assert.equal(sinceForPreset('7d', now), Math.floor(now / 1000) - 7 * 86400);
  assert.equal(sinceForPreset('30d', now), Math.floor(now / 1000) - 30 * 86400);
});

test('isPayoutFilterActive is true only when a facet is set', () => {
  assert.equal(isPayoutFilterActive(EMPTY_PAYOUT_FILTER), false);
  assert.equal(isPayoutFilterActive({ mode: 'fpps', sinceSec: null }), true);
  assert.equal(isPayoutFilterActive({ mode: null, sinceSec: 123 }), true);
});

test('formatPayoutDate renders the "21 Jun, 2026" style in UTC', () => {
  const sec = Math.floor(Date.UTC(2026, 5, 21, 10, 0, 0) / 1000);
  assert.equal(formatPayoutDate(sec), '21 Jun, 2026');
});

test('sortPayoutsByAmount orders by amount, highest or lowest first', () => {
  const rows = [payout({ txid: 'mid', amountSats: 200 }), payout({ txid: 'hi', amountSats: 900 }), payout({ txid: 'lo', amountSats: 50 })];
  assert.deepEqual(sortPayoutsByAmount(rows, 'highest').map((r) => r.txid), ['hi', 'mid', 'lo']);
  assert.deepEqual(sortPayoutsByAmount(rows, 'lowest').map((r) => r.txid), ['lo', 'mid', 'hi']);
});

test('payoutsInRange keeps payouts within [startSec, endSec] inclusive', () => {
  const rows = [payout({ txid: 'a', date: 100 }), payout({ txid: 'b', date: 200 }), payout({ txid: 'c', date: 300 })];
  assert.deepEqual(payoutsInRange(rows, 150, 300).map((r) => r.txid), ['b', 'c']);
  assert.deepEqual(payoutsInRange(rows, 200, 200).map((r) => r.txid), ['b']); // single-day inclusive both ends
  assert.deepEqual(payoutsInRange(rows, 0, 99).map((r) => r.txid), []);
});

test('exportPresetRange returns [now-window, now] for each preset', () => {
  const now = Date.UTC(2026, 5, 30, 12, 0, 0);
  const nowSec = Math.floor(now / 1000);
  assert.deepEqual(exportPresetRange('24h', now), { startSec: nowSec - 86400, endSec: nowSec });
  assert.deepEqual(exportPresetRange('7d', now), { startSec: nowSec - 7 * 86400, endSec: nowSec });
  assert.deepEqual(exportPresetRange('30d', now), { startSec: nowSec - 30 * 86400, endSec: nowSec });
});

test('monthInfo gives days-in-month and a Monday-based first weekday', () => {
  // January 2026: 31 days, the 1st is a Thursday -> Monday-based index 3.
  assert.deepEqual(monthInfo(2026, 0), { daysInMonth: 31, firstWeekdayMon: 3 });
  // February 2026 (non-leap): 28 days, the 1st is a Sunday -> Monday-based index 6.
  assert.deepEqual(monthInfo(2026, 1), { daysInMonth: 28, firstWeekdayMon: 6 });
});

test('clampRange normalizes so start <= end regardless of pick order', () => {
  assert.deepEqual(clampRange(300, 100), { startSec: 100, endSec: 300 });
  assert.deepEqual(clampRange(100, 300), { startSec: 100, endSec: 300 });
});

test('payoutsToCsv emits the production schema header, uppercase kind, and guards formula injection', () => {
  const rows = [
    payout({ date: Math.floor(Date.UTC(2026, 5, 21) / 1000), txid: 'a4c91d', amountSats: 241000, mode: 'pplns', fromAddress: '=EVIL', toAddress: 'bc1quser' }),
  ];
  const csv = payoutsToCsv(rows);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'timestamp,kind,amount_btc,txid,from,to');
  assert.match(lines[1], /,PPLNS,0\.00241,a4c91d,/); // uppercase kind + trimmed btc
  assert.match(lines[1], /'=EVIL/); // formula-injection guard on the from address
});
