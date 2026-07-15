import { useState } from 'react';
import { LiSort, LiAltArrowDown } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { GeneratedBtcFilter, isGbtcDraftActive, type GbtcFilterDraft } from './GeneratedBtcFilter';

/** Table header bar: the "Rewards" title and the Filter popover trigger. */
export function GeneratedBtcToolbar({
  filter,
  onApplyFilter,
  onResetFilter,
}: {
  filter: GbtcFilterDraft;
  onApplyFilter: (f: GbtcFilterDraft) => void;
  onResetFilter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = isGbtcDraftActive(filter);

  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-base font-semibold text-heading">Rewards</h3>

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
            onApply={onApplyFilter}
            onReset={onResetFilter}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
