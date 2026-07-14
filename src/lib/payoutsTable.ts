import type { BlockstreamTx } from '@/lib/blockstream';

export type PayoutMode = 'pplns' | 'fpps';

/**
 * One payout row, assembled client-side from a pool payout wallet's on-chain
 * transactions. `date` is the block time (unix seconds), `amountSats` is the sum of
 * the tx outputs paying the user, `mode` is which pool wallet it came from,
 * `fromAddress` is that wallet, and `toAddress` is the user's address that was paid.
 */
export interface Payout {
  date: number;
  txid: string;
  amountSats: number;
  mode: PayoutMode;
  toAddress: string;
  fromAddress: string;
}

export interface PayoutFilter {
  mode: PayoutMode | null;
  /** Only payouts at or after this unix-second cutoff; null means no date bound. */
  sinceSec: number | null;
}

export const EMPTY_PAYOUT_FILTER: PayoutFilter = { mode: null, sinceSec: null };

/** The date presets shared by the Filter and the Export range picker. */
export type PayoutDatePreset = '24h' | '7d' | '30d';
const PRESET_DAYS: Record<PayoutDatePreset, number> = { '24h': 1, '7d': 7, '30d': 30 };
const DAY_SEC = 24 * 60 * 60;

/** The unix-second cutoff for a date preset, relative to `nowMs`. */
export function sinceForPreset(preset: PayoutDatePreset, nowMs: number): number {
  return Math.floor(nowMs / 1000) - PRESET_DAYS[preset] * DAY_SEC;
}

/** Sort direction for the Filter's Amount category (Highest / Lowest first). */
export type AmountSort = 'highest' | 'lowest';

/** Order payouts by amount; "highest" is descending, "lowest" ascending. */
export function sortPayoutsByAmount(payouts: Payout[], dir: AmountSort): Payout[] {
  const factor = dir === 'highest' ? -1 : 1;
  return [...payouts].sort((a, b) => (a.amountSats - b.amountSats) * factor);
}

export interface DateRange {
  startSec: number;
  endSec: number;
}

/** Payouts whose block time falls within [startSec, endSec], inclusive of both ends. */
export function payoutsInRange(payouts: Payout[], startSec: number, endSec: number): Payout[] {
  return payouts.filter((p) => p.date >= startSec && p.date <= endSec);
}

/** The [now - window, now] range for an export preset (used by the Export CSV picker). */
export function exportPresetRange(preset: PayoutDatePreset, nowMs: number): DateRange {
  const endSec = Math.floor(nowMs / 1000);
  return { startSec: endSec - PRESET_DAYS[preset] * DAY_SEC, endSec };
}

/** Normalize a two-date pick so the earlier is the start (calendar can pick either order). */
export function clampRange(aSec: number, bSec: number): DateRange {
  return { startSec: Math.min(aSec, bSec), endSec: Math.max(aSec, bSec) };
}

/**
 * Expand two picked calendar day-keys (each a UTC midnight) into an inclusive
 * full-day range: 00:00:00 of the earlier day through 23:59:59 of the later day.
 * The end must reach the last second of its day, otherwise an export ending on a
 * day drops every payout after that day's midnight.
 */
export function fullDayRange(aSec: number, bSec: number): DateRange {
  const { startSec, endSec } = clampRange(aSec, bSec);
  return { startSec, endSec: endSec + DAY_SEC - 1 };
}

/** Days in the month and the Monday-based index (0=Mon..6=Sun) of its first day, for the calendar grid. */
export function monthInfo(year: number, month0: number): { daysInMonth: number; firstWeekdayMon: number } {
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const firstWeekdaySun = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0=Sun..6=Sat
  return { daysInMonth, firstWeekdayMon: (firstWeekdaySun + 6) % 7 };
}

/** True when any facet is set (drives the Filter button's active dot + no-match copy). */
export function isPayoutFilterActive(f: PayoutFilter): boolean {
  return f.mode !== null || f.sinceSec !== null;
}

/**
 * Turn one wallet's confirmed transactions into payout rows: one row per tx that
 * pays the user, with the amount summed across that tx's outputs to the user's
 * addresses. Unconfirmed txs (no block_time) and txs that pay no user address are
 * skipped. The first matched user address becomes the row's `toAddress`.
 */
export function buildPayouts(
  txs: BlockstreamTx[],
  mode: PayoutMode,
  fromWallet: string,
  userAddresses: Set<string>,
): Payout[] {
  const rows: Payout[] = [];
  for (const tx of txs) {
    const blockTime = tx.status?.block_time;
    if (typeof blockTime !== 'number') continue;
    let sats = 0;
    let to = '';
    for (const vout of tx.vout ?? []) {
      const addr = vout.scriptpubkey_address;
      if (addr && userAddresses.has(addr)) {
        sats += vout.value ?? 0;
        if (!to) to = addr;
      }
    }
    if (sats > 0) {
      rows.push({ date: blockTime, txid: tx.txid, amountSats: sats, mode, toAddress: to, fromAddress: fromWallet });
    }
  }
  return rows;
}

/** Newest payout first. */
export function sortPayoutsByDateDesc(payouts: Payout[]): Payout[] {
  return [...payouts].sort((a, b) => b.date - a.date);
}

/** Case-insensitive substring match on the transaction id; a blank query passes all. */
export function searchPayouts(payouts: Payout[], query: string): Payout[] {
  const q = query.trim().toLowerCase();
  if (!q) return payouts;
  return payouts.filter((p) => p.txid.toLowerCase().includes(q));
}

/** Filter by mode and/or a since-date cutoff (both optional; combined with AND). */
export function filterPayouts(payouts: Payout[], filter: PayoutFilter): Payout[] {
  return payouts.filter(
    (p) => (filter.mode === null || p.mode === filter.mode) && (filter.sinceSec === null || p.date >= filter.sinceSec),
  );
}

/** BTC from satoshis, trimming float noise and trailing zeros (e.g. 241000 -> "0.00241"). */
export function formatBtcFromSats(sats: number): string {
  return Number((sats / 1e8).toFixed(8)).toString();
}

/** Shorten a long hash/address in the middle: "a4c91d...7bf3". Short strings are left as-is. */
export function truncateMiddle(value: string, head: number, tail: number): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a unix-second timestamp as "21 Jun, 2026" (UTC). */
export function formatPayoutDate(sec: number): string {
  const d = new Date(sec * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/** Block-explorer URL for a transaction id. */
export function mempoolTxUrl(txid: string): string {
  return `https://mempool.space/tx/${txid}`;
}

const CSV_HEADER = 'timestamp,kind,amount_btc,txid,from,to';

function csvCell(value: string): string {
  // Guard against spreadsheet formula injection, then quote when the value holds a
  // comma, quote, or newline (same rule as the other CSVs; kept local).
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** CSV with header `timestamp,kind,amount_btc,txid,from,to`; kind uppercased, cells guarded. */
export function payoutsToCsv(payouts: Payout[]): string {
  const rows = payouts.map((p) =>
    [
      new Date(p.date * 1000).toISOString(),
      p.mode.toUpperCase(),
      formatBtcFromSats(p.amountSats),
      p.txid,
      p.fromAddress,
      p.toAddress,
    ].map(csvCell),
  );
  return [CSV_HEADER, ...rows.map((r) => r.join(','))].join('\n');
}
