import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Check } from 'lucide-react';
import { LiCalendarMinimalistic, LiTuning, LiLayersMinimalistic } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { BitcoinCircleIcon } from '@/components/dashboard/icons/BitcoinCircleIcon';
import type { PayoutMode, PayoutDatePreset, AmountSort } from '@/lib/payoutsTable';
import { toggleAllCheckedSelection, isAllCheckedSelected } from '@/lib/multiSelect';

type Category = 'date' | 'mode' | 'amount' | 'account';

/** The Filter popover's draft selection (UI state; the page maps the date preset to a cutoff). */
export interface PayoutFilterDraft {
  datePreset: PayoutDatePreset | null;
  // Modes are checkboxes in the design (both drawn checked); empty keeps every mode.
  modes: PayoutMode[];
  amountSort: AmountSort | null;
  // Account names to keep, used only in aggregated mode; empty means every account.
  accounts: string[];
}

export const EMPTY_PAYOUT_FILTER_DRAFT: PayoutFilterDraft = {
  datePreset: null,
  modes: [],
  amountSort: null,
  accounts: [],
};

export function isPayoutDraftActive(d: PayoutFilterDraft): boolean {
  return d.datePreset !== null || d.modes.length > 0 || d.amountSort !== null || d.accounts.length > 0;
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
const ALL_MODES: PayoutMode[] = ['pplns', 'fpps'];
const AMOUNT_OPTIONS: { value: AmountSort; label: string }[] = [
  { value: 'highest', label: 'Highest first' },
  { value: 'lowest', label: 'Lowest first' },
];

const CATEGORIES: { key: Category; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'date', label: 'Date', Icon: LiCalendarMinimalistic },
  { key: 'mode', label: 'Mode', Icon: LiTuning },
  { key: 'amount', label: 'Amount', Icon: BitcoinCircleIcon },
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

const Divider = () => <div className="w-[0.5px] shrink-0 self-stretch bg-border" aria-hidden />;

/**
 * The payouts Filter popover with Date, Mode, and Amount categories. Draft-then-Apply:
 * "Apply filter(s)" commits the draft and closes; "Reset" clears the draft and the
 * applied filter. Closes on outside click or Escape.
 */
export function PayoutsFilter({
  applied,
  onApply,
  onReset,
  onClose,
  accounts = [],
}: {
  applied: PayoutFilterDraft;
  onApply: (f: PayoutFilterDraft) => void;
  onReset: () => void;
  onClose: () => void;
  /** Account names offered by the Account facet; empty hides the facet entirely. */
  accounts?: string[];
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

  // The facet renders every account checked by default (empty accounts = keep all, matching
  // the design); toggleAccountSelection handles seeding the full list and collapsing back.
  const toggleAccount = (name: string) =>
    setDraft((d) => ({ ...d, accounts: toggleAllCheckedSelection(d.accounts, name, accounts) }));

  // Mode uses the same all-checked-by-default convention as the account facet, so an
  // untouched popover filters nothing and unchecking one mode narrows to the other.
  const toggleMode = (value: PayoutMode) =>
    setDraft((d) => ({ ...d, modes: toggleAllCheckedSelection(d.modes, value, ALL_MODES) }));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter payouts"
      className={cn(
        'fixed inset-x-4 top-[300px] z-20 flex max-h-[calc(100dvh-316px)] flex-col gap-4 overflow-y-auto rounded-3xl border-[0.5px] border-border bg-card px-8 pb-8 pt-4',
        'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]',
        'sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:grid sm:max-h-none sm:w-[574px] sm:max-w-[calc(100vw-2rem)] sm:overflow-visible',
        'sm:grid-cols-[1fr_auto] sm:gap-x-4',
      )}
    >
      <div className="sm:col-start-1 sm:row-start-1">
        <p className="text-base font-bold leading-6 text-foreground">Filter payouts</p>
        <p className="text-sm leading-5 text-body-alt">
          {accounts.length > 0
            ? 'Find payouts by date, mode, subaccounts or amount.'
            : 'Find payouts by date, mode, or amount.'}
        </p>
      </div>

      {/* Mobile puts these in their own row at the foot of the panel, under a rule;
          sm+ returns them to the header row. One render, moved by grid placement. */}
      <div className="order-last flex shrink-0 items-center gap-2 border-t-[0.5px] border-border pt-4 sm:order-none sm:col-start-2 sm:row-start-1 sm:self-center sm:border-t-0 sm:pt-0">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_PAYOUT_FILTER_DRAFT);
              onReset();
            }}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80 sm:flex-none"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-5 text-sm leading-5 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 sm:flex-none"
          >
          Apply filter(s)
        </button>
      </div>

      <div className="flex gap-4 border-t-[0.5px] border-border pt-4 sm:col-span-2 sm:row-start-2 sm:gap-6">
        <div className="flex w-28 shrink-0 flex-col gap-4">
          {CATEGORIES.filter((c) => c.key !== 'account' || accounts.length > 0).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                'flex items-center gap-1 text-left text-sm leading-5 text-foreground transition-opacity',
                category === key ? 'underline underline-offset-4' : 'opacity-50 hover:opacity-80',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        <Divider />

        <div
          className="flex min-w-0 flex-1 flex-col gap-3"
          role={category === 'account' ? 'group' : 'radiogroup'}
          aria-label={category}
        >
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
              <CheckOption
                key={o.value}
                label={o.label}
                checked={draft.modes.length === 0 || draft.modes.includes(o.value)}
                onClick={() => toggleMode(o.value)}
              />
            ))}
          {category === 'amount' &&
            AMOUNT_OPTIONS.map((o) => (
              <Option
                key={o.value}
                label={o.label}
                checked={draft.amountSort === o.value}
                onClick={() => pick('amountSort', o.value)}
              />
            ))}
          {category === 'account' &&
            accounts.map((a) => (
              <CheckOption
                key={a}
                label={a}
                checked={isAllCheckedSelected(draft.accounts, a)}
                onClick={() => toggleAccount(a)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
