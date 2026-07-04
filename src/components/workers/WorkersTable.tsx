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

/** The workers data table (one page of rows). Headers for name/hashrate/rejection sort. */
export function WorkersTable({
  workers,
  sort,
  onSort,
  now,
}: {
  workers: Worker[];
  sort: SortState;
  onSort: (key: WorkerSortKey) => void;
  now: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
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
          </tr>
        </thead>
        <tbody>
          {workers.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-body-alt">
                No workers match your search.
              </td>
            </tr>
          )}
          {workers.map((w) => {
            const rej = workerRejection(w);
            return (
              <tr key={w.name} className="border-b border-border last:border-0">
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
