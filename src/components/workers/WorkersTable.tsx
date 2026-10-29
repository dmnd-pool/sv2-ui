import { LiAltArrowDown, LiAltArrowUp, LiSort } from 'solar-icon-react/li';
import { cn, formatHashrate } from '@/lib/utils';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import { InfoHint } from '@/components/ui/InfoHint';
import type { Worker } from '@/api/types';
import {
  classifyWorker,
  workerHashrate,
  workerMode,
  workerRejection,
  workerRowId,
  type SortDir,
  type TaggedWorker,
  type WorkerSortKey,
} from '@/lib/workersTable';
import { WORKER_STATUS_HINT, WORKER_METRICS_HINT, WORKER_REJECTION_HINT } from '@/lib/metricWindows';
import { ModeBadge, StatusBadge } from './badges';

interface SortState {
  key: WorkerSortKey;
  dir: SortDir;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  hint,
  align = 'left',
}: {
  label: string;
  sortKey: WorkerSortKey;
  sort: SortState;
  onSort: (key: WorkerSortKey) => void;
  hint?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'px-4 py-3 font-normal',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          aria-label={`Sort by ${label}`}
          className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground', active && 'text-foreground')}
        >
          {label}
          {active ? (
            sort.dir === 'asc' ? <LiAltArrowUp className="h-3 w-3" /> : <LiAltArrowDown className="h-3 w-3" />
          ) : (
            <LiSort className="h-3 w-3 text-placeholder" />
          )}
        </button>
        {hint && <InfoHint text={hint} />}
      </span>
    </th>
  );
}

/**
 * One row as a mobile card (frame 1380:109825): Worker Name/Current hashrate/Mode on
 * one line, Rejection rate/Status below. The frame draws Mode as plain text here
 * (unlike the desktop table's ModeBadge) and carries no Account, select
 * checkbox, or Details action — so none of those are added; mobile users can't select
 * workers for the CSV export subset or open the Details slide-over from this card.
 */
function WorkerCard({ worker }: { worker: Worker }) {
  const rej = workerRejection(worker);
  const hr = workerHashrate(worker);
  return (
    <div className="flex flex-col border-b border-border px-3 py-2 last:border-0">
      <div className="flex items-center gap-6">
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Worker Name</p>
          <p className="text-sm font-medium text-foreground">{worker.name}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Current hashrate</p>
          <p className="font-mono text-sm text-foreground">{hr ? formatHashrate(hr) : '--'}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Mode</p>
          <p className="text-sm text-foreground">{workerMode(worker) ?? '--'}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Rejection rate</p>
          <p className="font-mono text-sm text-foreground">{rej === null ? '--' : `${(rej * 100).toFixed(2)}%`}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Status</p>
          <StatusBadge status={classifyWorker(worker)} />
        </div>
      </div>
    </div>
  );
}

/** The workers data table (one page of rows): select column, sortable headers, and a
 * per-row Details action that opens the worker slide-over. Below sm, a row-card list
 * (frame 1380:109825) replaces it; see WorkerCard for what that layout omits. */
export function WorkersTable({
  workers,
  sort,
  onSort,
  selected,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleOne,
  onOpenDetails,
  showAccount = false,
}: {
  workers: Worker[];
  sort: SortState;
  onSort: (key: WorkerSortKey) => void;
  selected?: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll?: () => void;
  onToggleOne?: (name: string) => void;
  onOpenDetails: (worker: Worker) => void;
  /** Aggregated mode adds the owning account, since rows then span subaccounts. */
  showAccount?: boolean;
}) {
  const selectable = onToggleAll !== undefined && onToggleOne !== undefined;
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[820px] border-collapse text-sm leading-5">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              {selectable && <th className="w-10 px-4 py-3">
                <CellCheckbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={onToggleAll}
                  label="Select all workers"
                />
              </th>}
              <SortHeader label="Worker" sortKey="name" sort={sort} onSort={onSort} />
              {showAccount && <th className="px-4 py-3 text-left font-normal">Account</th>}
              <SortHeader label="Hashrate" sortKey="hashrate" sort={sort} onSort={onSort} hint={WORKER_METRICS_HINT} />
              <th className="px-4 py-3 text-left font-normal">Mode</th>
              <SortHeader
                label="Rejection rate"
                sortKey="rejection"
                sort={sort}
                onSort={onSort}
                hint={WORKER_REJECTION_HINT}
                align="center"
              />
              <th className="px-4 py-3 text-left font-normal">
                <span className="inline-flex items-center gap-2">Status <InfoHint text={WORKER_STATUS_HINT} /></span>
              </th>
              <th className="px-4 py-3 text-left font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr>
                <td colSpan={6 + Number(showAccount) + Number(selectable)} className="px-4 py-10 text-center text-sm text-body-alt">
                  No workers match your search.
                </td>
              </tr>
            )}
            {workers.map((w) => {
              const rej = workerRejection(w);
              const hr = workerHashrate(w);
              const rowId = workerRowId(w);
              return (
                <tr key={rowId} className="border-b border-border last:border-0">
                  {selectable && <td className="px-4 py-3">
                    <CellCheckbox
                      checked={selected?.has(rowId) ?? false}
                      onChange={() => onToggleOne(rowId)}
                      label={`Select ${w.name}`}
                    />
                  </td>}
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  {showAccount && (
                    <td className="px-4 py-3 text-body-alt">{(w as TaggedWorker).subaccount ?? '--'}</td>
                  )}
                  <td className="px-4 py-3 font-mono text-foreground">{hr ? formatHashrate(hr) : '--'}</td>
                  <td className="px-4 py-3">
                    <ModeBadge mode={workerMode(w)} />
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-foreground">
                    {rej === null ? '--' : `${(rej * 100).toFixed(2)}%`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={classifyWorker(w)} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(w)}
                      className="text-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-body-alt"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden">
        {workers.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-body-alt">No workers match your search.</p>
        )}
        {workers.map((w) => (
          <WorkerCard key={workerRowId(w)} worker={w} />
        ))}
      </div>
    </>
  );
}
