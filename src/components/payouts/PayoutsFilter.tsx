import { useEffect, useRef, useState } from 'react';
import { LiCalendarMinimalistic, LiTuning } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import type { PayoutMode, PayoutDatePreset } from '@/lib/payoutsTable';

type Category = 'date' | 'mode';

/** The Filter popover's draft selection (UI state; the page maps the date preset to a cutoff). */
export interface PayoutFilterDraft {
  datePreset: PayoutDatePreset | null;
  mode: PayoutMode | null;
}

export const EMPTY_PAYOUT_FILTER_DRAFT: PayoutFilterDraft = { datePreset: null, mode: null };

export function isPayoutDraftActive(d: PayoutFilterDraft): boolean {
  return d.datePreset !== null || d.mode !== null;
}

const DATE_OPTIONS: { value: PayoutDatePreset; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];
const MODE_OPTIONS: { value: PayoutMode; label: string }[] = [
  { value: 'pplns', label: 'PPLNS' },
  { value: 'fpps', label: 'FPPS' },
];

const CATEGORIES: { key: Category; label: string; Icon: typeof LiCalendarMinimalistic }[] = [
  { key: 'date', label: 'Date', Icon: LiCalendarMinimalistic },
  { key: 'mode', label: 'Mode', Icon: LiTuning },
];

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
 * The payouts Filter popover (Date + Mode; the Custom range and Amount sort are
 * deferred). Draft-then-Apply: "Apply filter(s)" commits and closes, "Reset" clears
 * the draft and the applied filter. Closes on outside click or Escape.
 */
export function PayoutsFilter({
  applied,
  onApply,
  onReset,
  onClose,
}: {
  applied: PayoutFilterDraft;
  onApply: (f: PayoutFilterDraft) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PayoutFilterDraft>(applied);
  const [category, setCategory] = useState<Category>('date');
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

  const pick = <K extends keyof PayoutFilterDraft>(key: K, value: NonNullable<PayoutFilterDraft[K]>) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? null : value }));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter payouts"
      className="absolute right-0 top-full z-20 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-popover px-4 pb-5 pt-4 shadow-xl sm:px-8 sm:pb-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">Filter payouts</p>
          <p className="mt-0.5 text-xs text-body-alt">Find payouts by date, mode, or amount.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_PAYOUT_FILTER_DRAFT);
              onReset();
            }}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="rounded-full bg-[hsl(var(--btn))] px-4 py-1.5 text-xs font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Apply filter(s)
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-4 border-t border-border pt-4 sm:gap-6">
        <div className="flex w-28 shrink-0 flex-col gap-4">
          {CATEGORIES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                'flex items-center gap-2 text-left text-sm transition-colors',
                category === key
                  ? 'font-medium text-foreground underline underline-offset-4'
                  : 'text-body-alt hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        <Divider />

        <div className="flex min-w-0 flex-1 flex-col gap-3" role="radiogroup" aria-label={category}>
          {category === 'date' &&
            DATE_OPTIONS.map((o) => (
              <Option
                key={o.value}
                label={o.label}
                checked={draft.datePreset === o.value}
                onClick={() => pick('datePreset', o.value)}
              />
            ))}
          {category === 'mode' &&
            MODE_OPTIONS.map((o) => (
              <Option key={o.value} label={o.label} checked={draft.mode === o.value} onClick={() => pick('mode', o.value)} />
            ))}
        </div>
      </div>
    </div>
  );
}
