import { useState } from 'react';
import { LiMagnifer, LiFilter } from 'solar-icon-react/li';
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
  const active = isSubaccountFilterActive(filter);

  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-sm font-semibold text-heading">Subaccounts</h3>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:flex-none">
          <LiMagnifer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search subaccount"
            aria-label="Search subaccounts"
            className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-foreground text-foreground' : 'border-border text-body-alt hover:text-foreground',
            )}
          >
            <LiFilter className="h-4 w-4" />
            Filter
            {active && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden />}
          </button>
          {open && (
            <SubaccountsFilter
              applied={filter}
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
