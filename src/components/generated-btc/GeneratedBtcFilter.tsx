import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/payouts/Calendar';
import type { DateRange } from '@/lib/payoutsTable';
import { sinceMsForPreset, type GbtcDatePreset, type GeneratedBtcFilter } from '@/lib/generatedBtcTable';

/** The Filter popover's draft: a date preset, or a custom picked range (mutually exclusive). */
export interface GbtcFilterDraft {
  datePreset: GbtcDatePreset | null;
  customRange: DateRange | null;
}

export const EMPTY_GBTC_FILTER_DRAFT: GbtcFilterDraft = { datePreset: null, customRange: null };

export function isGbtcDraftActive(d: GbtcFilterDraft): boolean {
  return d.datePreset !== null || d.customRange !== null;
}

/** Map the popover draft to the day-aligned since/until bounds the table filter uses. */
export function gbtcDraftToFilter(d: GbtcFilterDraft, nowMs: number): GeneratedBtcFilter {
  if (d.datePreset) return { sinceMs: sinceMsForPreset(d.datePreset, nowMs), untilMs: null };
  if (d.customRange) return { sinceMs: d.customRange.startSec * 1000, untilMs: d.customRange.endSec * 1000 };
  return { sinceMs: null, untilMs: null };
}

const DATE_OPTIONS: { value: GbtcDatePreset; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
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

/**
 * The generated-BTC Filter popover: a single Date category (24h / 7d / 30d / Custom).
 * Choosing Custom opens the month Calendar to pick a range. Draft-then-Apply: "Apply
 * filter(s)" commits and closes; "Reset" clears. Closes on outside click or Escape.
 * (Mode is intentionally not offered: the endpoint carries no per-day payout mode.)
 */
export function GeneratedBtcFilter({
  applied,
  onApply,
  onReset,
  onClose,
}: {
  applied: GbtcFilterDraft;
  onApply: (f: GbtcFilterDraft) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<GbtcFilterDraft>(applied);
  const [showCalendar, setShowCalendar] = useState(false);
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

  const pickPreset = (value: GbtcDatePreset) => {
    setShowCalendar(false);
    setDraft((d) => (d.datePreset === value ? EMPTY_GBTC_FILTER_DRAFT : { datePreset: value, customRange: null }));
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter generated BTC"
      className="absolute right-0 top-full z-20 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-popover px-4 pb-5 pt-4 shadow-xl sm:px-6 sm:pb-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">Filter generated BTC</p>
          <p className="mt-0.5 text-xs text-body-alt">Find generated BTC by date.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_GBTC_FILTER_DRAFT);
              setShowCalendar(false);
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

      {showCalendar ? (
        <div className="mt-4 border-t border-border pt-4">
          <Calendar
            onCancel={() => setShowCalendar(false)}
            onDone={(range) => {
              setDraft({ datePreset: null, customRange: range });
              setShowCalendar(false);
            }}
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4" role="radiogroup" aria-label="Date">
          {DATE_OPTIONS.map((o) => (
            <Option key={o.value} label={o.label} checked={draft.datePreset === o.value} onClick={() => pickPreset(o.value)} />
          ))}
          <Option label="Custom" checked={draft.customRange !== null} onClick={() => setShowCalendar(true)} />
        </div>
      )}
    </div>
  );
}
