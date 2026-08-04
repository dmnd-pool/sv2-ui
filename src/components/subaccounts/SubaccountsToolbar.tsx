import { useState } from 'react';
import { LiMagnifer, LiSort } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { isSubaccountFilterActive, type SubaccountFilter } from '@/lib/subaccountsTable';
import { SubaccountsFilter } from './SubaccountsFilter';

/** Table header: section title, a name search box, and the filter popover trigger. */
export function SubaccountsToolbar({
  query,
  onQuery,
  filter,
  onApplyFilter,
  onResetFilter,
}: {
  query: string;
  onQuery: (q: string) => void;
  filter: SubaccountFilter;
  onApplyFilter: (f: SubaccountFilter) => void;
  onResetFilter: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Mobile collapses the search field into an icon; the field itself opens below the
  // row, since the frame draws the collapsed button but no expanded state.
  const [searchOpen, setSearchOpen] = useState(false);
  const active = isSubaccountFilterActive(filter);

  const searchField = (
    <div className="relative flex-1 sm:flex-none">
      <LiMagnifer className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground" />
      <span aria-hidden className="pointer-events-none absolute left-[42px] top-1/2 h-6 w-px -translate-y-1/2 bg-border" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search subaccount"
        aria-label="Search subaccounts"
        className="h-10 w-full rounded-xl bg-muted py-2 pl-[54px] pr-4 text-sm leading-5 text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-[252px]"
      />
    </div>
  );

  const filterPopover = open && (
    <SubaccountsFilter
      applied={filter}
      onApply={onApplyFilter}
      onReset={onResetFilter}
      onClose={() => setOpen(false)}
    />
  );

  return (
    <div className="relative flex flex-col gap-3 rounded-t-3xl border-[0.5px] border-b-0 border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="!font-body text-lg font-bold leading-7 text-foreground">Subaccounts</h3>

        {/* Mobile: the search field and the filter collapse to two 32px icon pills. */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-expanded={searchOpen}
            aria-label="Search subaccounts"
            className="flex h-8 w-8 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary text-foreground transition-opacity hover:opacity-80"
          >
            <LiMagnifer className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label="Filter subaccounts"
              className="flex h-8 w-8 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary text-foreground transition-opacity hover:opacity-80"
            >
              <LiSort className="h-4 w-4" />
              {active && (
                <span
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]"
                  aria-hidden
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {searchOpen && <div className="sm:hidden">{searchField}</div>}

      {/* One popover for both triggers: rendering it inside each branch would mount two
          dialogs at once, one of them display:none but still listening for Escape. */}
      {filterPopover}

      <div className="hidden items-center gap-2 sm:flex">
        {searchField}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-colors hover:opacity-80',
              active && 'font-medium',
            )}
          >
            <LiSort className="h-3.5 w-3.5" />
            Filter
            {active && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
