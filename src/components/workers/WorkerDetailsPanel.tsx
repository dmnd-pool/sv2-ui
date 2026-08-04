import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BdCloseCircle, BdShieldWarning } from 'solar-icon-react/bd';
import { cn, formatHashrate, formatNumber, overlayContainer } from '@/lib/utils';
import type { Worker } from '@/api/types';
import {
  classifyWorker,
  formatConnectedSince,
  formatLastSeen,
  formatOfflineDuration,
  workerHashrate,
  workerMode,
  workerRejection,
  workerRejectedShares,
  workerTotalShares,
} from '@/lib/workersTable';
import { StatusBadge } from './badges';

/** One labelled cell in the details grid: muted label over the value. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <p className="text-sm leading-5 text-body-alt">{label}</p>
      <div className="text-base leading-6 text-foreground">{children}</div>
    </div>
  );
}

/**
 * The offline notice at the top of the panel. Under a day it's a warning (check the
 * rig); over a day it escalates to a destructive tone and warns about payouts, matching
 * the two design variants. Duration is spelled out; if the last-seen time is unknown the
 * lead sentence drops the duration rather than printing a broken string. It reads the same
 * clock as `severe` so the wording can't contradict the badge above it.
 */
function OfflineBanner({ worker, now, severe }: { worker: Worker; now: number; severe: boolean }) {
  const dur = formatOfflineDuration(worker, now);
  const lead = dur ? `This worker has been offline for ${dur}.` : 'This worker is currently offline.';
  const tail = severe
    ? 'Mining Payouts may be affected until the worker reconnects.'
    : 'Check power, internet connection, or miner status.';
  return (
    <div className={cn('flex items-start gap-1 rounded-2xl p-3', severe ? 'bg-toast-error' : 'bg-toast-warning')}>
      {severe ? (
        <BdCloseCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      ) : (
        <BdShieldWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      )}
      <p className="text-sm text-foreground">
        {lead} {tail}
      </p>
    </div>
  );
}

/**
 * The worker details slide-over: a right-docked panel over a dim backdrop showing one
 * worker's full stats, with an offline banner for disconnected rigs. Closes on backdrop
 * click, the close button, or Escape. `worker` is always set while open (the page mounts
 * this only for a chosen row).
 *
 */
export function WorkerDetailsPanel({ worker, now, onClose }: { worker: Worker; now: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = classifyWorker(worker, now);
  const rej = workerRejection(worker);
  const hashrate = workerHashrate(worker);

  // Portal out of the page's `space-y-6` wrapper (whose `> * + *` margin was
  // offsetting this fixed overlay) into the themed shell. See overlayContainer.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Worker Details"
        className="absolute right-0 top-0 flex max-h-screen w-full max-w-[472px] flex-col gap-6 overflow-y-auto bg-background p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold leading-9 tracking-[-1px] text-foreground">Worker Details</h2>
              <p className="text-sm leading-5 text-body-alt">Here&rsquo;s all the details of this worker.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[32px] bg-btn-secondary p-4 text-foreground transition-colors hover:opacity-80"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="border-t border-border" />
        </div>

        {status !== 'online' && <OfflineBanner worker={worker} now={now} severe={status === 'offline_24h'} />}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Worker Name">{worker.name}</Field>
          <Field label="Status">
            <StatusBadge status={status} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current hashrate">{hashrate ? formatHashrate(hashrate) : '--'}</Field>
          <Field label="Mode">{workerMode(worker) ?? '--'}</Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Shares">{formatNumber(workerTotalShares(worker))}</Field>
          <Field label="Rejected Shares">{formatNumber(workerRejectedShares(worker))}</Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rejection Rate">{rej === null ? '--' : `${(rej * 100).toFixed(1)}%`}</Field>
          <Field label="Last seen">{formatLastSeen(worker, now)}</Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Connected Since">{formatConnectedSince(worker)}</Field>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border-t border-border" />
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-black/20 bg-[hsl(var(--btn))] px-6 py-2.5 text-base text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    overlayContainer(),
  );
}
