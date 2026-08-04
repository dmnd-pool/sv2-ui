import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { LiExport } from 'solar-icon-react/li';
import { useSubaccounts, useSubaccountList, usePermissions } from '@/hooks/useSubaccounts';
import { useAggregatedGeneratedBtc } from '@/hooks/useGeneratedBtc';
import { useAccountSwitcher } from '@/hooks/useAccountSwitcher';
import { useToastControls } from '@/components/ui/toast';
import {
  deriveSubaccountsPageStats,
  searchSubaccounts,
  applySubaccountFilter,
  isSubaccountFilterActive,
  subaccountsToCsv,
  withGeneratedBtc,
  EMPTY_SUBACCOUNT_FILTER,
  type EnrichedSubaccount,
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
  // Lifetime generated BTC per account comes from the same account-tagged query the
  // Generated BTC page uses, so the column costs one shared request instead of a third
  // call per row. Its failure only blanks that column; the table still renders.
  const { data: generatedEntries } = useAggregatedGeneratedBtc();
  const { data: rawSubaccounts, refetch: refetchList } = useSubaccountList();
  const { switchToSubaccount, switching } = useAccountSwitcher();
  const { toast, dismiss } = useToastControls();
  const subaccounts = useMemo(
    () => withGeneratedBtc(data ?? [], generatedEntries ?? []),
    [data, generatedEntries],
  );

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SubaccountFilter>(EMPTY_SUBACCOUNT_FILTER);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const stats = useMemo(() => deriveSubaccountsPageStats(subaccounts), [subaccounts]);
  // Search narrows by name, then the Filter popover applies status/rejection and the
  // Sort by order (default name asc). Export mirrors exactly what's on screen.
  const visible = useMemo(
    () => applySubaccountFilter(searchSubaccounts(subaccounts, query), filter),
    [subaccounts, query, filter],
  );
  const pageData = paginate(visible, page, PAGE_SIZE);

  const allSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));
  const someSelected = visible.some((s) => selected.has(s.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((s) => s.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // Export the checked subset when any rows are selected, otherwise the full filtered
  // set, matching the workers table. The CSV build is synchronous, so yield a frame
  // first or React batches the preparing and outcome toasts into one tick and the
  // preparing toast never paints.
  const exportRows = someSelected ? visible.filter((s) => selected.has(s.id)) : visible;
  const runExport = async () => {
    const pending = toast({ type: 'info', message: 'Preparing export...', description: 'Generating your CSV file.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      downloadCsv(subaccountsToCsv(exportRows));
      dismiss(pending);
      toast({ type: 'success', message: 'Export complete', description: 'Subaccount data has been exported as CSV.' });
    } catch {
      dismiss(pending);
      toast({
        type: 'error',
        message: 'Export failed',
        description: "We couldn't generate your CSV file. Please try again.",
      });
    }
  };

  // Opening a subaccount points the dashboard at it; the switch itself redirects away
  // from this page, which a subaccount is not permitted to view.
  const openSubaccount = (sub: EnrichedSubaccount) => {
    // The enriched row deliberately drops the account token; read it from the raw list
    // (already cached for the account switcher) rather than widening the view model.
    const row = (rawSubaccounts ?? []).find((s) => s.id === sub.id);
    if (row) void switchToSubaccount({ id: row.id, token: row.token });
  };

  // Opening the subaccount just created: it may not be in the cached list yet (the
  // create invalidates it and the refetch is still in flight), so fall back to reading
  // the list again rather than letting the click do nothing.
  const openNewest = async (createdName: string) => {
    let row = (rawSubaccounts ?? []).find((s) => s.sub_account.trim() === createdName);
    if (!row) {
      const refreshed = await refetchList();
      row = (refreshed.data ?? []).find((s) => s.sub_account.trim() === createdName);
    }
    if (row) await switchToSubaccount({ id: row.id, token: row.token });
  };

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
          <h2 className="font-heading text-2xl font-semibold leading-9 text-heading">Subaccounts</h2>
          <p className="mt-1 text-sm text-body-alt">Manage separate mining operations under your account.</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
              >
                <Plus className="h-3.5 w-3.5" /> Create subaccount
              </button>
            )}
            <button
              type="button"
              onClick={() => void runExport()}
              className="inline-flex h-9 items-center gap-2 rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-5 text-sm leading-5 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              <LiExport className="h-3.5 w-3.5" /> Export CSV
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
            <SubaccountsTable
              subaccounts={pageData.items}
              empty={tableEmpty}
              selected={selected}
              allSelected={allSelected}
              someSelected={someSelected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onOpen={openSubaccount}
              // Also held until the raw list arrives, since the account token that the
              // switch needs lives there; without it the click would silently do nothing.
              opening={switching || rawSubaccounts === undefined}
            />
            {visible.length > 0 && (
              <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
            )}
          </div>
        </>
      )}

      {createOpen && (
        <CreateSubaccountModal
          onClose={() => setCreateOpen(false)}
          onOpenCreated={(n) => void openNewest(n)}
        />
      )}
    </div>
  );
}
