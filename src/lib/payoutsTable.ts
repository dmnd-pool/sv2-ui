import { csvCell, formatUtcDay } from './utils';
import type { DmndClient, PayoutRecord } from '@/api/types';

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

/** Most recently confirmed transaction, including all its outputs in the current account scope. */
export function latestPayout(payouts: Pick<Payout, 'date' | 'txid' | 'amountSats'>[]): { date: number; amountSats: number } | null {
  const latest = payouts.reduce<(typeof payouts)[number] | null>((found, payout) =>
    !found || payout.date > found.date ? payout : found, null);
  if (!latest) return null;
  return { date: latest.date, amountSats: payouts.reduce((sum, payout) =>
    payout.txid === latest.txid ? sum + payout.amountSats : sum, 0) };
}

/** Newest payout first. */
export function sortPayoutsByDateDesc(payouts: Payout[]): Payout[] {
  return [...payouts].sort((a, b) => b.date - a.date);
}

/** Summarize confirmed outputs in the fetched history, before table filters. */
export function summarizePayouts(payouts: Payout[]): {
  totalSats: number;
  count: number;
  latest: Payout | null;
} {
  let totalSats = 0;
  let latest: Payout | null = null;
  for (const payout of payouts) {
    totalSats += payout.amountSats;
    if (latest === null || payout.date > latest.date) latest = payout;
  }
  return { totalSats, count: payouts.length, latest };
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

/** Same long UTC date used by PPLNS Projection. */
export function formatPayoutDate(sec: number): string {
  const date = new Date(sec * 1000);
  return Number.isNaN(date.getTime()) ? '—' : formatUtcDay(date.toISOString());
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

/** Read confirmed outputs once for the selected scope and sum only the requested UTC day. */
export async function loadTodayPayouts(client: Pick<DmndClient, 'getPayouts' | 'getSubaccountPayouts'>, options: {
  accountId: string;
  ownerAccountId: string;
  aggregated: boolean;
  today: string;
  signal?: AbortSignal;
}): Promise<number> {
  const { accountId, ownerAccountId, aggregated, today, signal } = options;
  const query = { from: today, to: today };
  const req = { signal, accountId: ownerAccountId };
  const records = aggregated
    ? await client.getPayouts(query, req)
    : await client.getSubaccountPayouts(accountId, query, req);
  return records
    .filter((row) => new Date(row.confirmed_at * 1000).toISOString().slice(0, 10) === today)
    .reduce((total, row) => total + row.amount_sats, 0) / 1e8;
}

const PAYOUT_REFRESH_MS = 10 * 60 * 1000;

type PayoutQueryState = { dataUpdatedAt: number; errorUpdatedAt?: number };

/** Keep payout data fresh and available across page navigation for ten minutes. */
export const PAYOUT_QUERY_OPTIONS = {
  staleTime: PAYOUT_REFRESH_MS,
  gcTime: 2 * PAYOUT_REFRESH_MS,
  refetchInterval: (query: { state: PayoutQueryState }) => {
    // A failed refresh must also move the deadline forward, especially after a 429.
    const lastAttemptAt = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt ?? 0);
    return lastAttemptAt ? Math.max(1000, PAYOUT_REFRESH_MS - (Date.now() - lastAttemptAt)) : PAYOUT_REFRESH_MS;
  },
  refetchOnMount: (query: { state: PayoutQueryState }) =>
    !query.state.errorUpdatedAt || Date.now() - query.state.errorUpdatedAt >= PAYOUT_REFRESH_MS,
  refetchOnReconnect: (query: { state: PayoutQueryState }) =>
    !query.state.errorUpdatedAt || Date.now() - query.state.errorUpdatedAt >= PAYOUT_REFRESH_MS,
  retryOnMount: false,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

/** Share the same cached records across Home, payout history, and payout progress. */
export function accountPayoutQueryOptions(client: DmndClient, ownerId: string | null | undefined, accountId: string | null | undefined, aggregated: boolean) {
  return {
    queryKey: ['account', 'payout-records', ownerId, aggregated ? 'tree' : 'single', aggregated ? ownerId : accountId],
    queryFn: ({ signal }: { signal: AbortSignal }) => aggregated
      ? client.getPayouts({}, { signal, accountId: ownerId! })
      : client.getSubaccountPayouts(accountId!, {}, { signal, accountId: ownerId! }),
    ...PAYOUT_QUERY_OPTIONS,
  };
}
