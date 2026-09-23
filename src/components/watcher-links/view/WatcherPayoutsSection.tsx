import { useMemo, useState } from 'react';
import type { Payout } from '@/lib/payoutsTable';
import { filterPayouts, searchPayouts, sinceForPreset, sortPayoutsByAmount } from '@/lib/payoutsTable';
import { paginate } from '@/lib/workersTable';
import { EMPTY_PAYOUT_FILTER_DRAFT, isPayoutDraftActive, type PayoutFilterDraft } from '@/components/payouts/PayoutsFilter';
import { PayoutsEmptyState } from '@/components/payouts/PayoutsEmptyState';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { PayoutsToolbar } from '@/components/payouts/PayoutsToolbar';
import { WorkersPagination } from '@/components/workers/WorkersPagination';

const PAGE_SIZE = 10;

/** Read-only payout history carried by the watcher's existing earnings scope. */
export function WatcherPayoutsSection({
  payouts,
  isLoading,
  isError,
}: {
  payouts: Payout[];
  isLoading: boolean;
  isError: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PayoutFilterDraft>(EMPTY_PAYOUT_FILTER_DRAFT);
  const [page, setPage] = useState(1);
  const now = Date.now();
  const visible = useMemo(() => {
    const sinceSec = filter.datePreset ? sinceForPreset(filter.datePreset, now) : null;
    const rows = filterPayouts(searchPayouts(payouts, query), { modes: filter.modes, sinceSec });
    return filter.amountSort ? sortPayoutsByAmount(rows, filter.amountSort) : rows;
  }, [filter, now, payouts, query]);
  const pageData = paginate(visible, page, PAGE_SIZE);
  const changeQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const applyFilter = (value: PayoutFilterDraft) => {
    setFilter(value);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_PAYOUT_FILTER_DRAFT);
    setPage(1);
  };
  const empty = visible.length > 0
    ? undefined
    : isPayoutDraftActive(filter)
      ? { title: 'No payouts match this filter', hint: 'Adjust or clear your filters.', clearLabel: 'Clear filters', onClear: resetFilter }
      : query.trim()
        ? { title: 'No payouts found', hint: 'Try a different transaction ID.', clearLabel: 'Clear search', onClear: () => changeQuery('') }
        : undefined;

  if (isLoading) return <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-base font-semibold text-foreground">Couldn&apos;t load payouts</p>
        <p className="mt-1 text-sm text-body-alt">The on-chain payout history is temporarily unavailable.</p>
      </div>
    );
  }
  if (payouts.length === 0) return <PayoutsEmptyState />;

  return (
    <div className="rounded-xl border border-border bg-card">
      <PayoutsToolbar
        query={query}
        onQuery={changeQuery}
        filter={filter}
        onApplyFilter={applyFilter}
        onResetFilter={resetFilter}
      />
      <PayoutsTable payouts={pageData.items} empty={empty} selectable={false} />
      {visible.length > 0 && (
        <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
      )}
    </div>
  );
}
