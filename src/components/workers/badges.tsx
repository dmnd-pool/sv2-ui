import { cn } from '@/lib/utils';
import { STATUS_LABEL, type WorkerStatus } from '@/lib/workersTable';

// Solid status tints from the design, not alpha blends. Only Online carries a dot,
// and the badge reds differ from the banner icon red on purpose.
const STATUS: Record<WorkerStatus, { className: string; dot: boolean }> = {
  online: { className: 'bg-toast-success text-success-text', dot: true },
  offline: { className: 'bg-toast-warning text-warning-text', dot: false },
  offline_24h: { className: 'bg-toast-error text-destructive-text', dot: false },
};

/** The Online / Offline / Offline >24h pill in the Status column. */
export function StatusBadge({ status }: { status: WorkerStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm px-3 py-1 text-xs font-medium leading-4', s.className)}>
      {s.dot && <span className="h-1 w-1 rounded-full bg-success" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The PPLNS / FPPS scheme pill (neutral outline). A worker with no recent figures has no
 * scheme to name, and gets a plain dash in place of the pill.
 */
export function ModeBadge({ mode }: { mode: 'PPLNS' | 'FPPS' | null }) {
  if (mode === null) return <span className="text-body-alt">-</span>;
  return (
    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-body-alt">
      {mode}
    </span>
  );
}
