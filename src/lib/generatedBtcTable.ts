import type { GeneratedBtcEntry, Worker } from '@/api/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** UTC-midnight ms of a moment (drops the time-of-day). */
function utcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** UTC-midnight ms of an entry's day; NaN when the date can't be parsed. */
export function entryDayMs(entry: GeneratedBtcEntry): number {
  const ms = Date.parse(entry.entry_day);
  return Number.isNaN(ms) ? NaN : utcMidnight(ms);
}

/** Format a `YYYY-MM-DD` day as "21 Jun, 2026" (UTC); passes the raw string through if unparseable. */
export function formatGeneratedDate(entryDay: string): string {
  const ms = Date.parse(entryDay);
  if (Number.isNaN(ms)) return entryDay;
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/** Sum of gross BTC generated across the entries; 0 when empty. */
export function sumGenerated(entries: GeneratedBtcEntry[]): number {
  return entries.reduce((total, e) => total + (e.btc_generated || 0), 0);
}

/** Mean hashrate over connected workers that report a reading; 0 when none qualify. */
export function averageWorkerHashrate(workers: Worker[]): number {
  const readings = workers.filter((w) => w.is_connected && w.hashrate != null).map((w) => w.hashrate as number);
  if (readings.length === 0) return 0;
  return readings.reduce((s, h) => s + h, 0) / readings.length;
}

/** Count of workers that have submitted at least one share (PPLNS or FPPS). */
export function workersWithSharesCount(workers: Worker[]): number {
  return workers.filter((w) => (w.total_shares ?? 0) + (w.fpps_total_shares ?? 0) > 0).length;
}

/** Newest day first; entries with an unparseable date sort last. */
export function sortGeneratedByDateDesc(entries: GeneratedBtcEntry[]): GeneratedBtcEntry[] {
  const key = (e: GeneratedBtcEntry): number => {
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
export function filterGeneratedBtc(entries: GeneratedBtcEntry[], filter: GeneratedBtcFilter): GeneratedBtcEntry[] {
  if (filter.sinceMs === null && filter.untilMs === null) return entries;
  return entries.filter((e) => {
    const day = entryDayMs(e);
    if (Number.isNaN(day)) return false;
    return (filter.sinceMs === null || day >= filter.sinceMs) && (filter.untilMs === null || day <= filter.untilMs);
  });
}

/** BTC for display: clamps to 8 dp and trims float noise + trailing zeros. */
export function formatBtc(n: number): string {
  return Number(n.toFixed(8)).toString();
}

const CSV_HEADER = 'entry_day,hashrate,btc_generated';

function csvCell(value: string): string {
  // Guard against spreadsheet formula injection, then quote when the value holds a
  // comma, quote, or newline (same rule as the other CSVs; kept local).
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** CSV with the production schema `entry_day,hashrate,btc_generated`; raw values, cells guarded. */
export function generatedBtcToCsv(entries: GeneratedBtcEntry[]): string {
  const rows = entries.map((e) => [e.entry_day, String(e.hashrate), String(e.btc_generated)].map(csvCell));
  return [CSV_HEADER, ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Collapse rows that share the same (entry_day, account) to the first occurrence. Each
 * owner (main account or a subaccount) is fetched from its own endpoint and tagged with
 * that owner's name client-side, so this only fires if a single owner's own fetch ever
 * repeats a day (a defensive guard against a duplicate from the server), not because two
 * different owners are compared against each other.
 */
export function dedupeGeneratedBtc(entries: GeneratedBtcEntry[]): GeneratedBtcEntry[] {
  const seen = new Set<string>();
  const out: GeneratedBtcEntry[] = [];
  for (const e of entries) {
    const key = `${e.entry_day} ${e.account ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Keep entries belonging to the chosen accounts; an empty list keeps them all. */
export function filterGeneratedBtcByAccount(entries: GeneratedBtcEntry[], accounts: string[]): GeneratedBtcEntry[] {
  if (accounts.length === 0) return entries;
  return entries.filter((e) => e.account != null && accounts.includes(e.account));
}

/**
 * Case-insensitive substring match on the owning account's name; a blank query passes
 * all. Rows carry no worker field (a generated-BTC entry is a per-day, per-account
 * total, not per-worker), so unlike the Workers/Payouts search this cannot also match a
 * worker name — only the account dimension is backed.
 */
export function searchGeneratedBtc(entries: GeneratedBtcEntry[], query: string): GeneratedBtcEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.account?.toLowerCase().includes(q));
}
