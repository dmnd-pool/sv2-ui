import { useState } from 'react';
import { LiSort, LiAltArrowDown, LiMagnifer } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { GeneratedBtcFilter, isGbtcDraftActive, type GbtcFilterDraft } from './GeneratedBtcFilter';

/**
 * Table header bar: the title, a search box, and the Filter popover trigger. Mobile
 * collapses the search and the filter into two icon pills, as the frame draws them.
 *
 * The search is offered only when there is an account dimension to search (aggregated
 * mode). A generated-BTC row is a per-day, per-account total with no worker field on
 * any endpoint, so the drawn "by worker name" search cannot be backed; offering it in
 * single-account mode would be a control that can never match anything.
 */
export function GeneratedBtcToolbar({
  filter,
  onApplyFilter,
  onResetFilter,
  query = '',
  onQuery,
  accounts = [],
}: {
  filter: GbtcFilterDraft;
  onApplyFilter: (f: GbtcFilterDraft) => void;
  onResetFilter: () => void;
  query?: string;
  onQuery?: (q: string) => void;
  /** Account names offered by the Filter's Account facet; empty hides it AND the search box. */
  accounts?: string[];
}) {
  const [open, setOpen] = useState(false);
  // Mobile shows the search field only once its pill is tapped; the frame draws the
  // collapsed pill but no expanded state, so it opens below the title row.
  const [searchOpen, setSearchOpen] = useState(false);
  const active = isGbtcDraftActive(filter);
  const aggregated = accounts.length > 0;

  // Rendered once and placed by layout: two copies would mount two inputs carrying the
  // same accessible name, one of them invisible.
  const searchField = (
    <div className="relative flex-1 sm:flex-none">
      <LiMagnifer className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-body-alt" />
      <span aria-hidden className="pointer-events-none absolute left-[42px] top-1/2 h-6 w-px -translate-y-1/2 bg-border" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery?.(e.target.value)}
        // The design's copy names the worker, but a generated-BTC entry has no worker
        // field on any endpoint; only the account half is searchable.
        placeholder="Search by subaccount"
        aria-label="Search generated BTC by subaccount"
        className="h-10 w-full rounded-xl bg-muted py-2 pl-[54px] pr-4 text-sm leading-5 text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-[252px]"
      />
    </div>
  );

  const filterPopover = open && (
    <GeneratedBtcFilter
      applied={filter}
      accounts={accounts}
      onApply={onApplyFilter}
      onReset={onResetFilter}
      onClose={() => setOpen(false)}
    />
  );

  return (
    <div className="relative flex flex-col gap-3 rounded-t-3xl border-[0.5px] border-b-0 border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="!font-body text-lg font-bold leading-7 text-foreground">Generated BTC</h3>

        {/* Mobile collapses the search and the filter into two 32px icon pills. */}
        <div className="flex items-center gap-2 sm:hidden">
          {aggregated && (
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label="Search generated BTC"
              className="flex h-8 w-8 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary text-body-alt transition-opacity hover:opacity-80"
            >
              <LiMagnifer className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Filter generated BTC"
            className="relative flex h-8 w-8 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary text-foreground transition-opacity hover:opacity-80"
          >
            <LiSort className="h-4 w-4" />
            {active && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {aggregated && searchOpen && <div className="sm:hidden">{searchField}</div>}

      {/* One popover for both triggers, anchored to this toolbar. */}
      {filterPopover}

      <div className="hidden items-center gap-3 sm:flex">
        {aggregated && searchField}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80',
            active && 'font-medium',
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
      </div>
    </div>
  );
}
