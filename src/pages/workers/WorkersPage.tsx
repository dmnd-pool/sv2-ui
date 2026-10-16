import { useEffect, useMemo, useRef, useState } from 'react';
import { LiAddCircle, LiDownloadMinimalistic } from 'solar-icon-react/li';
import type { Worker } from '@/api/types';
import { cn, exportFilename } from '@/lib/utils';
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
  filterWorkersByMode,
  EMPTY_WORKER_FILTER,
  type SortDir,
  type WorkerFilter,
  type WorkerSortKey,
  type WorkersTab,
  type WorkerExportMode,
} from '@/lib/workersTable';
import { WorkersStatCards } from '@/components/workers/WorkersStatCards';
import { WorkersToolbar } from '@/components/workers/WorkersToolbar';
import { WorkersTable } from '@/components/workers/WorkersTable';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { WorkersEmptyState } from '@/components/workers/WorkersEmptyState';
import { WorkersNoResults } from '@/components/workers/WorkersNoResults';
import { ConnectWorkersDrawer } from '@/components/workers/ConnectWorkersDrawer';
import { WorkerDetailsPanel } from '@/components/workers/WorkerDetailsPanel';
import { useToast, useToastControls } from '@/components/ui/toast';

const PAGE_SIZE = 10;

const EXPORT_MODES: { value: WorkerExportMode; label: string }[] = [
  { value: 'all', label: 'All workers' },
  { value: 'pplns', label: 'PPLNS only' },
  { value: 'fpps', label: 'FPPS only' },
];

/**
 * The export popover: pick which payout scheme to include, then export.
 */
function ExportModePicker({
  onCancel,
  onExport,
}: {
  onCancel: () => void;
  onExport: (mode: WorkerExportMode) => void;
}) {
  const [mode, setMode] = useState<WorkerExportMode>('all');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Export worker data"
      className="absolute right-0 top-full z-20 mt-2 flex w-[396px] max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-3xl border-[0.5px] border-border bg-card px-8 py-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="!font-body text-lg font-bold leading-7 text-foreground">Export worker data</p>
          <p className="text-sm leading-5 text-body-alt">Choose which payout scheme to include.</p>
        </div>
        <div aria-hidden className="h-[0.5px] bg-border" />
      </div>

      <div className="flex flex-col gap-4" role="radiogroup" aria-label="Export payout scheme">
        {EXPORT_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className="flex items-center gap-2 text-left text-sm leading-5 transition-opacity hover:opacity-80"
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                mode === m.value ? 'border-[hsl(var(--btn))]' : 'border-placeholder',
              )}
            >
              {mode === m.value && <span className="h-2 w-2 rounded-full bg-[hsl(var(--btn))]" />}
            </span>
            <span className={mode === m.value ? 'text-foreground' : 'text-body-alt'}>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div aria-hidden className="h-[0.5px] bg-border" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-6 text-base leading-6 text-foreground transition-opacity hover:opacity-80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onExport(mode)}
            className="h-11 flex-1 rounded-[32px] bg-[hsl(var(--btn))] px-6 text-base font-medium leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The Workers page: roster table with status tabs, search, sort, pagination, and CSV export. */
export function WorkersPage() {
  const { aggregated } = useAggregatedModeContext();
  // Full roster from /api/workers/all (no date range); tabs/search/sort/paginate
  // run client-side over the account-scoped response.
  const singleAccount = useAccountAllWorkers(!aggregated);
  // In aggregated mode the table spans every subaccount, so the rows come from each
  // account's roster tagged with its owner rather than this account's own workers.
  const agg = useAggregatedData(aggregated);
  const workers = useMemo(() => {
    if (!aggregated) return singleAccount.data ?? [];
    // Every account, main included: its own workers are part of the combined roster,
    // not a separate thing shown elsewhere.
    return tagWorkersBySubaccount(agg.accounts.map((a) => ({ sub: a.name, subaccountId: a.id, workers: a.workers })));
  }, [aggregated, singleAccount.data, agg.accounts]);

  const [tab, setTab] = useState<WorkersTab>('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WorkerFilter>(EMPTY_WORKER_FILTER);
  // Sort by hashrate first, followed by names alphabetically.
  const [sort, setSort] = useState<{ key: WorkerSortKey; dir: SortDir }>({ key: 'hashrate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailsWorker, setDetailsWorker] = useState<Worker | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const toast = useToast();
  const { dismiss } = useToastControls();

  const stats = useMemo(() => deriveWorkersPageStats(workers), [workers]);

  const sorted = useMemo(() => {
    // Pipeline: tab -> advanced filter -> search -> sort. The tab and the Filter's
    // Status facet both narrow by health; they intersect (AND), which is expected.
    const narrowed = applyWorkerFilter(filterByTab(workers, tab), filter);
    const searched = searchWorkers(narrowed, query);
    return sortWorkers(searched, sort.key, sort.dir);
  }, [workers, tab, filter, query, sort]);

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
   * Export the chosen payout scheme as CSV.
   */
  const runExport = async (mode: WorkerExportMode) => {
    setExportOpen(false);
    const pending = toast({ type: 'info', message: 'Preparing export...', description: 'Generating your CSV file.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      downloadCsv(workersToCsv(filterWorkersByMode(exportRows, mode)), exportFilename('workers_report', Date.now()));
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
  const loading = aggregated ? agg.isLoading : singleAccount.isLoading;
  const failed = aggregated ? agg.isError : singleAccount.isError;
  const retry = aggregated ? agg.refetch : singleAccount.refetch;

  // A failed fetch must not masquerade as "no workers" (the empty state invites
  // miners to connect hardware they may already have running).
  const canExport = !loading && !failed && workers.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold leading-9 text-heading">Workers</h2>
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
              <ExportModePicker
                onCancel={() => setExportOpen(false)}
                onExport={(mode) => void runExport(mode)}
              />
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      ) : failed ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
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
              accounts={aggregated ? agg.accounts.map((a) => a.name) : undefined}
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
        <WorkerDetailsPanel worker={detailsWorker} onClose={() => setDetailsWorker(null)} />
      )}
    </div>
  );
}
