import type { PayoutRecord } from '@/api/types';

export type PayoutMode = 'pplns' | 'fpps';

/**
 * One confirmed payout output adapted from the dashboard API for the table.
 * `date` is the confirmation time in unix seconds and `outputIndex` keeps separate
 * outputs from the same transaction independently selectable.
 */
export interface Payout {
  date: number;
  txid: string;
  amountSats: number;
  mode: PayoutMode;
  toAddress: string;
  outputIndex: number;
  /** Kept for the existing CSV schema; the payout API does not expose its source address. */
  fromAddress: string;
  // Which account was paid, shown only in aggregated mode where rows span accounts.
  account?: string;
}

/** An account and the receiving addresses it owns, for attributing a payout. */
export interface PayoutAccount {
  name: string;
  addresses: Set<string>;
}

// The label for the main (parent) account in aggregated mode. Shared by the row tag,
// the Filter's Account facet, and the filter itself so all three match exactly.
export const MAIN_ACCOUNT_LABEL = 'Main account';

/**
 * The account that owns a paid-to address. Accounts can legitimately share one
 * receiving address (verified on a live account whose subaccounts all reuse the
 * main address), which makes attribution ambiguous; the first matching owner wins,
 * so callers list the main account first rather than inventing a split. Returns null
 * when no account owns the address.
 *
 * If an address is shared within the account tree, the first matching owner wins;
 * callers list the main account first to keep that choice stable.
 */
export function accountForAddress(address: string, owners: PayoutAccount[]): string | null {
  for (const owner of owners) {
    if (owner.addresses.has(address)) return owner.name;
  }
  return null;
}

/** Keep payouts belonging to the chosen accounts; an empty list keeps them all. */
export function filterPayoutsByAccount(payouts: Payout[], accounts: string[]): Payout[] {
  if (accounts.length === 0) return payouts;
  return payouts.filter((p) => p.account != null && accounts.includes(p.account));
}

export interface PayoutFilter {
  // Modes to keep. The design draws PPLNS and FPPS as checkboxes, both checked, so an
  // empty list means "every mode" rather than "no modes" -- otherwise clearing the
  // facet would blank the table instead of widening it.
  modes: PayoutMode[];
  /** Only payouts at or after this unix-second cutoff; null means no date bound. */
  sinceSec: number | null;
}

export const EMPTY_PAYOUT_FILTER: PayoutFilter = { modes: [], sinceSec: null };

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
 * Is this day one of the two ends of the picked range?
 *
 * The design paints the endpoints solid and the days between them tinted, so the two
 * cases have to be distinguishable. Between the first and second click there is a
 * single selected day and no span, which still reads as an endpoint.
 */
export function isRangeEndpoint(key: number, start: number | null, end: number | null): boolean {
  if (start === null) return false;
  if (end === null) return key === start;
  return key === Math.min(start, end) || key === Math.max(start, end);
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
  return f.modes.length > 0 || f.sinceSec !== null;
}

/** Adapt the payout endpoint's snake_case record to the table's view model. */
export function payoutFromApi(row: PayoutRecord): Payout {
  return {
    date: row.confirmed_at,
    txid: row.txid,
    amountSats: row.amount_sats,
    mode: row.kind,
    toAddress: row.address,
    outputIndex: row.output_index,
    fromAddress: '',
  };
}

/**
 * A stable identity for one payout row, used as the React key and as the selection key
 * so the two can never disagree. A single transaction can pay more than one of the
 * user's addresses or multiple outputs to the same address, so the output index is
 * part of the identity.
 */
export function payoutRowId(p: Payout): string {
  return `${p.txid}-${p.outputIndex}-${p.toAddress}-${p.account ?? ''}`;
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
    (p) =>
      (filter.modes.length === 0 || filter.modes.includes(p.mode)) &&
      (filter.sinceSec === null || p.date >= filter.sinceSec),
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

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Format a unix-second timestamp as "January 10, 2026" (UTC), which is how the
 * calendar's two date inputs are written. Read in UTC because the picker's day keys
 * are UTC midnights; a local read would slip a day for anyone west of Greenwich.
 */
export function formatCalendarDate(sec: number): string {
  const d = new Date(sec * 1000);
  return `${MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
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
