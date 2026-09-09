import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Check } from 'lucide-react';
import { LiCalendarMinimalistic, LiLayersMinimalistic } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/payouts/Calendar';
import type { DateRange } from '@/lib/payoutsTable';
import { sinceMsForPreset, type GbtcDatePreset, type GeneratedBtcFilter } from '@/lib/generatedBtcTable';
import { toggleAllCheckedSelection, isAllCheckedSelected } from '@/lib/multiSelect';

type Category = 'date' | 'account';

/** The Filter popover's draft: a date preset, or a custom picked range (mutually exclusive). */
export interface GbtcFilterDraft {
  datePreset: GbtcDatePreset | null;
  customRange: DateRange | null;
  // Account names to keep, used only in aggregated mode; empty means every account.
  accounts: string[];
}

export const EMPTY_GBTC_FILTER_DRAFT: GbtcFilterDraft = { datePreset: null, customRange: null, accounts: [] };

export function isGbtcDraftActive(d: GbtcFilterDraft): boolean {
  return d.datePreset !== null || d.customRange !== null || d.accounts.length > 0;
}

const CATEGORIES: { key: Category; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'date', label: 'Date', Icon: LiCalendarMinimalistic },
  { key: 'account', label: 'Account', Icon: LiLayersMinimalistic },
];

/** A multi-select option (square checkbox) for the Account facet. */
function CheckOption({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className="flex items-center gap-2 text-left text-sm text-body-alt transition-colors hover:text-foreground"
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-transparent bg-[hsl(var(--btn))]' : 'border-placeholder',
        )}
      >
        {checked && <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />}
      </span>
      <span className={cn('whitespace-nowrap', checked && 'text-foreground')}>{label}</span>
    </button>
  );
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
  accounts = [],
  copy,
}: {
  applied: GbtcFilterDraft;
  onApply: (f: GbtcFilterDraft) => void;
  onReset: () => void;
  onClose: () => void;
  /** Account names offered by the Account facet; empty hides the facet AND the rail. */
  accounts?: string[];
  /** Optional wording when the date filter is reused for another daily data table. */
  copy?: { title: string; description: string; ariaLabel: string };
}) {
  const [draft, setDraft] = useState<GbtcFilterDraft>(applied);
  const [showCalendar, setShowCalendar] = useState(false);
  const [category, setCategory] = useState<Category>('date');
  const ref = useRef<HTMLDivElement>(null);
  const hasAccounts = accounts.length > 0;
  const title = copy?.title ?? 'Filter generated BTC';
  const description =
    copy?.description ??
    (hasAccounts ? 'Find generated BTC by date or subaccount.' : 'Find generated BTC by date.');

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

  // Picking a date clears any custom range (mutually exclusive) but leaves the Account
  // selection untouched — the two facets narrow independently.
  const pickPreset = (value: GbtcDatePreset) => {
    setShowCalendar(false);
    setDraft((d) => ({
      ...d,
      datePreset: d.datePreset === value ? null : value,
      customRange: null,
    }));
  };

  const toggleAccount = (name: string) =>
    setDraft((d) => ({ ...d, accounts: toggleAllCheckedSelection(d.accounts, name, accounts) }));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={copy?.ariaLabel ?? 'Filter generated BTC'}
      className="absolute right-0 top-full z-20 mt-4 w-[574px] max-w-[calc(100vw-2rem)] rounded-3xl border-[0.5px] border-border bg-card px-8 pb-8 pt-4 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold leading-6 text-foreground">{title}</p>
          <p className="text-sm leading-5 text-body-alt">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_GBTC_FILTER_DRAFT);
              setShowCalendar(false);
              onReset();
            }}
            className="inline-flex h-9 items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="inline-flex h-9 items-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-5 text-sm leading-5 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
          >
            Apply filter(s)
          </button>
        </div>
      </div>

      {hasAccounts ? (
        <div className="mt-4 flex gap-6 border-t-[0.5px] border-border pt-4">
          <div className="flex w-24 shrink-0 flex-col gap-4">
            {CATEGORIES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  'flex items-center gap-1 text-left text-sm leading-5 text-foreground transition-opacity',
                  category === key ? 'underline underline-offset-4' : 'opacity-50 hover:opacity-80',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>

          <div className="w-[0.5px] shrink-0 self-stretch bg-border" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {category === 'date' &&
              (showCalendar ? (
                <Calendar
                  onCancel={() => setShowCalendar(false)}
                  onDone={(range) => {
                    setDraft((d) => ({ ...d, datePreset: null, customRange: range }));
                    setShowCalendar(false);
                  }}
                />
              ) : (
                <div role="radiogroup" aria-label="Date" className="flex flex-col gap-3">
                  {DATE_OPTIONS.map((o) => (
                    <Option
                      key={o.value}
                      label={o.label}
                      checked={draft.datePreset === o.value}
                      onClick={() => pickPreset(o.value)}
                    />
                  ))}
                  <Option label="Custom" checked={draft.customRange !== null} onClick={() => setShowCalendar(true)} />
                </div>
              ))}
            {category === 'account' && (
              <div role="group" aria-label="Account" className="flex flex-col gap-3">
                {accounts.map((a) => (
                  <CheckOption
                    key={a}
                    label={a}
                    checked={isAllCheckedSelected(draft.accounts, a)}
                    onClick={() => toggleAccount(a)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : showCalendar ? (
        <div className="mt-4 border-t border-border pt-4">
          <Calendar
            onCancel={() => setShowCalendar(false)}
            onDone={(range) => {
              setDraft((d) => ({ ...d, datePreset: null, customRange: range }));
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
