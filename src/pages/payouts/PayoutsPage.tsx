import { useMemo, useState } from 'react';
import { LiUploadMinimalistic } from 'solar-icon-react/li';
import { usePayouts } from '@/hooks/usePayouts';
import {
  searchPayouts,
  filterPayouts,
  payoutsToCsv,
  sinceForPreset,
  sortPayoutsByAmount,
  payoutsInRange,
  type DateRange,
} from '@/lib/payoutsTable';
import { paginate } from '@/lib/workersTable';
import { useToastControls } from '@/components/ui/toast';
import { PayoutsToolbar } from '@/components/payouts/PayoutsToolbar';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { PayoutsEmptyState } from '@/components/payouts/PayoutsEmptyState';
import { PayoutsExportModal } from '@/components/payouts/PayoutsExportModal';
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
  const [exportOpen, setExportOpen] = useState(false);
  const { toast, dismiss } = useToastControls();

  const now = Date.now();
  // The list arrives newest-first from the hook; search narrows by txid, then the
  // Filter applies the date preset (a since-cutoff) and mode, and the Amount option
  // re-sorts by size (otherwise the default newest-first order stands).
  const visible = useMemo(() => {
    const sinceSec = filter.datePreset ? sinceForPreset(filter.datePreset, now) : null;
    const rows = filterPayouts(searchPayouts(payouts, query), { mode: filter.mode, sinceSec });
    return filter.amountSort ? sortPayoutsByAmount(rows, filter.amountSort) : rows;
  }, [payouts, query, filter, now]);
  const pageData = paginate(visible, page, PAGE_SIZE);

  // Export the chosen date range (independent of the table's search/filter) as CSV.
  // The CSV build is synchronous, so yield a frame first, otherwise React batches the
  // preparing and outcome toasts into one tick and the preparing toast never paints.
  const runExport = async (range: DateRange) => {
    setExportOpen(false);
    const pending = toast({ type: 'info', message: 'Preparing export...', description: 'Generating your CSV file.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      downloadCsv(payoutsToCsv(payoutsInRange(payouts, range.startSec, range.endSec)));
      dismiss(pending);
      toast({ type: 'success', message: 'Export complete', description: 'Payouts data has been exported as CSV.' });
    } catch {
      dismiss(pending);
      toast({ type: 'error', message: 'Export failed', description: "We couldn't generate your CSV file. Please try again." });
    }
  };

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
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              aria-expanded={exportOpen}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              <LiUploadMinimalistic className="h-4 w-4" /> Export CSV
            </button>
            {exportOpen && <PayoutsExportModal onCancel={() => setExportOpen(false)} onExport={runExport} />}
          </div>
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
