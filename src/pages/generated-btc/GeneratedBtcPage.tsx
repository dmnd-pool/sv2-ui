import { useMemo, useState } from 'react';
import { LiUploadMinimalistic } from 'solar-icon-react/li';
import { useGeneratedBtc, useAggregatedGeneratedBtc } from '@/hooks/useGeneratedBtc';
import { useAccountAllWorkers } from '@/hooks/useAccountData';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useAggregatedData } from '@/hooks/useAggregatedData';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import {
  sortGeneratedByDateDesc,
  filterGeneratedBtc,
  filterGeneratedBtcByAccount,
  searchGeneratedBtc,
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
  const { aggregated } = useAggregatedModeContext();
  const single = useGeneratedBtc();
  // Aggregated mode reads generated-BTC entries across every account, tagged with
  // their owner; the two queries have separate cache entries so toggling never serves
  // the wrong set (same pattern as Payouts/Workers).
  const agg = useAggregatedGeneratedBtc(aggregated);
  const { data, isLoading, isError, refetch } = aggregated ? agg : single;
  const entries = useMemo(() => data ?? [], [data]);

  // The Average-hashrate/Active-workers cards keep their SINGLE-account definitions
  // (mean hashrate over connected workers; count of workers with any submitted share —
  // see averageWorkerHashrate/workersWithSharesCount), just fed a wider roster in
  // aggregated mode. That roster is SUBACCOUNTS ONLY, matching the aggregated Workers
  // table and the Home donut (the main account's own workers are shown separately
  // there too) — it deliberately does NOT reuse Home's "active = connected" figure,
  // which is a different definition of "active" than this page's "submitted a share".
  const { data: allWorkers } = useAccountAllWorkers();
  const aggData = useAggregatedData(aggregated);
  const workers = useMemo(
    () => (aggregated ? aggData.subaccounts.flatMap((s) => s.workers) : (allWorkers ?? [])),
    [aggregated, aggData.subaccounts, allWorkers],
  );

  // The Account facet (aggregated mode only) offers the main account plus every
  // subaccount; an empty selection keeps them all. These names must match the row tags
  // from useAggregatedGeneratedBtc exactly, so both derive from the same shared list.
  const { data: subs } = useSubaccountList();
  const accountNames = useMemo(
    () => (aggregated ? [MAIN_ACCOUNT_LABEL, ...(subs ?? []).map(subaccountName)] : undefined),
    [aggregated, subs],
  );

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GbtcFilterDraft>(EMPTY_GBTC_FILTER_DRAFT);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => sortGeneratedByDateDesc(entries), [entries]);
  // Apply the date filter (preset cutoff or a custom range), the Account facet, and the
  // search box; the list is already newest-first. `now` is read at apply time, so no
  // per-render churn.
  const visible = useMemo(() => {
    const dateFiltered = filterGeneratedBtc(sorted, gbtcDraftToFilter(filter, Date.now()));
    const accountFiltered = filterGeneratedBtcByAccount(dateFiltered, filter.accounts);
    return searchGeneratedBtc(accountFiltered, query);
  }, [sorted, filter, query]);
  const pageData = paginate(visible, page, PAGE_SIZE);

  const totals = useMemo(
    () => ({
      generated: sumGenerated(entries),
      averageHashrate: averageWorkerHashrate(workers),
      activeWorkers: workersWithSharesCount(workers),
    }),
    [entries, workers],
  );

  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
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
  const hasQuery = query.trim().length > 0;
  const tableEmpty =
    visible.length > 0
      ? undefined
      : filterActive
        ? {
            title: 'No generated BTC matches this filter',
            hint: 'Adjust or clear your filters.',
            clearLabel: 'Clear filters',
            onClear: resetFilter,
          }
        : hasQuery
          ? {
              title: 'No generated BTC found',
              hint: 'Try a different subaccount name or clear your search.',
              clearLabel: 'Clear search',
              onClear: () => changeQuery(''),
            }
          : undefined;

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
            <GeneratedBtcToolbar
              filter={filter}
              onApplyFilter={applyFilter}
              onResetFilter={resetFilter}
              query={query}
              onQuery={changeQuery}
              accounts={accountNames}
            />
            <GeneratedBtcTable entries={pageData.items} empty={tableEmpty} showAccount={aggregated} />
            {visible.length > 0 && (
              <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
