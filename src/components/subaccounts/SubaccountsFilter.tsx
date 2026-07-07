import { useEffect, useRef, useState } from 'react';
import { LiStar, LiMinusCircle, LiSort } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import {
  EMPTY_SUBACCOUNT_FILTER,
  type SubaccountFilter,
  type SubaccountStatusFilter,
  type SubaccountRejectionFilter,
  type SubaccountSortOption,
} from '@/lib/subaccountsTable';

type Category = 'status' | 'rejection' | 'sortBy';

const STATUS_OPTIONS: { value: SubaccountStatusFilter; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'has_offline', label: 'Has offline workers' },
  { value: 'has_offline_24h', label: 'Has offline workers >24h' },
];
const REJECTION_OPTIONS: { value: SubaccountRejectionFilter; label: string }[] = [
  { value: 'lt1', label: 'Less than 1%' },
  { value: '1to3', label: '1% – 3%' },
  { value: 'gt3', label: 'Greater than 3%' },
];
// Sort options are shown as two columns (highest row, then lowest row).
const SORT_COL_1: { value: SubaccountSortOption; label: string }[] = [
  { value: 'hashrate_desc', label: 'Highest hashrate' },
  { value: 'hashrate_asc', label: 'Lowest hashrate' },
];
const SORT_COL_2: { value: SubaccountSortOption; label: string }[] = [
  { value: 'earnings_desc', label: 'Highest earnings' },
  { value: 'earnings_asc', label: 'Lowest earnings' },
];

// Category icons: Status=Star, Rejection rate=Minus Circle, Sort by=Sort.
const CATEGORIES: { key: Category; label: string; Icon: typeof LiStar }[] = [
  { key: 'status', label: 'Status', Icon: LiStar },
  { key: 'rejection', label: 'Rejection rate', Icon: LiMinusCircle },
  { key: 'sortBy', label: 'Sort by', Icon: LiSort },
];

/** One option row: a 16px radio (grey outline, filled when picked) + a 14px label. */
function Option({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className="flex h-5 items-center gap-2 text-left text-sm text-body-alt transition-colors hover:text-foreground"
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-[hsl(var(--btn))]' : 'border-placeholder',
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-[hsl(var(--btn))]" />}
      </span>
      <span className={cn('whitespace-nowrap', checked && 'text-foreground')}>{label}</span>
    </button>
  );
}

const Divider = () => <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />;

/**
 * The subaccounts Filter popover. A draft of the selection lives here; "Apply
 * filter(s)" commits it and closes, "Reset" clears the draft and the applied filter
 * (staying open). Closes on outside click or Escape. The buckets are design-derived
 * (see subaccountsTable).
 */
export function SubaccountsFilter({
  applied,
  onApply,
  onReset,
  onClose,
}: {
  applied: SubaccountFilter;
  onApply: (f: SubaccountFilter) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SubaccountFilter>(applied);
  const [category, setCategory] = useState<Category>('status');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Toggle a facet: clicking the selected option again clears it.
  const pick = <K extends keyof SubaccountFilter>(key: K, value: NonNullable<SubaccountFilter[K]>) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? null : value }));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter subaccounts"
      className="absolute right-0 top-full z-20 mt-2 w-[574px] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-popover px-4 pb-5 pt-4 shadow-xl sm:px-8 sm:pb-8"
    >
      {/* Header: title + Reset/Apply, then a full-width divider. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-heading">Filter subaccounts</p>
            <p className="mt-0.5 text-xs text-body-alt">Find by status or performance.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_SUBACCOUNT_FILTER);
                onReset();
              }}
              className="rounded-full border border-border px-5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-xs font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
            >
              Apply filter(s)
            </button>
          </div>
        </div>
        <div className="h-px w-full bg-border" aria-hidden />
      </div>

      {/* Body: rail | divider | option column(s). Tighter gaps on mobile so the
          single-column views fit; wide views (Sort by) scroll horizontally. */}
      <div className="mt-4 flex gap-4 overflow-x-auto sm:gap-6">
        <div className="flex w-[107px] shrink-0 flex-col gap-4">
          {CATEGORIES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                'flex items-center gap-1 text-left text-sm transition-colors',
                category === key
                  ? 'font-medium text-foreground underline underline-offset-4'
                  : 'text-body-alt hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        <Divider />

        {category === 'status' && (
          <div className="flex shrink-0 flex-col gap-3" role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map((o) => (
              <Option key={o.value} label={o.label} checked={draft.status === o.value} onClick={() => pick('status', o.value)} />
            ))}
          </div>
        )}

        {category === 'rejection' && (
          <div className="flex shrink-0 flex-col gap-3" role="radiogroup" aria-label="Rejection rate">
            {REJECTION_OPTIONS.map((o) => (
              <Option
                key={o.value}
                label={o.label}
                checked={draft.rejection === o.value}
                onClick={() => pick('rejection', o.value)}
              />
            ))}
          </div>
        )}

        {category === 'sortBy' && (
          <div className="flex shrink-0 gap-4 sm:gap-6" role="radiogroup" aria-label="Sort by">
            <div className="flex flex-col gap-3">
              {SORT_COL_1.map((o) => (
                <Option key={o.value} label={o.label} checked={draft.sortBy === o.value} onClick={() => pick('sortBy', o.value)} />
              ))}
            </div>
            <Divider />
            <div className="flex flex-col gap-3">
              {SORT_COL_2.map((o) => (
                <Option key={o.value} label={o.label} checked={draft.sortBy === o.value} onClick={() => pick('sortBy', o.value)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
