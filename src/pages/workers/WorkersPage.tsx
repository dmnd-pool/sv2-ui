import { useMemo, useState } from 'react';
import { LiAddCircle, LiDownloadMinimalistic } from 'solar-icon-react/li';
import { useAccountWorkers } from '@/hooks/useAccountData';
import {
  deriveWorkersPageStats,
  filterByTab,
  searchWorkers,
  sortWorkers,
  paginate,
  workersToCsv,
  type SortDir,
  type WorkerSortKey,
  type WorkersTab,
} from '@/lib/workersTable';
import { WorkersStatCards } from '@/components/workers/WorkersStatCards';
import { WorkersToolbar } from '@/components/workers/WorkersToolbar';
import { WorkersTable } from '@/components/workers/WorkersTable';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { WorkersEmptyState } from '@/components/workers/WorkersEmptyState';
import { ConnectWorkerModal } from '@/components/workers/ConnectWorkerModal';

const PAGE_SIZE = 10;

/** Recent window for the worker roster (YYYY-MM-DD, UTC). */
function recentRange(): { from: string; to: string } {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return {
    from: new Date(now - 7 * day).toISOString().slice(0, 10),
    to: new Date(now).toISOString().slice(0, 10),
  };
}

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The Workers page: roster table with status tabs, search, sort, pagination, and CSV export. */
export function WorkersPage() {
  const { from, to } = useMemo(recentRange, []);
  const { data, isLoading, isError, refetch } = useAccountWorkers(from, to);
  const workers = useMemo(() => data?.workers ?? [], [data]);

  const [tab, setTab] = useState<WorkersTab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: WorkerSortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [connectOpen, setConnectOpen] = useState(false);

  const now = Date.now();
  const stats = useMemo(() => deriveWorkersPageStats(workers, now), [workers, now]);

  const sorted = useMemo(() => {
    const filtered = searchWorkers(filterByTab(workers, tab), query);
    return sortWorkers(filtered, sort.key, sort.dir);
  }, [workers, tab, query, sort]);

  const pageData = paginate(sorted, page, PAGE_SIZE);
  const counts: Record<WorkersTab, number> = { all: workers.length, online: stats.active, offline: stats.offline };

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

  // A failed fetch must not masquerade as "no workers" (the empty state invites
  // miners to connect hardware they may already have running).
  const canExport = !isLoading && !isError && workers.length > 0;

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
          <button
            type="button"
            onClick={() => downloadCsv(workersToCsv(sorted, Date.now()))}
            disabled={!canExport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--btn))] px-4 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Export CSV <LiDownloadMinimalistic className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load workers</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong fetching your worker roster.</p>
          <button
            type="button"
            onClick={() => void refetch()}
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
            <WorkersToolbar tab={tab} onTab={changeTab} counts={counts} query={query} onQuery={changeQuery} />
            <WorkersTable workers={pageData.items} sort={sort} onSort={changeSort} now={now} />
            <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
          </div>
        </>
      )}

      {connectOpen && <ConnectWorkerModal onClose={() => setConnectOpen(false)} />}
    </div>
  );
}
