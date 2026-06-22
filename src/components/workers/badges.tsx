import { cn } from '@/lib/utils';
import type { WorkerStatus } from '@/lib/workersTable';

const STATUS: Record<WorkerStatus, { label: string; className: string; dot: boolean }> = {
  online: { label: 'Online', className: 'bg-success/10 text-success', dot: true },
  offline: { label: 'Offline', className: 'bg-warning/15 text-warning', dot: false },
  offline_24h: { label: 'Offline >24h', className: 'bg-destructive/10 text-destructive', dot: false },
};

/** The Online / Offline / Offline >24h pill in the Status column. */
export function StatusBadge({ status }: { status: WorkerStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', s.className)}>
      {s.dot && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
      {s.label}
    </span>
  );
}

/** The PPLNS / FPPS scheme pill (neutral outline). */
export function ModeBadge({ mode }: { mode: 'PPLNS' | 'FPPS' }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-body-alt">
      {mode}
    </span>
  );
}
