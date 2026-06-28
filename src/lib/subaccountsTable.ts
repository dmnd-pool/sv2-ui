import type { Subaccount, SubaccountShareStats, SubaccountGeneratedBtcEntry, Worker } from '@/api/types';
import { deriveWorkersPageStats } from '@/lib/workersTable';

export type SubaccountSortKey = 'name' | 'hashrate' | 'rejection' | 'earnings';
export type SortDir = 'asc' | 'desc';

/**
 * Display name for a subaccount. The API returns the name under one of several
 * keys; the first non-empty one wins, falling back to the id.
 */
export function subaccountName(s: Subaccount): string {
  const candidates = [s.sub_account, s.sub_account_name, s.subaccount, s.name];
  const name = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
  return name ? name.trim() : `Subaccount ${s.id}`;
}

/** Total hashrate (H/s) from the list row's numeric string; 0 when blank or NaN. */
export function parseHashrate(s: Subaccount): number {
  const n = Number(s.hashrate);
  return Number.isFinite(n) ? n : 0;
}

/** Rejected/total share fraction (0..1) from share_stats; null without stats or shares. */
export function rejectionFromStats(stats: SubaccountShareStats | null | undefined): number | null {
  if (!stats) return null;
  const total = stats.accepted + stats.rejected;
  return total > 0 ? stats.rejected / total : null;
}

/** Today's generated BTC: the entry whose day matches `now` (UTC); 0 otherwise. */
export function todayEarnings(entries: SubaccountGeneratedBtcEntry[], now: number): number {
  const today = new Date(now).toISOString().slice(0, 10);
  const entry = entries.find((e) => typeof e.entry_day === 'string' && e.entry_day.slice(0, 10) === today);
  return entry?.btc_generated ?? 0;
}

/** The per-row view model assembled from the list row plus its sub-endpoint data. */
export interface EnrichedSubaccount {
  id: string;
  name: string;
  hashrate: number;
  active: number;
  offline: number;
  offline24h: number;
  rejection: number | null;
  todayEarnings: number;
}

/** Combine a subaccount row with its share_stats, worker roster, and generated BTC. */
export function enrichSubaccount(
  row: Subaccount,
  shareStats: SubaccountShareStats | null,
  workers: Worker[],
  generatedBtc: SubaccountGeneratedBtcEntry[],
  now: number,
): EnrichedSubaccount {
  const stats = deriveWorkersPageStats(workers, now);
  return {
    id: row.id,
    name: subaccountName(row),
    hashrate: parseHashrate(row),
    active: stats.active,
    offline: stats.offline,
    offline24h: stats.offline24h,
    rejection: rejectionFromStats(shareStats),
    todayEarnings: todayEarnings(generatedBtc, now),
  };
}

export interface SubaccountsPageStats {
  total: number;
  activeWorkers: number;
  combinedHashrate: number;
  todayEarnings: number;
}

/** Stat-card figures: count, summed active workers, summed hashrate, summed earnings. */
export function deriveSubaccountsPageStats(subs: EnrichedSubaccount[]): SubaccountsPageStats {
  let activeWorkers = 0;
  let combinedHashrate = 0;
  let todayTotal = 0;
  for (const s of subs) {
    activeWorkers += s.active;
    combinedHashrate += s.hashrate;
    todayTotal += s.todayEarnings;
  }
  return { total: subs.length, activeWorkers, combinedHashrate, todayEarnings: todayTotal };
}

/** Case-insensitive substring match on the subaccount name; blank query passes all. */
export function searchSubaccounts(subs: EnrichedSubaccount[], query: string): EnrichedSubaccount[] {
  const q = query.trim().toLowerCase();
  if (!q) return subs;
  return subs.filter((s) => s.name.toLowerCase().includes(q));
}

/** Stable sort by the chosen column; a null rejection (no shares) sorts lowest. */
export function sortSubaccounts(subs: EnrichedSubaccount[], key: SubaccountSortKey, dir: SortDir): EnrichedSubaccount[] {
  const factor = dir === 'asc' ? 1 : -1;
  const value = (s: EnrichedSubaccount): number | string => {
    switch (key) {
      case 'name':
        return s.name.toLowerCase();
      case 'hashrate':
        return s.hashrate;
      case 'rejection':
        return s.rejection ?? -1;
      case 'earnings':
        return s.todayEarnings;
    }
  };
  return [...subs].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

/** BTC amount for display: clamps to 8 dp and trims float noise + trailing zeros. */
export function formatBtc(n: number): string {
  return Number(n.toFixed(8)).toString();
}

const CSV_HEADER = [
  'Name',
  'Active workers',
  'Offline workers',
  'Hashrate (H/s)',
  'Rejection rate',
  "Today's earnings (BTC)",
];

function csvCell(value: string): string {
  // Guard against spreadsheet formula injection: a cell starting with =,+,-,@,
  // tab, or CR is prefixed with a quote so Excel/Sheets treat it as text. (Same
  // rule as the workers CSV; kept local so this module is self-contained.)
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** CSV of the given (already filtered/sorted) subaccounts, exactly what's on screen. */
export function subaccountsToCsv(subs: EnrichedSubaccount[]): string {
  const rows = subs.map((s) =>
    [
      s.name,
      String(s.active),
      String(s.offline),
      String(s.hashrate),
      s.rejection == null ? '--' : `${(s.rejection * 100).toFixed(2)}%`,
      formatBtc(s.todayEarnings),
    ].map(csvCell),
  );
  return [CSV_HEADER.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}
