import { useMemo, useState } from 'react';
import { LiAddCircle, LiDownloadMinimalistic } from 'solar-icon-react/li';
import { useSubaccounts, usePermissions } from '@/hooks/useSubaccounts';
import {
  deriveSubaccountsPageStats,
  searchSubaccounts,
  applySubaccountFilter,
  isSubaccountFilterActive,
  subaccountsToCsv,
  EMPTY_SUBACCOUNT_FILTER,
  type SubaccountFilter,
} from '@/lib/subaccountsTable';
import { paginate } from '@/lib/workersTable';
import { SubaccountsStatCards } from '@/components/subaccounts/SubaccountsStatCards';
import { SubaccountsToolbar } from '@/components/subaccounts/SubaccountsToolbar';
import { SubaccountsTable } from '@/components/subaccounts/SubaccountsTable';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { SubaccountsEmptyState } from '@/components/subaccounts/SubaccountsEmptyState';
import { CreateSubaccountModal } from '@/components/subaccounts/CreateSubaccountModal';

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subaccounts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The Subaccounts page: stat cards + table with search, sort, pagination, CSV, and create. */
export function SubaccountsPage() {
  const { data, isLoading, isError, refetch } = useSubaccounts();
  const { data: permissions } = usePermissions();
  const subaccounts = useMemo(() => data ?? [], [data]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SubaccountFilter>(EMPTY_SUBACCOUNT_FILTER);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => deriveSubaccountsPageStats(subaccounts), [subaccounts]);
  // Search narrows by name, then the Filter popover applies status/rejection and the
  // Sort by order (default name asc). Export mirrors exactly what's on screen.
  const visible = useMemo(
    () => applySubaccountFilter(searchSubaccounts(subaccounts, query), filter),
    [subaccounts, query, filter],
  );
  const pageData = paginate(visible, page, PAGE_SIZE);

  const canCreate = permissions?.create_sub_account ?? false;
  // Header actions only make sense once there's a populated table to act on; the
  // empty and error states carry their own primary button instead.
  const hasData = !isLoading && !isError && subaccounts.length > 0;

  // Any change to search or filter can shrink the result set, so jump back to page 1
  // to avoid stranding the user on a now-empty page.
  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const applyFilter = (next: SubaccountFilter) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_SUBACCOUNT_FILTER);
    setPage(1);
  };

  // Distinguish the two "no match" states: a filter with no results vs a search
  // with no results. Filter takes precedence since it is the stronger signal.
  const filterActive = isSubaccountFilterActive(filter);
  const hasQuery = query.trim().length > 0;
  const tableEmpty =
    visible.length > 0
      ? undefined
      : filterActive
        ? {
            title: 'No subaccounts match this filter',
            hint: 'Adjust or clear your filters.',
            clearLabel: 'Clear filters',
            onClear: resetFilter,
          }
        : hasQuery
          ? {
              title: 'No subaccounts found',
              hint: 'Try a different subaccount name or clear your search.',
              clearLabel: 'Clear search',
              onClear: () => changeQuery(''),
            }
          : undefined;

  // Subaccounts are master-only; a permitted-false account gets a clear message
  // instead of an empty table.
  if (permissions && !permissions.view_sub_accounts) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-base font-semibold text-foreground">Subaccounts aren't available</p>
        <p className="mt-1 text-sm text-body-alt">This account can't view or manage subaccounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Subaccounts</h2>
          <p className="mt-1 text-sm text-body-alt">Manage separate mining operations under your account.</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <LiAddCircle className="h-4 w-4" /> Create subaccount
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadCsv(subaccountsToCsv(visible))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--btn))] px-4 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              <LiDownloadMinimalistic className="h-4 w-4" /> Export CSV
            </button>
          </div>
        )}
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
          <p className="text-base font-semibold text-foreground">Couldn't load subaccounts</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong fetching your subaccounts.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : subaccounts.length === 0 ? (
        <SubaccountsEmptyState onCreate={() => setCreateOpen(true)} canCreate={canCreate} />
      ) : (
        <>
          <SubaccountsStatCards stats={stats} />
          <div className="rounded-xl border border-border bg-card">
            <SubaccountsToolbar
              query={query}
              onQuery={changeQuery}
              filter={filter}
              onApplyFilter={applyFilter}
              onResetFilter={resetFilter}
            />
            <SubaccountsTable subaccounts={pageData.items} empty={tableEmpty} />
            {visible.length > 0 && (
              <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
            )}
          </div>
        </>
      )}

      {createOpen && <CreateSubaccountModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
