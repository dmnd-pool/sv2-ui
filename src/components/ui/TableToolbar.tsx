import { useState, type ReactNode } from 'react';
import { LiMagnifer, LiSort, LiAltArrowDown, LiFilter } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';

/** Shared search/filter layout. The surrounding page supplies the visible heading. */
export function TableToolbar({
  title,
  query,
  onQuery,
  searchPlaceholder,
  searchLabel = searchPlaceholder,
  filterActive,
  renderFilter,
  tabs,
  actions,
  variant = 'plain',
}: {
  title: string;
  query: string;
  onQuery: (query: string) => void;
  searchPlaceholder: string;
  searchLabel?: string;
  filterActive: boolean;
  renderFilter: (onClose: () => void) => ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
  variant?: 'plain' | 'framed' | 'tabs';
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const plain = variant === 'plain';
  const framed = variant === 'framed';
  const FilterIcon = variant === 'tabs' ? LiFilter : LiSort;
  const panel = filterOpen ? renderFilter(() => setFilterOpen(false)) : null;

  return (
    <div aria-label={title} className={cn(
      'relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
      variant === 'tabs' ? 'p-4' : 'p-3 sm:p-4',
      !plain && 'rounded-t-3xl border-[0.5px] border-b-0 border-border bg-card',
    )}>
      <div className={cn('flex w-full gap-3 sm:justify-end', variant === 'tabs' ? 'flex-col sm:flex-row sm:items-center' : 'items-center', actions && 'flex-wrap')}>
        {tabs}
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <LiMagnifer className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2', plain ? 'left-3 h-4 w-4 text-placeholder' : 'left-4 h-3.5 w-3.5 text-body-alt')} />
          {!plain && <span aria-hidden className="pointer-events-none absolute left-[42px] top-1/2 h-6 w-px -translate-y-1/2 bg-border" />}
          <input
            type="text"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className={cn(
              'w-full bg-muted py-2 text-sm text-foreground placeholder:text-placeholder focus:outline-none focus:ring-1 focus:ring-ring',
              plain ? 'rounded-2xl border border-border pl-9 pr-3 sm:w-64' : 'h-10 rounded-xl pl-[54px] pr-4 leading-5 sm:w-[252px]',
            )}
          />
        </div>
        <div className={framed ? undefined : 'relative'}>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex shrink-0 items-center transition-opacity hover:opacity-80',
              framed ? 'h-9 gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground' :
                variant === 'tabs' ? 'gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium' : 'gap-2 rounded-full border px-5 py-2 text-sm font-medium',
              !framed && (filterActive ? 'border-foreground text-foreground' : 'border-border text-body-alt hover:text-foreground'),
              framed && filterActive && 'font-medium',
            )}
          >
            <FilterIcon className={variant === 'tabs' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            Filter
            {filterActive ? <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--btn))]" aria-hidden /> :
              variant !== 'tabs' && <LiAltArrowDown className="h-3.5 w-3.5" />}
          </button>
          {!framed && panel}
        </div>
        {actions && <div className="flex w-full justify-end sm:w-auto">{actions}</div>}
      </div>
      {framed && panel}
    </div>
  );
}

/** Actions apply to the checked rows in the filtered table, across every page. */
export function SelectionActions({ count, onExport, onClear, children }: {
  count: number;
  onExport: () => void;
  onClear: () => void;
  children?: ReactNode;
}) {
  if (!count) return null;
  return <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
    <span className="text-sm text-body-alt" role="status">{count} selected</span>
    <button type="button" onClick={onExport} className="rounded-full bg-info px-4 py-1.5 text-sm text-info-foreground transition-opacity hover:opacity-90">Export selected CSV</button>
    {children}
    <button type="button" onClick={onClear} className="ml-auto text-sm text-body-alt underline underline-offset-2 hover:text-foreground">Clear selection</button>
  </div>;
}
