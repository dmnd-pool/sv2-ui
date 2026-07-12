import { useMemo, useState } from 'react';
import { LiUploadMinimalistic } from 'solar-icon-react/li';
import { useGeneratedBtc } from '@/hooks/useGeneratedBtc';
import { useAccountAllWorkers } from '@/hooks/useAccountData';
import {
  sortGeneratedByDateDesc,
  filterGeneratedBtc,
  sumGenerated,
  averageWorkerHashrate,
  workersWithSharesCount,
  generatedBtcToCsv,
} from '@/lib/generatedBtcTable';
import { paginate } from '@/lib/workersTable';
import { GeneratedBtcStatCards } from '@/components/generated-btc/GeneratedBtcStatCards';
import { GeneratedBtcToolbar } from '@/components/generated-btc/GeneratedBtcToolbar';
import { GeneratedBtcTable } from '@/components/generated-btc/GeneratedBtcTable';
import { GeneratedBtcEmptyState } from '@/components/generated-btc/GeneratedBtcEmptyState';
import {
  EMPTY_GBTC_FILTER_DRAFT,
  gbtcDraftToFilter,
  isGbtcDraftActive,
  type GbtcFilterDraft,
} from '@/components/generated-btc/GeneratedBtcFilter';
import { WorkersPagination } from '@/components/workers/WorkersPagination';

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'generated_btc.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * The Generated BTC page: the account's daily generated-BTC entries with summary
 * cards, a date filter, pagination, and CSV export. Only the Date/Average-hashrate/
 * Generated-BTC columns are backed by the API; the Mode + Estimated-payout columns
 * and the worker-name search have no backing endpoint and are not shown.
 */
export function GeneratedBtcPage() {
  const { data, isLoading, isError, refetch } = useGeneratedBtc();
  const { data: allWorkers } = useAccountAllWorkers();
  const entries = useMemo(() => data ?? [], [data]);
  const workers = useMemo(() => allWorkers ?? [], [allWorkers]);

  const [filter, setFilter] = useState<GbtcFilterDraft>(EMPTY_GBTC_FILTER_DRAFT);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => sortGeneratedByDateDesc(entries), [entries]);
  // Apply the date filter (preset cutoff or a custom range); the list is already
  // newest-first. `now` is read at apply time, so no per-render churn.
  const visible = useMemo(() => filterGeneratedBtc(sorted, gbtcDraftToFilter(filter, Date.now())), [sorted, filter]);
  const pageData = paginate(visible, page, PAGE_SIZE);

  const totals = useMemo(
    () => ({
      generated: sumGenerated(entries),
      averageHashrate: averageWorkerHashrate(workers),
      activeWorkers: workersWithSharesCount(workers),
    }),
    [entries, workers],
  );

  const applyFilter = (next: GbtcFilterDraft) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_GBTC_FILTER_DRAFT);
    setPage(1);
  };

  const hasData = !isLoading && !isError && entries.length > 0;
  const filterActive = isGbtcDraftActive(filter);
  const tableEmpty =
    visible.length > 0 || !filterActive
      ? undefined
      : {
          title: 'No generated BTC in this range',
          hint: 'Adjust or clear the date filter.',
          clearLabel: 'Clear filter',
          onClear: resetFilter,
        };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Generated BTC</h2>
          <p className="mt-1 text-sm text-body-alt">Track your mining rewards and earnings over time.</p>
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => downloadCsv(generatedBtcToCsv(visible))}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            <LiUploadMinimalistic className="h-4 w-4" /> Export CSV
          </button>
        )}
      </header>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load generated BTC</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong reading your mining rewards.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="border-t border-border">
          <GeneratedBtcEmptyState />
        </div>
      ) : (
        <>
          <GeneratedBtcStatCards
            generated={totals.generated}
            averageHashrate={totals.averageHashrate}
            activeWorkers={totals.activeWorkers}
          />
          <div className="rounded-xl border border-border bg-card">
            <GeneratedBtcToolbar filter={filter} onApplyFilter={applyFilter} onResetFilter={resetFilter} />
            <GeneratedBtcTable entries={pageData.items} empty={tableEmpty} />
            {visible.length > 0 && (
              <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
