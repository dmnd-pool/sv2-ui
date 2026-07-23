import { useMemo, useState } from 'react';
import { LiAddCircle, LiDownloadMinimalistic } from 'solar-icon-react/li';
import type { Worker } from '@/api/types';
import { useAccountAllWorkers } from '@/hooks/useAccountData';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useAggregatedData } from '@/hooks/useAggregatedData';
import {
  deriveWorkersPageStats,
  tagWorkersBySubaccount,
  workerRowId,
  filterByTab,
  searchWorkers,
  sortWorkers,
  paginate,
  workersToCsv,
  applyWorkerFilter,
  filterWorkersByRange,
  EMPTY_WORKER_FILTER,
  type SortDir,
  type WorkerFilter,
  type WorkerSortKey,
  type WorkersTab,
} from '@/lib/workersTable';
import { WorkersStatCards } from '@/components/workers/WorkersStatCards';
import { WorkersToolbar } from '@/components/workers/WorkersToolbar';
import { WorkersTable } from '@/components/workers/WorkersTable';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { WorkersEmptyState } from '@/components/workers/WorkersEmptyState';
import { WorkersNoResults } from '@/components/workers/WorkersNoResults';
import { ConnectWorkersDrawer } from '@/components/workers/ConnectWorkersDrawer';
import { WorkerDetailsPanel } from '@/components/workers/WorkerDetailsPanel';
import { PayoutsExportModal } from '@/components/payouts/PayoutsExportModal';
import { useToast, useToastControls } from '@/components/ui/toast';

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workers_report.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The Workers page: roster table with status tabs, search, sort, pagination, and CSV export. */
export function WorkersPage() {
  // Full roster from /api/workers/all (no date range); tabs/search/sort/paginate
  // run client-side over it.
  const { data, isLoading, isError, refetch } = useAccountAllWorkers();
  const { aggregated } = useAggregatedModeContext();
  // In aggregated mode the table spans every subaccount, so the rows come from each
  // account's roster tagged with its owner rather than this account's own workers.
  const agg = useAggregatedData(aggregated);
  const workers = useMemo(() => {
    if (!aggregated) return data ?? [];
    return tagWorkersBySubaccount(agg.subaccounts.map((s) => ({ sub: s.name, subaccountId: s.id, workers: s.workers })));
  }, [aggregated, data, agg.subaccounts]);

  const [tab, setTab] = useState<WorkersTab>('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WorkerFilter>(EMPTY_WORKER_FILTER);
  const [sort, setSort] = useState<{ key: WorkerSortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailsWorker, setDetailsWorker] = useState<Worker | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const toast = useToast();
  const { dismiss } = useToastControls();

  const now = Date.now();
  const stats = useMemo(() => deriveWorkersPageStats(workers, now), [workers, now]);

  const sorted = useMemo(() => {
    // Pipeline: tab -> advanced filter -> search -> sort. The tab and the Filter's
    // Status facet both narrow by health; they intersect (AND), which is expected.
    const narrowed = applyWorkerFilter(filterByTab(workers, tab), filter, now);
    const searched = searchWorkers(narrowed, query, now);
    return sortWorkers(searched, sort.key, sort.dir);
  }, [workers, tab, filter, query, sort, now]);

  const pageData = paginate(sorted, page, PAGE_SIZE);
  const counts: Record<WorkersTab, number> = { all: workers.length, online: stats.active, offline: stats.offline };

  // Selection spans the whole filtered set (not just the visible page), so export and
  // the header select-all reason over every matching worker. Stale names left over from
  // a since-changed filter simply don't intersect `sorted`, so they're ignored.
  const allSelected = sorted.length > 0 && sorted.every((w) => selected.has(workerRowId(w)));
  const someSelected = sorted.some((w) => selected.has(workerRowId(w)));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (sorted.every((w) => next.has(workerRowId(w)))) sorted.forEach((w) => next.delete(workerRowId(w)));
      else sorted.forEach((w) => next.add(workerRowId(w)));
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
  // Export the checked subset when any rows are selected, otherwise the full filtered set.
  const exportRows = someSelected ? sorted.filter((w) => selected.has(workerRowId(w))) : sorted;

  /**
   * Export the chosen date range as CSV. `/api/workers/all` has no date parameter, so
   * the range narrows the rows we already hold by when each worker was last connected.
   * The CSV build is synchronous, so yield a frame first or React batches the preparing
   * and outcome toasts into one tick and the preparing toast never paints.
   */
  const runExport = async (range: { startSec: number; endSec: number }) => {
    setExportOpen(false);
    const pending = toast({ type: 'info', message: 'Preparing export...', description: 'Generating your CSV file.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      downloadCsv(workersToCsv(filterWorkersByRange(exportRows, range.startSec, range.endSec, now)));
      dismiss(pending);
      toast({ type: 'success', message: 'Export complete', description: 'Worker data has been exported as CSV.' });
    } catch {
      dismiss(pending);
      toast({
        type: 'error',
        message: 'Export failed',
        description: "We couldn't generate your CSV file. Please try again.",
      });
    }
  };

  const changeTab = (next: WorkersTab) => {
    setTab(next);
    setPage(1);
  };
  const changeQuery = (next: string) => {
    setQuery(next);
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
  const changeSort = (key: WorkerSortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  // In aggregated mode the roll-up query owns the page's loading and error states, so a
  // failed subaccount fetch is reported rather than rendering a partial roster.
  const loading = aggregated ? agg.isLoading : isLoading;
  const failed = aggregated ? agg.isError : isError;
  const retry = aggregated ? agg.refetch : refetch;

  // A failed fetch must not masquerade as "no workers" (the empty state invites
  // miners to connect hardware they may already have running).
  const canExport = !loading && !failed && workers.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Workers</h2>
          <p className="mt-1 text-sm text-body-alt">Monitor connected machines, share activity, and worker health.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Connect worker <LiAddCircle className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              disabled={!canExport}
              aria-expanded={exportOpen}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--btn))] px-4 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Export CSV <LiDownloadMinimalistic className="h-4 w-4" />
            </button>
            {exportOpen && (
              <PayoutsExportModal
                title="Export worker data"
                onCancel={() => setExportOpen(false)}
                onExport={(range) => void runExport(range)}
              />
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      ) : failed ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load workers</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong fetching your worker roster.</p>
          <button
            type="button"
            onClick={() => void retry()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : workers.length === 0 ? (
        <WorkersEmptyState />
      ) : (
        <>
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
              accounts={aggregated ? agg.subaccounts.map((s) => s.name) : undefined}
            />
            {sorted.length === 0 ? (
              // Workers exist but the active search or filter matches none. Show the
              // search variant whenever a query is present, otherwise the filter variant
              // (the tab and advanced Filter both narrow, so either can empty the list).
              <WorkersNoResults
                mode={query.trim() ? 'search' : 'filter'}
                onClear={() => {
                  setTab('all');
                  resetFilter();
                }}
              />
            ) : (
              <>
                <WorkersTable
                  showAccount={aggregated}
                  workers={pageData.items}
                  sort={sort}
                  onSort={changeSort}
                  now={now}
                  selected={selected}
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggleAll={toggleAll}
                  onToggleOne={toggleOne}
                  onOpenDetails={setDetailsWorker}
                />
                <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
              </>
            )}
          </div>
        </>
      )}

      {connectOpen && <ConnectWorkersDrawer onClose={() => setConnectOpen(false)} />}
      {detailsWorker && (
        <WorkerDetailsPanel worker={detailsWorker} now={now} onClose={() => setDetailsWorker(null)} />
      )}
    </div>
  );
}
