import type { Worker } from '@/api/types';
import { deriveWorkerStats } from '@/lib/workerStats';
import { formatHashrate } from '@/lib/utils';

/** Health buckets matching the API's `is_connected` value. */
export type WorkerStatus = 'online' | 'offline';
export type WorkersTab = 'all' | 'online' | 'offline';
export type WorkerSortKey = 'name' | 'hashrate' | 'rejection' | 'shares';
export type SortDir = 'asc' | 'desc';

/** Online means the backend received hashrate during its last 10-minute window. */
export function classifyWorker(worker: Worker): WorkerStatus {
  return worker.is_connected ? 'online' : 'offline';
}

/** Payment modes with recent telemetry; the same worker name can report both. */
export function workerKind(worker: Worker): 'pplns' | 'fpps' | 'both' | null {
  if (worker.fpps_hashrate != null && worker.hashrate != null) return 'both';
  if (worker.fpps_hashrate != null) return 'fpps';
  if (worker.hashrate != null) return 'pplns';
  return null;
}

export function workerMode(worker: Worker): 'PPLNS' | 'FPPS' | 'PPLNS + FPPS' | null {
  const kind = workerKind(worker);
  if (kind === 'both') return 'PPLNS + FPPS';
  return kind === null ? null : kind === 'fpps' ? 'FPPS' : 'PPLNS';
}

/** Combined H/s, preserving unknown when neither mode has telemetry. */
export function workerHashrate(worker: Worker): number | null {
  if (worker.hashrate == null && worker.fpps_hashrate == null) return null;
  return (worker.hashrate ?? 0) + (worker.fpps_hashrate ?? 0);
}

/**
 * Whether the worker produced hashes in the pool's most recent 10-minute window. This is
 * the hashing signal, narrower than `is_connected`: a rig whose telemetry still arrives
 * but has stopped mining is connected and not hashing.
 */
export function isHashing(worker: Worker): boolean {
  return (workerHashrate(worker) ?? 0) > 0;
}

/** Accepted+rejected share count across both schemes. */
export function workerTotalShares(worker: Worker): number {
  return (worker.total_shares ?? 0) + (worker.fpps_total_shares ?? 0);
}

/** Rejected share count across both schemes. */
export function workerRejectedShares(worker: Worker): number {
  return (worker.rejected_shares ?? 0) + (worker.fpps_rejected_shares ?? 0);
}

/** Per-worker rejected/total share fraction (0..1), combining both schemes; null with no shares. */
export function workerRejection(worker: Worker): number | null {
  const total = workerTotalShares(worker);
  return total > 0 ? workerRejectedShares(worker) / total : null;
}

export interface WorkersPageStats {
  total: number;
  active: number;
  offline: number;
  rejectionRate: number | null;
}

/** Stat-card figures from the roster returned by `/workers/all`. */
export function deriveWorkersPageStats(workers: Worker[]): WorkersPageStats {
  const base = deriveWorkerStats(workers);
  return {
    total: base.totalCount,
    active: base.activeCount,
    offline: base.offlineCount,
    rejectionRate: base.rejectionRate,
  };
}

/** All / Online / Offline. */
export function filterByTab(workers: Worker[], tab: WorkersTab): Worker[] {
  if (tab === 'all') return workers;
  const wantOnline = tab === 'online';
  return workers.filter((w) => w.is_connected === wantOnline);
}

// The advanced Filter popover (separate from the All/Online/Offline tabs). Status and
// Mode are multi-select (a worker matches if it is in ANY chosen bucket); Rejection is
// single-select. An empty facet does not constrain. Buckets are design-derived.
export type WorkerModeFilter = 'PPLNS' | 'FPPS';
export type WorkerRejectionFilter = 'lt1' | '1to3' | 'gt3';

export interface WorkerFilter {
  status: WorkerStatus[];
  mode: WorkerModeFilter[];
  rejection: WorkerRejectionFilter | null;
  // Subaccount names to keep, used only in aggregated mode where rows span accounts.
  // Empty means every account, matching how the other multi-select facets behave.
  accounts: string[];
}

export const EMPTY_WORKER_FILTER: WorkerFilter = { status: [], mode: [], rejection: null, accounts: [] };

/** True when any facet is set (drives the Filter button's active dot). */
export function isWorkerFilterActive(filter: WorkerFilter): boolean {
  return (
    filter.status.length > 0 || filter.mode.length > 0 || filter.rejection !== null || filter.accounts.length > 0
  );
}

/** Which rejection bucket a worker falls in; null when it has no shares yet (no rate). */
function rejectionBucket(worker: Worker): WorkerRejectionFilter | null {
  const rej = workerRejection(worker);
  if (rej === null) return null;
  if (rej < 0.01) return 'lt1';
  if (rej <= 0.03) return '1to3';
  return 'gt3';
}

/**
 * Apply the advanced filter to the roster. Facets combine with AND (a worker must pass
 * every set facet); within the multi-select Status and Mode facets the chosen options
 * combine with OR. A worker with no shares has no rejection rate, so it never matches a
 * rejection bucket.
 */
export function applyWorkerFilter(workers: Worker[], filter: WorkerFilter): Worker[] {
  return workers.filter((w) => {
    if (filter.status.length > 0 && !filter.status.includes(classifyWorker(w))) return false;
    // A worker of unknown scheme matches neither bucket, so a set Mode facet excludes it.
    if (filter.mode.length > 0 && !filter.mode.some((mode) =>
      mode === 'FPPS' ? w.fpps_hashrate != null : w.hashrate != null,
    )) return false;
    if (filter.rejection !== null && rejectionBucket(w) !== filter.rejection) return false;
    if (filter.accounts.length > 0) {
      const sub = (w as TaggedWorker).subaccount;
      if (!sub || !filter.accounts.includes(sub)) return false;
    }
    return true;
  });
}

/** Display labels for the status column; single source of truth (also used by StatusBadge). */
export const STATUS_LABEL: Record<WorkerStatus, string> = {
  online: 'Online',
  offline: 'Offline',
};

/** Lowercased text of every displayed column, so search can match any of them. */
export function workerSearchText(worker: Worker): string {
  const rej = workerRejection(worker);
  const hr = workerHashrate(worker);
  return [
    worker.name,
    hr ? formatHashrate(hr) : '',
    workerMode(worker) ?? '',
    rej === null ? '' : `${(rej * 100).toFixed(1)}%`,
    STATUS_LABEL[classifyWorker(worker)],
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Comma-separated search across all displayed data columns (name, hashrate, mode,
 * rejection, status). A worker matches if its combined column text
 * contains ANY of the trimmed, non-empty terms; a blank or comma-only query
 * passes all.
 */
export function searchWorkers(workers: Worker[], query: string): Worker[] {
  const terms = query
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (terms.length === 0) return workers;
  return workers.filter((w) => {
    const text = workerSearchText(w);
    return terms.some((t) => text.includes(t));
  });
}

/**
 * Sort by the chosen column, breaking ties on name (always ascending, so the
 * secondary order doesn't flip with the column's direction). Nulls (e.g. no
 * rejection yet) sort last.
 */
export function sortWorkers(workers: Worker[], key: WorkerSortKey, dir: SortDir): Worker[] {
  const factor = dir === 'asc' ? 1 : -1;
  const value = (w: Worker): number | string | null => {
    switch (key) {
      case 'name':
        return w.name.toLowerCase();
      case 'hashrate':
        return workerHashrate(w) ?? 0;
      case 'rejection':
        return workerRejection(w);
      case 'shares':
        return workerTotalShares(w);
    }
  };
  return [...workers].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    // Unknown metrics always stay at the bottom; changing direction only reverses
    // real values, never promotes a worker with no share data above measured rows.
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    if (av === null && bv === null) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (av !== null && bv !== null) {
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
    }
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  });
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Clamp the page into range and slice; totalPages is at least 1. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, totalPages };
}

export type WorkerExportMode = 'all' | 'pplns' | 'fpps';

/**
 * Filter the roster to one payout scheme for the CSV export.
 */
export function filterWorkersByMode(workers: Worker[], mode: WorkerExportMode): Worker[] {
  if (mode === 'all') return workers;
  return workers.filter((w) => mode === 'fpps' ? w.fpps_hashrate != null : w.hashrate != null);
}

const CSV_HEADER = ['name', 'kind', 'hashrate', 'total_shares', 'rejected_shares', 'is_connected'];

function csvCell(value: string): string {
  // Guard against spreadsheet formula injection: a cell starting with =,+,-,@,
  // tab, or CR is prefixed with a quote so Excel/Sheets treat it as text.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // Quote when the value contains a comma, quote, or newline; double inner quotes.
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Raw numeric cell: the value as-is, or an empty cell when null (as production does). */
function numCell(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function hashrateCell(value: number | null): string {
  return value === null ? '' : formatHashrate(value);
}

/**
 * CSV of the given (already filtered/sorted) rows, in the production export schema. The
 * figure columns carry whichever scheme's numbers the worker has, which `kind` names —
 * taking the PPLNS fields alone would leave every FPPS row's figures blank.
 */
export function workersToCsv(workers: Worker[]): string {
  const rows = workers.map((w) => {
    const kind = workerKind(w);
    const fpps = kind === 'fpps';
    return [
      w.name,
      workerKind(w) ?? '',
      hashrateCell(workerHashrate(w)),
      numCell(kind === 'both' ? workerTotalShares(w) : fpps ? w.fpps_total_shares : w.total_shares),
      numCell(kind === 'both' ? workerRejectedShares(w) : fpps ? w.fpps_rejected_shares : w.rejected_shares),
      w.is_connected ? 'true' : 'false',
    ].map(csvCell);
  });
  return [CSV_HEADER.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/** A worker paired with the subaccount it belongs to, for the aggregated workers table. */
export interface TaggedWorker extends Worker {
  subaccount: string;
  /**
   * The owning subaccount's id. Row identity keys off this, not the display name:
   * subaccount names are user-chosen and not guaranteed unique, so two subaccounts
   * named the same would otherwise collide into one row and one selection state.
   */
  subaccountId: string;
}

/**
 * Flatten per-subaccount worker rosters into one list, tagging each worker with
 * the subaccount it came from. Group order is preserved, then worker order within
 * each group; a group with no workers contributes nothing. Workers are not deduped,
 * so two subaccounts can each contribute a worker of the same name.
 */
export function tagWorkersBySubaccount(
  perSub: { sub: string; subaccountId: string; workers: Worker[] }[],
): TaggedWorker[] {
  return perSub.flatMap((group) =>
    group.workers.map((w) => ({ ...w, subaccount: group.sub, subaccountId: group.subaccountId })),
  );
}

/**
 * A stable identity for a worker row. Worker names are only unique within one account,
 * so an aggregated table (which spans subaccounts) qualifies the name with the owning
 * subaccount's id (not its display name, which can collide across subaccounts);
 * without this two accounts' same-named rigs would collide as one row and select
 * together.
 */
export function workerRowId(worker: Worker): string {
  const id = (worker as TaggedWorker).subaccountId;
  return id ? `${id}/${worker.name}` : worker.name;
}
