import type { Payout } from './payoutsTable';
import type { GeneratedBtcEntry, PplnsProjection } from '@/api/types';
import { BTC_DISPLAY_DP, csvCell, formatHashrate, formatUtcDay } from '@/lib/utils';

export type GeneratedBtcDisplayEntry = GeneratedBtcEntry & {
  displayBtc?: number;
  displayHashrate?: number;
};

export const generatedAmount = (entry: GeneratedBtcDisplayEntry) => entry.displayBtc ?? entry.fpps_btc_generated;
export const generatedHashrate = (entry: GeneratedBtcDisplayEntry) => entry.displayHashrate ?? entry.hashrate;

/** One account's PPLNS report and whether it is mining PPLNS right now. */
export interface PplnsAccountState {
  projection?: PplnsProjection | null;
  activelyMining: boolean;
}

export function generatedBtcForScheme(
  entries: GeneratedBtcEntry[], showFpps: boolean, projection?: PplnsProjection | null,
  activelyMining = true, today = new Date().toISOString().slice(0, 10), aggregated = false,
  subaccounts: PplnsAccountState[] = [],
): GeneratedBtcDisplayEntry[] {
  const accounts: PplnsAccountState[] = [{ projection, activelyMining }, ...subaccounts];
  return entries.map((entry) => {
    const own = aggregated ? accounts.find((a) => a.projection?.subaccount_id === entry.accountId) : accounts[0];
    const hide = own && !own.activelyMining && own.projection?.calculated_at.slice(0, 10) === today &&
      entry.entry_day === today ? own.projection : null;
    const projectedSats = hide?.daily_work.reduce((sum, work) => sum + work.projected_net_sats, 0) ?? 0;
    const total = hide ? Math.max(entry.fpps_btc_generated, entry.btc_generated - projectedSats / 1e8) : entry.btc_generated;
    const work = aggregated ? undefined : projection?.daily_work.filter((day) =>
      day.work_day === entry.entry_day && day.retained_difficulty > 0).slice(-1)[0];
    return {
      ...entry,
      displayBtc: showFpps ? entry.fpps_btc_generated : Math.max(0, total - entry.fpps_btc_generated),
      displayHashrate: showFpps ? entry.hashrate : (work?.retained_difficulty ?? 0) * 2 ** 32 / 86400,
    };
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC-midnight ms of a moment (drops the time-of-day). */
function utcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** UTC-midnight ms of an entry's day; NaN when the date can't be parsed. */
export function entryDayMs(entry: GeneratedBtcDisplayEntry): number {
  const ms = Date.parse(entry.entry_day);
  return Number.isNaN(ms) ? NaN : utcMidnight(ms);
}

/** Same long UTC date used by PPLNS Projection. */
export const formatGeneratedDate = formatUtcDay;


/** Sum the selected scheme, defaulting to FPPS for raw API rows. */
export function sumGenerated(entries: GeneratedBtcDisplayEntry[]): number {
  return entries.reduce((total, e) => total + generatedAmount(e), 0);
}

/**
 * The BTC generated on the UTC day containing `nowMs`, which is the account-level
 * counterpart of a subaccount's `summary.today_generated_btc`. Entries are keyed by a
 * `YYYY-MM-DD` UTC day, so the comparison is made on that same UTC day rather than the
 * viewer's local one. Returns 0 when today has no entry yet.
 */
export function todayGeneratedBtc(entries: GeneratedBtcDisplayEntry[], nowMs: number): number {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const entry = entries.find((e) => e.entry_day === today);
  return entry?.fpps_btc_generated ?? 0;
}

/**
 * Mean of the daily hashrate readings in the rows shown, so the figure describes the
 * same period the table does.
 */
export function averageEntryHashrate(entries: GeneratedBtcDisplayEntry[]): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, entry) => sum + generatedHashrate(entry), 0) / entries.length;
}

/** The row that generated the most BTC; null when no day carries a reading. */
export function highestEarningDay(entries: GeneratedBtcDisplayEntry[]): GeneratedBtcDisplayEntry | null {
  let best: GeneratedBtcDisplayEntry | null = null;
  for (const entry of entries) {
    if (best === null || generatedAmount(entry) > generatedAmount(best)) best = entry;
  }
  return best;
}

/** Newest day first; entries with an unparseable date sort last. */
export function sortGeneratedByDateDesc(entries: GeneratedBtcDisplayEntry[]): GeneratedBtcDisplayEntry[] {
  const key = (e: GeneratedBtcDisplayEntry): number => {
    const ms = entryDayMs(e);
    return Number.isNaN(ms) ? -Infinity : ms;
  };
  return [...entries].sort((a, b) => key(b) - key(a));
}

/** The Date-filter presets (the Custom option uses a picked range instead). */
export type GbtcDatePreset = '24h' | '7d' | '30d';
const PRESET_DAYS: Record<GbtcDatePreset, number> = { '24h': 1, '7d': 7, '30d': 30 };

/** UTC-midnight cutoff N-1 days before today, so "7d" spans 7 calendar days including today. */
export function sinceMsForPreset(preset: GbtcDatePreset, nowMs: number): number {
  return utcMidnight(nowMs) - (PRESET_DAYS[preset] - 1) * DAY_MS;
}

/** Day-aligned, inclusive date bounds; null means unbounded on that side. */
export interface GeneratedBtcFilter {
  sinceMs: number | null;
  untilMs: number | null;
}

export const EMPTY_GENERATED_BTC_FILTER: GeneratedBtcFilter = { sinceMs: null, untilMs: null };

/** True when either date bound is set (drives the Filter button's active dot + no-match copy). */
export function isGeneratedBtcFilterActive(f: GeneratedBtcFilter): boolean {
  return f.sinceMs !== null || f.untilMs !== null;
}

/** Keep entries whose day falls within [sinceMs, untilMs] (inclusive); an unparseable day is dropped once a bound is set. */
export function filterGeneratedBtc(entries: GeneratedBtcDisplayEntry[], filter: GeneratedBtcFilter): GeneratedBtcDisplayEntry[] {
  if (filter.sinceMs === null && filter.untilMs === null) return entries;
  return entries.filter((e) => {
    const day = entryDayMs(e);
    if (Number.isNaN(day)) return false;
    return (filter.sinceMs === null || day >= filter.sinceMs) && (filter.untilMs === null || day <= filter.untilMs);
  });
}

/** BTC display precision with trailing zeros removed. */
export function formatBtc(n: number): string {
  return n.toFixed(BTC_DISPLAY_DP).replace(/0+$/, '').replace(/\.$/, '');
}

const CSV_HEADER = 'entry_day,hashrate,fpps_btc_generated';


/**
 * A stable identity for one generated-BTC row, used as its React key.
 * In aggregated mode the same calendar
 * day appears once per account, so the day alone is not unique.
 */
export function generatedBtcRowId(e: { entry_day: string; account?: string; accountId?: string }): string {
  return `${e.entry_day}-${e.accountId ?? e.account ?? ''}`;
}

export function generatedBtcToCsv(entries: GeneratedBtcDisplayEntry[], scheme?: 'fpps' | 'pplns'): string {
  const rows = entries.map((e) => [
    e.entry_day,
    scheme ? formatHashrate(generatedHashrate(e)) : String(generatedHashrate(e)),
    scheme ? formatBtc(generatedAmount(e)) : String(generatedAmount(e)),
  ].map(csvCell));
  return [scheme ? 'entry_day,hashrate,btc_generated' : CSV_HEADER, ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Collapse rows that share the same (entry_day, account) to the first occurrence. Each
 * owner (main account or a subaccount) is fetched from its own endpoint and tagged with
 * that owner's name client-side, so this only fires if a single owner's own fetch ever
 * repeats a day (a defensive guard against a duplicate from the server), not because two
 * different owners are compared against each other.
 */
export function dedupeGeneratedBtc(entries: GeneratedBtcDisplayEntry[]): GeneratedBtcDisplayEntry[] {
  const seen = new Set<string>();
  const out: GeneratedBtcDisplayEntry[] = [];
  for (const e of entries) {
    const key = generatedBtcRowId(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Keep entries belonging to the chosen accounts; an empty list keeps them all. */
export function filterGeneratedBtcByAccount(entries: GeneratedBtcDisplayEntry[], accounts: string[]): GeneratedBtcDisplayEntry[] {
  if (accounts.length === 0) return entries;
  return entries.filter((e) => e.account != null && accounts.includes(e.account));
}

/** Search displayed row values (plus ISO dates); a blank query passes all. */
export function searchGeneratedBtc(entries: GeneratedBtcDisplayEntry[], query: string): GeneratedBtcDisplayEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => [
    e.entry_day,
    formatGeneratedDate(e.entry_day),
    e.account ?? '',
    formatHashrate(generatedHashrate(e)),
    `${formatBtc(generatedAmount(e))} BTC`,
  ].some((value) => value.toLowerCase().includes(q)));
}

/** Sum accounts within each UTC day before computing fleet averages and highest-day earnings. */
export function combinedDailyEarnings(entries: GeneratedBtcDisplayEntry[]): GeneratedBtcDisplayEntry[] {
  const days = new Map<string, GeneratedBtcDisplayEntry>();
  for (const entry of entries) {
    const previous = days.get(entry.entry_day);
    days.set(entry.entry_day, {
      entry_day: entry.entry_day,
      hashrate: (previous?.hashrate ?? 0) + entry.hashrate,
      pplns_hashrate: (previous?.pplns_hashrate ?? 0) + entry.pplns_hashrate,
      fpps_btc_generated: (previous?.fpps_btc_generated ?? 0) + entry.fpps_btc_generated,
      pplns_btc_generated: (previous?.pplns_btc_generated ?? 0) + entry.pplns_btc_generated,
      btc_generated: (previous?.btc_generated ?? 0) + entry.btc_generated,
      ...(entry.displayBtc === undefined ? {} : {
        displayBtc: (previous?.displayBtc ?? 0) + generatedAmount(entry),
        displayHashrate: (previous?.displayHashrate ?? 0) + generatedHashrate(entry),
      }),
    });
  }
  return [...days.values()];
}

export const MINIMUM_PAYOUT_SATS = 500_000;

/** Port of Types.Payout.unpaidBalance from user-dashboard's show-minimum-payout-progress branch. */
export function payoutProgress(entries: GeneratedBtcDisplayEntry[], payouts: Payout[], nowMs = Date.now()) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const start = new Date(nowMs - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ledger = new Map<string, number>();
  const add = (day: string, sats: number) => ledger.set(day, (ledger.get(day) ?? 0) + sats);
  for (const entry of entries) {
    if (entry.entry_day >= start && entry.entry_day <= today) {
      add(entry.entry_day, Math.round(entry.fpps_btc_generated * 1e8));
    }
  }
  for (const payout of payouts) {
    if (payout.mode === 'fpps') {
      add(new Date(payout.date * 1000).toISOString().slice(0, 10), -payout.amountSats);
    }
  }
  let balanceSats = 0;
  for (const day of [...ledger.keys()].sort()) {
    balanceSats = Math.max(0, balanceSats + ledger.get(day)!);
  }
  return {
    balanceSats,
    remainingSats: Math.max(0, MINIMUM_PAYOUT_SATS - balanceSats),
    percent: Math.min(100, balanceSats / MINIMUM_PAYOUT_SATS * 100),
  };
}
