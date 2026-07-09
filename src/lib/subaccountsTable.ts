import type { Subaccount, SubaccountShareStats, SubaccountSummary, Worker } from '@/api/types';
import { deriveWorkersPageStats } from '@/lib/workersTable';

export type SubaccountSortKey = 'name' | 'hashrate' | 'rejection' | 'earnings';
export type SortDir = 'asc' | 'desc';

/** Display name for a subaccount; falls back to the id when the name is blank. */
export function subaccountName(s: Subaccount): string {
  return s.sub_account.trim() || `Subaccount ${s.id}`;
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

/** The per-row view model assembled from the list row plus its summary and worker roster. */
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

/** Combine a subaccount row with its summary (rejection + earnings) and worker roster (counts). */
export function enrichSubaccount(
  row: Subaccount,
  summary: SubaccountSummary | null,
  workers: Worker[],
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
    rejection: rejectionFromStats(summary?.share_stats),
    todayEarnings: summary?.today_generated_btc ?? 0,
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

// Filter facets: a status bucket, a rejection-rate bucket, and a sort option. Each
// maps to a value already on the enriched row; null means the facet is unset.
export type SubaccountStatusFilter = 'healthy' | 'has_offline' | 'has_offline_24h';
export type SubaccountRejectionFilter = 'lt1' | '1to3' | 'gt3';
export type SubaccountSortOption = 'hashrate_desc' | 'hashrate_asc' | 'earnings_desc' | 'earnings_asc';

export interface SubaccountFilter {
  status: SubaccountStatusFilter | null;
  rejection: SubaccountRejectionFilter | null;
  sortBy: SubaccountSortOption | null;
}

export const EMPTY_SUBACCOUNT_FILTER: SubaccountFilter = { status: null, rejection: null, sortBy: null };

/** True when any facet is set; drives the Filter button's active dot and the no-match copy. */
export function isSubaccountFilterActive(f: SubaccountFilter): boolean {
  return f.status !== null || f.rejection !== null || f.sortBy !== null;
}

/** "Healthy" = no offline workers; the >24h option is the subset of has-offline. */
function matchesStatus(s: EnrichedSubaccount, status: SubaccountStatusFilter): boolean {
  switch (status) {
    case 'healthy':
      return s.offline === 0;
    case 'has_offline':
      return s.offline > 0;
    case 'has_offline_24h':
      return s.offline24h > 0;
  }
}

/** Rejection buckets; the 1%-3% band is inclusive of both edges. A null rate (no shares) matches none. */
function matchesRejection(s: EnrichedSubaccount, bucket: SubaccountRejectionFilter): boolean {
  if (s.rejection === null) return false;
  switch (bucket) {
    case 'lt1':
      return s.rejection < 0.01;
    case '1to3':
      return s.rejection >= 0.01 && s.rejection <= 0.03;
    case 'gt3':
      return s.rejection > 0.03;
  }
}

/** Filter by status + rejection (AND), then order by the chosen sort (default: name asc). */
export function applySubaccountFilter(subs: EnrichedSubaccount[], filter: SubaccountFilter): EnrichedSubaccount[] {
  const filtered = subs.filter(
    (s) =>
      (filter.status === null || matchesStatus(s, filter.status)) &&
      (filter.rejection === null || matchesRejection(s, filter.rejection)),
  );
  switch (filter.sortBy) {
    case 'hashrate_desc':
      return sortSubaccounts(filtered, 'hashrate', 'desc');
    case 'hashrate_asc':
      return sortSubaccounts(filtered, 'hashrate', 'asc');
    case 'earnings_desc':
      return sortSubaccounts(filtered, 'earnings', 'desc');
    case 'earnings_asc':
      return sortSubaccounts(filtered, 'earnings', 'asc');
    case null:
      return sortSubaccounts(filtered, 'name', 'asc');
  }
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
