import { downloadCsv } from '@/lib/utils';
import type { Worker } from '@/api/types';
import { Reading } from '@/components/ui/Reading';
import { StatCard } from '@/components/ui/StatCard';
import { SelectionActions, TableToolbar } from '@/components/ui/TableToolbar';
import { useToast, useToastControls } from '@/components/ui/toast';
import { WorkerBars } from '@/components/ui/WorkerBars';
import { ConnectWorkersDrawer } from '@/components/workers/ConnectWorkersDrawer';
import { WorkerDetailsPanel } from '@/components/workers/WorkerDetailsPanel';
import { WorkersEmptyState } from '@/components/workers/WorkersEmptyState';
import { WorkersFilter } from '@/components/workers/WorkersFilter';
import { WorkersNoResults } from '@/components/workers/WorkersNoResults';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { WorkersTable } from '@/components/workers/WorkersTable';
import { ACTIVE_WORKERS_HINT, OFFLINE_WORKER_HINT, WORKER_REJECTION_HINT, WORKER_ROSTER_HINT, LIVE_HASHRATE_HINT } from '@/lib/metricWindows';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { cn, exportFilename } from '@/lib/utils';
import type { WorkersPageStats } from '@/lib/workersTable';
import {
  applyWorkerFilter,
  deriveWorkersPageStats,
  EMPTY_WORKER_FILTER,
  filterByTab,
  filterWorkersByMode,
  isWorkerFilterActive,
  paginate,
  searchWorkers,
  sortWorkers,
  workerRowId,
  workersToCsv,
  type SortDir,
  type WorkerExportMode,
  type WorkerFilter,
  type WorkerSortKey,
  type WorkersTab,
} from '@/lib/workersTable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LiAddCircle, LiDownloadMinimalistic } from 'solar-icon-react/li';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useAccountAllWorkers } from '@/hooks/useAccountData';
import { useAggregatedWorkers } from '@/hooks/useAggregatedData';
import { tagWorkersBySubaccount } from '@/lib/workersTable';

const PAGE_SIZE = 10;
const WORKER_TABS: { key: WorkersTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
];

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
            className="h-11 flex-1 rounded-[32px] bg-info px-6 text-base font-medium leading-6 text-info-foreground transition-opacity hover:opacity-90"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}


/** The Workers page: roster table with status tabs, search, sort, pagination, and CSV export. */
export function WorkersContent({ workers, isLoading: loading, isError: failed, onRetry: retry, accounts, canConnect = false, canExport: allowExport = false }: {
  workers: Worker[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => unknown;
  accounts?: string[];
  canConnect?: boolean;
  canExport?: boolean;
}) {
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

  // A failed fetch must not masquerade as "no workers" (the empty state invites
  // miners to connect hardware they may already have running).
  const canExport = allowExport && !loading && !failed && workers.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold leading-9 text-heading">Workers</h2>
          <p className="mt-1 text-sm text-body-alt">Monitor connected machines, share activity, and worker health.</p>
        </div>
        <div className="flex items-center gap-2">
          {canConnect && <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Connect worker <LiAddCircle className="h-4 w-4" />
          </button>}
          {allowExport && <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              disabled={!canExport}
              aria-expanded={exportOpen}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5 rounded-lg bg-info px-4 py-2 text-sm font-medium text-info-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Export CSV <LiDownloadMinimalistic className="h-4 w-4" />
            </button>
            {exportOpen && (
              <ExportModePicker
                onCancel={() => setExportOpen(false)}
                onExport={(mode) => void runExport(mode)}
              />
            )}
          </div>}
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
        <WorkersEmptyState canConnect={canConnect} />
      ) : (
        <>
          <WorkersStatCards stats={stats} />
          <div className="rounded-xl border border-border bg-card">
            <TableToolbar
              title="Workers"
              query={query}
              onQuery={changeQuery}
              searchPlaceholder="Search workers"
              filterActive={isWorkerFilterActive(filter)}
              variant="tabs"
              renderFilter={(onClose) => <WorkersFilter
                applied={filter}
                onApply={applyFilter}
                onReset={resetFilter}
                onClose={onClose}
                accounts={accounts}
              />}
              tabs={<div className="flex items-center gap-3">
                {WORKER_TABS.map((item) => <button
                  key={item.key}
                  type="button"
                  onClick={() => changeTab(item.key)}
                  className={cn('inline-flex items-center gap-1 rounded-sm border-[0.5px] border-border px-3 py-1 text-sm font-medium leading-5 transition-colors', tab === item.key ? 'bg-[#262626] text-white' : 'bg-card text-body-alt hover:text-foreground')}
                >
                  {item.label}
                  <span className={cn('rounded-full border-[0.5px] border-border px-1 text-xs leading-4', tab === item.key ? 'bg-card text-foreground' : 'bg-btn-secondary text-foreground')}>{counts[item.key]}</span>
                </button>)}
              </div>}
            />
            {allowExport && <SelectionActions count={sorted.filter((worker) => selected.has(workerRowId(worker))).length}
              onExport={() => void runExport('all')} onClear={() => setSelected(new Set())} />}
            {sorted.length === 0 ? (
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
                  showAccount={accounts !== undefined}
                  workers={pageData.items}
                  sort={sort}
                  onSort={changeSort}
                  selected={allowExport ? selected : undefined}
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggleAll={allowExport ? toggleAll : undefined}
                  onToggleOne={allowExport ? toggleOne : undefined}
                  onOpenDetails={setDetailsWorker}
                />
                <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
              </>
            )}
          </div>
        </>
      )}

      {canConnect && connectOpen && <ConnectWorkersDrawer onClose={() => setConnectOpen(false)} />}
      {detailsWorker && (
        <WorkerDetailsPanel worker={detailsWorker} onClose={() => setDetailsWorker(null)} />
      )}
    </div>
  );
}

/** Active/total workers, offline workers, ten-minute hashrate, and rejection rate. */
function WorkersStatCards({ stats }: { stats: WorkersPageStats }) {
  const hasWorkers = stats.total > 0;
  const rated = stats.rejectionRate !== null;
  const rejection = rated ? (stats.rejectionRate! * 100).toFixed(2) : '--';
  const scale = pickHashrateScale([stats.hashrate10m ?? 0]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard variant="workers"
        title="Active workers"
        hint={`${ACTIVE_WORKERS_HINT} ${WORKER_ROSTER_HINT}`}
        captionTone={hasWorkers ? 'strong' : 'muted'}
        caption={
          <span className="flex flex-col gap-2">
            {hasWorkers && <WorkerBars active={stats.active} total={stats.total} />}
            <span>
              {stats.active} active &middot; {stats.offline} offline
            </span>
          </span>
        }
      >
        <Reading value={stats.active} unit={`/ ${stats.total} total`} unitSize="base" />
      </StatCard>

      <StatCard variant="workers"
        title="Offline"
        hint={OFFLINE_WORKER_HINT}
        captionTone={hasWorkers ? 'strong' : 'muted'}
        caption={stats.offline > 0 ? 'Inactive in the last 10 minutes' : 'All workers are active'}
      >
        <Reading value={stats.offline} />
      </StatCard>

      <StatCard variant="workers"
        title="Average hashrate (10m)"
        hint={LIVE_HASHRATE_HINT}
        caption="Combined across all workers"
      >
        <Reading value={stats.hashrate10m === null ? '--' : formatAxisValue(stats.hashrate10m, scale.divisor)} unit={stats.hashrate10m === null ? undefined : scale.unit} />
      </StatCard>

      <StatCard variant="workers"
        title="Rejection rate"
        hint={WORKER_REJECTION_HINT}
        captionTone={rated ? 'strong' : 'muted'}
        caption="Rejection rate over the last 10 minutes across all workers"
      >
        <Reading value={rejection} unit={rated ? '%' : undefined} />
      </StatCard>
    </div>
  );
}

/** Signed-in adapter; public watcher routes mount WorkersContent instead. */
export function WorkersPage() {
  const { aggregated } = useAggregatedModeContext();
  // Full roster from /api/workers/all (no date range); tabs/search/sort/paginate
  // run client-side over the account-scoped response.
  const singleAccount = useAccountAllWorkers(!aggregated);
  // In aggregated mode the table spans every subaccount, so the rows come from each
  // account's roster tagged with its owner rather than this account's own workers.
  const agg = useAggregatedWorkers(aggregated);
  const workers = useMemo(() => {
    if (!aggregated) return singleAccount.data ?? [];
    // Every account, main included: its own workers are part of the combined roster,
    // not a separate thing shown elsewhere.
    return tagWorkersBySubaccount(agg.accounts.map((a) => ({ sub: a.name, subaccountId: a.id, workers: a.workers })));
  }, [aggregated, singleAccount.data, agg.accounts]);

  return <WorkersContent workers={workers} isLoading={aggregated ? agg.isLoading : singleAccount.isLoading} isError={aggregated ? agg.isError : singleAccount.isError} onRetry={aggregated ? agg.refetch : singleAccount.refetch} accounts={aggregated ? agg.accounts.map((a) => a.name) : undefined} canConnect={!aggregated} canExport />;
}
