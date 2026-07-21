import { useMemo, useState } from 'react';
import { LiAddCircle } from 'solar-icon-react/li';
import { useAuth } from '@/auth';
import type { WatcherLink } from '@/api/types';
import { useWatcherLinks, useCreateWatcherLink, useRevokeWatcherLink } from '@/hooks/useWatcherLinks';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { searchWatcherLinks, applyWatcherFilter } from '@/lib/watcherLinks';
import {
  EMPTY_WATCHER_DRAFT,
  isWatcherDraftActive,
  watcherDraftToFilter,
  type WatcherFilterDraft,
} from '@/components/watcher-links/WatcherLinksFilter';
import { paginate } from '@/lib/workersTable';
import { WatcherLinksToolbar } from '@/components/watcher-links/WatcherLinksToolbar';
import { WatcherLinksTable } from '@/components/watcher-links/WatcherLinksTable';
import { WatcherLinksEmptyState } from '@/components/watcher-links/WatcherLinksEmptyState';
import { CreateWatcherLinkPanel } from '@/components/watcher-links/CreateWatcherLinkPanel';
import { WatcherLinkDetailsPanel } from '@/components/watcher-links/WatcherLinkDetailsPanel';
import { AggregateWatcherLinksPanel } from '@/components/watcher-links/AggregateWatcherLinksPanel';
import { WorkersPagination } from '@/components/workers/WorkersPagination';

const PAGE_SIZE = 10;

/** The app's own origin, so a shared link points at this deployment, never a hardcoded host. */
function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * The Watcher links page: the read-only links this account has issued, each scoped to
 * one account (the master account or a subaccount) and to a set of read permissions.
 */
export function WatcherLinksPage() {
  const { session } = useAuth();
  const { data, isLoading, isError, refetch } = useWatcherLinks();
  // Names only; a failure here leaves the account column as "--" rather than taking
  // the page down, since the links themselves are still correct.
  const { data: subs } = useSubaccountList();

  const links = useMemo(() => data ?? [], [data]);
  const subaccounts = useMemo(() => subs ?? [], [subs]);
  const origin = currentOrigin();
  const sessionAccountId = session?.accountId ?? null;

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<WatcherFilterDraft>(EMPTY_WATCHER_DRAFT);
  const [createOpen, setCreateOpen] = useState(false);
  const [aggregateOpen, setAggregateOpen] = useState(false);
  const [viewing, setViewing] = useState<WatcherLink | null>(null);
  const create = useCreateWatcherLink();
  const revoke = useRevokeWatcherLink();

  // Search narrows first, then the Filter's facets narrow and order what is left.
  const visible = useMemo(() => {
    const found = searchWatcherLinks(links, query, sessionAccountId, subaccounts, origin);
    return applyWatcherFilter(found, watcherDraftToFilter(filter, Date.now()));
  }, [links, query, filter, sessionAccountId, subaccounts, origin]);
  const pageData = paginate(visible, page, PAGE_SIZE);

  // A narrower search or filter can shrink the result set, so jump back to page 1.
  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const applyFilter = (next: WatcherFilterDraft) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_WATCHER_DRAFT);
    setPage(1);
  };

  const hasData = !isLoading && !isError && links.length > 0;
  const filterActive = isWatcherDraftActive(filter);
  const hasQuery = query.trim().length > 0;
  const tableEmpty =
    visible.length > 0
      ? undefined
      : filterActive
        ? {
            title: 'No watcher links found',
            hint: 'Try adjusting your filters or clearing them to see more results.',
            clearLabel: 'Clear filters',
            onClear: resetFilter,
          }
        : hasQuery
          ? {
              title: 'No watcher links found',
              hint: 'Try a different search or clear it to see more results.',
              clearLabel: 'Clear search',
              onClear: () => changeQuery(''),
            }
          : undefined;

  const openCreate = () => setCreateOpen(true);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Watcher links</h2>
          <p className="mt-1 text-sm text-body-alt">
            Create and manage Watcher links to access your mining data from external applications.
          </p>
        </div>
        {hasData && (
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAggregateOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Aggregate watcher links
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              <LiAddCircle className="h-3.5 w-3.5" /> Create watcher link
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load Watcher links</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong reading your Watcher links.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : links.length === 0 ? (
        <div className="border-t border-border">
          <WatcherLinksEmptyState onCreate={openCreate} />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <WatcherLinksToolbar
            query={query}
            onQuery={changeQuery}
            filter={filter}
            sessionAccountId={sessionAccountId}
            subaccounts={subaccounts}
            onApplyFilter={applyFilter}
            onResetFilter={resetFilter}
          />
          <WatcherLinksTable
            links={pageData.items}
            sessionAccountId={sessionAccountId}
            subaccounts={subaccounts}
            origin={origin}
            onView={setViewing}
            empty={tableEmpty}
          />
          {visible.length > 0 && (
            <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
          )}
        </div>
      )}

      {createOpen && (
        <CreateWatcherLinkPanel
          sessionAccountId={sessionAccountId}
          subaccounts={subaccounts}
          origin={origin}
          onClose={() => setCreateOpen(false)}
          onCreate={(input) => create.mutateAsync(input)}
        />
      )}

      {viewing && (
        <WatcherLinkDetailsPanel
          link={viewing}
          sessionAccountId={sessionAccountId}
          subaccounts={subaccounts}
          origin={origin}
          onClose={() => setViewing(null)}
          // Revoking shrinks the list, so return to the first page; staying put can
          // leave the viewer on a page that no longer has any links on it.
          onRevoke={async (id) => {
            await revoke.mutateAsync(id);
            setPage(1);
          }}
        />
      )}

      {aggregateOpen && (
        <AggregateWatcherLinksPanel
          links={links}
          sessionAccountId={sessionAccountId}
          subaccounts={subaccounts}
          origin={origin}
          onClose={() => setAggregateOpen(false)}
        />
      )}
    </div>
  );
}
