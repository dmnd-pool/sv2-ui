import { useState } from 'react';
import { LiSort, LiAltArrowDown, LiMagnifer } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { GeneratedBtcFilter, isGbtcDraftActive, type GbtcFilterDraft } from './GeneratedBtcFilter';

/**
 * Table header bar: the title, a search box, and the Filter popover trigger. Aggregated
 * mode (accounts non-empty) titles the section "Generated BTC" and adds the search box;
 * single-account mode keeps the merged "Rewards" title with no search, unchanged.
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
  const active = isGbtcDraftActive(filter);
  const aggregated = accounts.length > 0;

  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-base font-semibold text-heading">{aggregated ? 'Generated BTC' : 'Rewards'}</h3>

      <div className="flex items-center gap-3">
        {aggregated && (
          <div className="relative flex-1 sm:flex-none">
            <LiMagnifer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQuery?.(e.target.value)}
              // The design's copy names both "worker" and "subaccount", but a generated-BTC
              // entry is a per-day, per-account total with no worker field, so only the
              // account half of this placeholder is actually searchable.
              placeholder="Search by worker or subaccount"
              aria-label="Search generated BTC by subaccount"
              className="w-full rounded-2xl border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
            />
          </div>
        )}
        <div className="relative self-start sm:self-auto">
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
            <GeneratedBtcFilter
              applied={filter}
              accounts={accounts}
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
