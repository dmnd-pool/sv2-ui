import { useMemo, useState } from 'react';
import { LiUploadMinimalistic } from 'solar-icon-react/li';
import { usePayouts } from '@/hooks/usePayouts';
import { searchPayouts, filterPayouts, payoutsToCsv, sinceForPreset } from '@/lib/payoutsTable';
import { paginate } from '@/lib/workersTable';
import { PayoutsToolbar } from '@/components/payouts/PayoutsToolbar';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { PayoutsEmptyState } from '@/components/payouts/PayoutsEmptyState';
import { EMPTY_PAYOUT_FILTER_DRAFT, isPayoutDraftActive, type PayoutFilterDraft } from '@/components/payouts/PayoutsFilter';
import { WorkersPagination } from '@/components/workers/WorkersPagination';

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payouts.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The Payouts page: on-chain payout history with search, filter, pagination, and CSV export. */
export function PayoutsPage() {
  const { data, isLoading, isError, refetch } = usePayouts();
  const payouts = useMemo(() => data ?? [], [data]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PayoutFilterDraft>(EMPTY_PAYOUT_FILTER_DRAFT);
  const [page, setPage] = useState(1);

  const now = Date.now();
  // The list arrives newest-first from the hook; search narrows by txid, then the
  // Filter applies the date preset (as a since-cutoff) and mode. Export mirrors this.
  const visible = useMemo(() => {
    const sinceSec = filter.datePreset ? sinceForPreset(filter.datePreset, now) : null;
    return filterPayouts(searchPayouts(payouts, query), { mode: filter.mode, sinceSec });
  }, [payouts, query, filter, now]);
  const pageData = paginate(visible, page, PAGE_SIZE);

  // Any change to search or filter can shrink the result set, so jump back to page 1.
  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const applyFilter = (next: PayoutFilterDraft) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_PAYOUT_FILTER_DRAFT);
    setPage(1);
  };

  const hasData = !isLoading && !isError && payouts.length > 0;
  const filterActive = isPayoutDraftActive(filter);
  const hasQuery = query.trim().length > 0;
  const tableEmpty =
    visible.length > 0
      ? undefined
      : filterActive
        ? { title: 'No payouts match this filter', hint: 'Adjust or clear your filters.', clearLabel: 'Clear filters', onClear: resetFilter }
        : hasQuery
          ? {
              title: 'No payouts found',
              hint: 'Try a different transaction ID or clear your search.',
              clearLabel: 'Clear search',
              onClear: () => changeQuery(''),
            }
          : undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Payouts</h2>
          <p className="mt-1 text-sm text-body-alt">View your payout history and on-chain transactions.</p>
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => downloadCsv(payoutsToCsv(visible))}
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
          <p className="text-base font-semibold text-foreground">Couldn't load payouts</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong reading your on-chain payout history.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : payouts.length === 0 ? (
        <div className="border-t border-border">
          <PayoutsEmptyState />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <PayoutsToolbar
            query={query}
            onQuery={changeQuery}
            filter={filter}
            onApplyFilter={applyFilter}
            onResetFilter={resetFilter}
          />
          <PayoutsTable payouts={pageData.items} empty={tableEmpty} />
          {visible.length > 0 && (
            <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
          )}
        </div>
      )}
    </div>
  );
}
