import type {
  GeneratedBtcEntry,
  Subaccount,
  SubaccountShareStats,
  SubaccountSummary,
  Worker,
} from '@/api/types';
import { BTC_DISPLAY_DP, formatHashrate } from '@/lib/utils';

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

/** Whether at least one subaccount is currently reporting hashrate. */
export function hasSubaccountHashrate(subs: Subaccount[]): boolean {
  return subs.some((sub) => parseHashrate(sub) > 0);
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
  pplns: number;
  fpps: number;
  active: number;
  offline: number;
  pplnsPassword: string;
  fppsPassword: string | null;
  rejection: number | null;
  // Raw accepted/rejected share counts kept alongside the derived rejection rate so an
  // aggregate across subaccounts can recompute a correct combined rate (summing rates
  // would misweight subaccounts with very different share volumes).
  accepted: number;
  rejected: number;
  todayEarnings: number;
  // Lifetime generated BTC, summed from the account's daily entries. Null means the
  // account has no entries and must not be shown as 0, which would read as "earned
  // nothing" on money data. Filled by withGeneratedBtc.
  generatedBtc: number | null;
  // The roster itself, kept so the aggregated workers table can list every account's
  // workers rather than only their counts.
  workers: Worker[];
}

/** Combine a subaccount row with its summary (rejection + earnings) and worker roster (counts). */
export function enrichSubaccount(
  row: Subaccount,
  summary: SubaccountSummary | null,
  workers: Worker[],
): EnrichedSubaccount {
  return {
    id: row.id,
    name: subaccountName(row),
    hashrate: parseHashrate(row),
    pplns: summary?.hashrate.pplns_hashrate ?? 0,
    fpps: summary?.hashrate.fpps_hashrate ?? 0,
    active: workers.length,
    offline: 0,
    pplnsPassword: row.token,
    fppsPassword: row.fpps_token,
    rejection: rejectionFromStats(summary?.share_stats),
    accepted: summary?.share_stats.accepted ?? 0,
    rejected: summary?.share_stats.rejected ?? 0,
    todayEarnings: summary?.today_generated_btc ?? 0,
    // Not on the summary; filled from the generated-BTC entries by withGeneratedBtc.
    generatedBtc: null,
    workers,
  };
}

/**
 * Fill each row's lifetime generated BTC by summing the account-tagged daily entries
 * that already back the Generated BTC page, so the column costs no extra request per
 * row. Matching is by the same display name the tagger writes.
 *
 * An account with no entries at all stays null (unknown) rather than 0, since a zero
 * would read as "earned nothing" on money data.
 */
export function withGeneratedBtc(
  subs: EnrichedSubaccount[],
  entries: GeneratedBtcEntry[],
  nowMs: number = Date.now(),
): EnrichedSubaccount[] {
  const byAccount = new Map<string, GeneratedBtcEntry[]>();
  for (const e of entries) {
    if (e.account === undefined) continue;
    const list = byAccount.get(e.account);
    if (list) list.push(e);
    else byAccount.set(e.account, [e]);
  }
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return subs.map((s) => {
    const accountEntries = byAccount.get(s.name) ?? [];
    return {
      ...s,
      generatedBtc: sumGeneratedBtc(accountEntries),
      todayEarnings: accountEntries.find((entry) => entry.entry_day === today)?.btc_generated ?? 0,
    };
  });
}

/** Total BTC across the daily entries, or null when the account has none. */
export function sumGeneratedBtc(entries: GeneratedBtcEntry[]): number | null {
  if (entries.length === 0) return null;
  return entries.reduce((total, e) => total + e.btc_generated, 0);
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

/** Lowercased text for every value displayed in a subaccount row. */
export function subaccountSearchText(sub: EnrichedSubaccount): string {
  const rejection = sub.rejection === null ? '--' : `${(sub.rejection * 100).toFixed(1)}%`;
  const generated = sub.generatedBtc === null ? '--' : `${formatBtc(sub.generatedBtc)} BTC`;
  return [
    sub.id,
    sub.name,
    String(sub.active),
    sub.pplnsPassword,
    sub.fppsPassword ?? 'Not available',
    formatHashrate(sub.hashrate),
    rejection,
    generated,
    `${formatBtc(sub.todayEarnings)} BTC`,
  ]
    .join(' ')
    .toLowerCase();
}

/** Case-insensitive substring match across every displayed table field. */
export function searchSubaccounts(subs: EnrichedSubaccount[], query: string): EnrichedSubaccount[] {
  const q = query.trim().toLowerCase();
  if (!q) return subs;
  return subs.filter((sub) => subaccountSearchText(sub).includes(q));
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
    // Ties break on name, always ascending,
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export type SubaccountRejectionFilter = 'lt1' | '1to3' | 'gt3';
export type SubaccountSortOption = 'hashrate_desc' | 'hashrate_asc' | 'earnings_desc' | 'earnings_asc';

export interface SubaccountFilter {
  rejection: SubaccountRejectionFilter | null;
  sortBy: SubaccountSortOption | null;
}

export const EMPTY_SUBACCOUNT_FILTER: SubaccountFilter = { rejection: null, sortBy: null };

/** True when any facet is set; drives the Filter button's active dot and the no-match copy. */
export function isSubaccountFilterActive(f: SubaccountFilter): boolean {
  return f.rejection !== null || f.sortBy !== null;
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

/** Filter by rejection, then order by the chosen sort (default: name asc). */
export function applySubaccountFilter(subs: EnrichedSubaccount[], filter: SubaccountFilter): EnrichedSubaccount[] {
  const filtered = subs.filter(
    (s) => filter.rejection === null || matchesRejection(s, filter.rejection),
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
      return sortSubaccounts(filtered, 'hashrate', 'desc');
  }
}

/** BTC amount for display: clamps to 8 dp and trims float noise + trailing zeros. */
export function formatBtc(n: number): string {
  return Number(n.toFixed(BTC_DISPLAY_DP)).toString();
}

// Passwords are intentionally omitted from CSV exports so downloading an operational
// report cannot silently write mining credentials to disk.
const CSV_HEADER = [
  'Name',
  'Active workers',
  'Hashrate',
  'Rejection rate',
  'Generated BTC',
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
      formatHashrate(s.hashrate),
      s.rejection == null ? '--' : `${(s.rejection * 100).toFixed(2)}%`,
      s.generatedBtc === null ? '--' : formatBtc(s.generatedBtc),
      formatBtc(s.todayEarnings),
    ].map(csvCell),
  );
  return [CSV_HEADER.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}
