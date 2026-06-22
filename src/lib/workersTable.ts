import type { Worker } from '@/api/types';
import { deriveWorkerStats } from '@/lib/workerStats';

/** Health buckets matching the status badges (Online / Offline / Offline >24h). */
export type WorkerStatus = 'online' | 'offline' | 'offline_24h';
export type WorkersTab = 'all' | 'online' | 'offline';
export type WorkerSortKey = 'name' | 'hashrate' | 'rejection' | 'shares';
export type SortDir = 'asc' | 'desc';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Last-activity timestamp (ms). The roster only carries `connected_at` (no
 * dedicated last-seen field), so for an offline worker that's the best proxy for
 * when it was last seen; an online worker is "now". Returns null when unknown.
 */
export function lastSeenMs(worker: Worker, now: number): number | null {
  if (worker.is_connected) return now;
  if (!worker.connected_at) return null;
  const t = Date.parse(worker.connected_at);
  return Number.isNaN(t) ? null : t;
}

/** Online if connected; otherwise offline, escalated to offline_24h past a day. */
export function classifyWorker(worker: Worker, now: number): WorkerStatus {
  if (worker.is_connected) return 'online';
  const seen = lastSeenMs(worker, now);
  if (seen != null && now - seen > DAY_MS) return 'offline_24h';
  return 'offline';
}

/** PPLNS unless the worker mines the FPPS scheme. */
export function workerMode(worker: Worker): 'PPLNS' | 'FPPS' {
  return worker.is_fpps ? 'FPPS' : 'PPLNS';
}

/** Per-worker rejected/total share fraction (0..1), combining both schemes; null with no shares. */
export function workerRejection(worker: Worker): number | null {
  const total = (worker.total_shares ?? 0) + (worker.fpps_total_shares ?? 0);
  const rejected = (worker.rejected_shares ?? 0) + (worker.fpps_rejected_shares ?? 0);
  return total > 0 ? rejected / total : null;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** "Just now" / "42 mins ago" / "1 day 18 hrs ago", matching the Last seen column. */
export function formatLastSeen(worker: Worker, now: number): string {
  if (worker.is_connected) return 'Just now';
  const seen = lastSeenMs(worker, now);
  if (seen == null) return 'Unknown';
  const mins = Math.floor((now - seen) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${plural(mins, 'min')} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${plural(hrs, 'hr')} ago`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${plural(days, 'day')} ${plural(remHrs, 'hr')} ago` : `${plural(days, 'day')} ago`;
}

export interface WorkersPageStats {
  total: number;
  active: number;
  offline: number;
  offline24h: number;
  rejectionRate: number | null;
}

/** Stat-card figures: extends the shared worker stats with the offline-over-24h count. */
export function deriveWorkersPageStats(workers: Worker[], now: number): WorkersPageStats {
  const base = deriveWorkerStats(workers);
  let offline24h = 0;
  for (const worker of workers) {
    if (classifyWorker(worker, now) === 'offline_24h') offline24h += 1;
  }
  return {
    total: base.totalCount,
    active: base.activeCount,
    offline: base.offlineCount,
    offline24h,
    rejectionRate: base.rejectionRate,
  };
}

/** All / Online / Offline (offline includes the >24h bucket). */
export function filterByTab(workers: Worker[], tab: WorkersTab): Worker[] {
  if (tab === 'all') return workers;
  const wantOnline = tab === 'online';
  return workers.filter((w) => w.is_connected === wantOnline);
}

/** Case-insensitive substring match on the worker name; blank query passes all. */
export function searchWorkers(workers: Worker[], query: string): Worker[] {
  const q = query.trim().toLowerCase();
  if (!q) return workers;
  return workers.filter((w) => w.name.toLowerCase().includes(q));
}

/** Stable sort by the chosen column; nulls (e.g. no rejection yet) sort last. */
export function sortWorkers(workers: Worker[], key: WorkerSortKey, dir: SortDir): Worker[] {
  const factor = dir === 'asc' ? 1 : -1;
  const value = (w: Worker): number | string => {
    switch (key) {
      case 'name':
        return w.name.toLowerCase();
      case 'hashrate':
        return w.hashrate ?? 0;
      case 'rejection':
        return workerRejection(w) ?? -1;
      case 'shares':
        return (w.total_shares ?? 0) + (w.fpps_total_shares ?? 0);
    }
  };
  return [...workers].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
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

const CSV_HEADER = ['Worker', 'Hashrate (H/s)', 'Mode', 'Rejection rate', 'Status', 'Last seen'];

function csvCell(value: string): string {
  // Guard against spreadsheet formula injection: a cell starting with =,+,-,@,
  // tab, or CR is prefixed with a quote so Excel/Sheets treat it as text.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // Quote when the value contains a comma, quote, or newline; double inner quotes.
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const STATUS_LABEL: Record<WorkerStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  offline_24h: 'Offline >24h',
};

/** CSV of the given (already filtered/sorted) rows — exactly what's on screen. */
export function workersToCsv(workers: Worker[], now: number): string {
  const rows = workers.map((w) => {
    const rej = workerRejection(w);
    return [
      w.name,
      String(w.hashrate ?? 0),
      workerMode(w),
      rej == null ? '--' : `${(rej * 100).toFixed(2)}%`,
      STATUS_LABEL[classifyWorker(w, now)],
      formatLastSeen(w, now),
    ].map(csvCell);
  });
  return [CSV_HEADER.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}
