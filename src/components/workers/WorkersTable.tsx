import { Check, Minus } from 'lucide-react';
import { LiInfoCircle, LiAltArrowDown, LiAltArrowUp } from 'solar-icon-react/li';
import { cn, formatHashrate } from '@/lib/utils';
import type { Worker } from '@/api/types';
import {
  classifyWorker,
  formatLastSeen,
  workerMode,
  workerRejection,
  type SortDir,
  type WorkerSortKey,
} from '@/lib/workersTable';
import { ModeBadge, StatusBadge } from './badges';

interface SortState {
  key: WorkerSortKey;
  dir: SortDir;
}

/** A square check control (row select + header select-all), mirroring the customize panel. */
function CellCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors',
        active ? 'border-transparent bg-[hsl(var(--btn))]' : 'border-border hover:border-foreground',
      )}
    >
      {indeterminate ? (
        <Minus className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />
      ) : checked ? (
        <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />
      ) : null}
    </button>
  );
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
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn('px-4 py-3 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        {hint && <LiInfoCircle className="h-3.5 w-3.5 text-placeholder" aria-label={hint} />}
        {active &&
          (sort.dir === 'asc' ? <LiAltArrowUp className="h-3 w-3" /> : <LiAltArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

/** The workers data table (one page of rows): select column, sortable headers, and a
 * per-row Details action that opens the worker slide-over. */
export function WorkersTable({
  workers,
  sort,
  onSort,
  now,
  selected,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleOne,
  onOpenDetails,
}: {
  workers: Worker[];
  sort: SortState;
  onSort: (key: WorkerSortKey) => void;
  now: number;
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (name: string) => void;
  onOpenDetails: (worker: Worker) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
            <th className="w-10 px-4 py-3">
              <CellCheckbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={onToggleAll}
                label="Select all workers"
              />
            </th>
            <SortHeader label="Worker" sortKey="name" sort={sort} onSort={onSort} />
            <SortHeader label="Hashrate" sortKey="hashrate" sort={sort} onSort={onSort} hint="Current hashrate reported by the worker." />
            <th className="px-4 py-3 text-left font-medium">Mode</th>
            <SortHeader
              label="Rejection rate"
              sortKey="rejection"
              sort={sort}
              onSort={onSort}
              hint="Rejected share rate for this worker."
            />
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Last seen</th>
            <th className="px-4 py-3 text-left font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {workers.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-body-alt">
                No workers match your search.
              </td>
            </tr>
          )}
          {workers.map((w) => {
            const rej = workerRejection(w);
            return (
              <tr key={w.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3.5">
                  <CellCheckbox
                    checked={selected.has(w.name)}
                    onChange={() => onToggleOne(w.name)}
                    label={`Select ${w.name}`}
                  />
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{w.name}</td>
                <td className="px-4 py-3.5 font-mono text-foreground">{w.hashrate ? formatHashrate(w.hashrate) : '--'}</td>
                <td className="px-4 py-3.5">
                  <ModeBadge mode={workerMode(w)} />
                </td>
                <td className="px-4 py-3.5 font-mono text-foreground">
                  {rej === null ? '--' : `${(rej * 100).toFixed(1)}%`}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={classifyWorker(w, now)} />
                </td>
                <td className="px-4 py-3.5 text-body-alt">{formatLastSeen(w, now)}</td>
                <td className="px-4 py-3.5">
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
  );
}
