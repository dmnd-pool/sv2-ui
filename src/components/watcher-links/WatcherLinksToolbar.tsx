import { useState } from 'react';
import { LiMagnifer, LiSort, LiAltArrowDown } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import type { Subaccount } from '@/api/types';
import { WatcherLinksFilter, isWatcherDraftActive, type WatcherFilterDraft } from './WatcherLinksFilter';

/** Table header bar: the "Watcher links" title, the search box, and the Filter popover. */
export function WatcherLinksToolbar({
  query,
  onQuery,
  filter,
  sessionAccountId,
  subaccounts,
  onApplyFilter,
  onResetFilter,
}: {
  query: string;
  onQuery: (q: string) => void;
  filter: WatcherFilterDraft;
  sessionAccountId: string | null;
  subaccounts: Subaccount[];
  onApplyFilter: (f: WatcherFilterDraft) => void;
  onResetFilter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = isWatcherDraftActive(filter);

  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-base font-semibold text-heading">Watcher links</h3>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 sm:flex-none">
          <LiMagnifer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search watcher links"
            aria-label="Search watcher links"
            className="w-full rounded-2xl border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-colors',
              active ? 'border-foreground text-foreground' : 'border-border text-body-alt hover:text-foreground',
            )}
          >
            <LiSort className="h-3.5 w-3.5" />
            Filter
            {active ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden />
            ) : (
              <LiAltArrowDown className="h-3.5 w-3.5" />
            )}
          </button>
          {open && (
            <WatcherLinksFilter
              applied={filter}
              sessionAccountId={sessionAccountId}
              subaccounts={subaccounts}
              onApply={onApplyFilter}
              onReset={onResetFilter}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
