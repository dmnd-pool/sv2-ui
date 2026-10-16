import { useMemo, useState } from 'react';
import type { Worker } from '@/api/types';
import {
  deriveWorkersPageStats,
  filterByTab,
  searchWorkers,
  sortWorkers,
  paginate,
  applyWorkerFilter,
  EMPTY_WORKER_FILTER,
  type SortDir,
  type WorkerFilter,
  type WorkerSortKey,
  type WorkersTab,
} from '@/lib/workersTable';
import { WorkerDetailsPanel } from '@/components/workers/WorkerDetailsPanel';
import { WorkersStatCards } from '@/components/workers/WorkersStatCards';
import { WorkersToolbar } from '@/components/workers/WorkersToolbar';
import { WorkersTable } from '@/components/workers/WorkersTable';
import { WorkersPagination } from '@/components/workers/WorkersPagination';

const PAGE_SIZE = 10;

/**
 * The Workers section of the Watcher View. It reuses the signed-in Workers page's
 * cards, toolbar and table so a watcher sees exactly the roster the owner sees, and
 * so future changes to those components apply to both instead of drifting apart. The
 * roster arrives as a prop from the token-only client; nothing here is authenticated.
 */
export function WatcherWorkersSection({
  workers,
  isLoading,
  isError,
}: {
  workers: Worker[];
  isLoading: boolean;
  isError: boolean;
}) {
  const [tab, setTab] = useState<WorkersTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: WorkerSortKey; dir: SortDir }>({ key: 'hashrate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<WorkerFilter>(EMPTY_WORKER_FILTER);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailsWorker, setDetailsWorker] = useState<Worker | null>(null);

  const stats = useMemo(() => deriveWorkersPageStats(workers), [workers]);
  // Same pipeline as the signed-in page: tab -> advanced filter -> search -> sort.
  const sorted = useMemo(() => {
    const narrowed = applyWorkerFilter(filterByTab(workers, tab), filter);
    return sortWorkers(searchWorkers(narrowed, query), sort.key, sort.dir);
  }, [workers, tab, filter, query, sort]);

  const pageData = paginate(sorted, page, PAGE_SIZE);
  const counts: Record<WorkersTab, number> = { all: workers.length, online: stats.active, offline: stats.offline };

  // Narrowing the roster can drop the current page out of range, so every filter
  // change returns to the first page.
  const changeTab = (next: WorkersTab) => {
    setTab(next);
    setPage(1);
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const changeSort = (key: WorkerSortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };
  const applyFilter = (next: WorkerFilter) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_WORKER_FILTER);
    setPage(1);
  };

  // Selection spans the whole filtered set, matching the signed-in page.
  const allSelected = sorted.length > 0 && sorted.every((w) => selected.has(w.name));
  const someSelected = sorted.some((w) => selected.has(w.name));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (sorted.every((w) => next.has(w.name))) sorted.forEach((w) => next.delete(w.name));
      else sorted.forEach((w) => next.add(w.name));
      return next;
    });
  };
  const toggleOne = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-base font-semibold text-foreground">Couldn&apos;t load workers</p>
        <p className="mt-1 text-sm text-body-alt">Something went wrong fetching this account&apos;s worker roster.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkersStatCards stats={stats} />
      <div className="rounded-xl border border-border bg-card">
        <WorkersToolbar
          tab={tab}
          onTab={changeTab}
          counts={counts}
          query={query}
          onQuery={changeQuery}
          filter={filter}
          onApplyFilter={applyFilter}
          onResetFilter={resetFilter}
        />
        <WorkersTable
          workers={pageData.items}
          sort={sort}
          onSort={changeSort}
          selected={selected}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          onOpenDetails={setDetailsWorker}
        />
        <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
      </div>
      {detailsWorker && (
        <WorkerDetailsPanel worker={detailsWorker} onClose={() => setDetailsWorker(null)} />
      )}
    </div>
  );
}
