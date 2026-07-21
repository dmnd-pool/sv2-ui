import { useEffect, useRef, useState, type ComponentType } from 'react';
import { LiCalendarMinimalistic, LiSort, LiKeyMinimalistic, LiLayersMinimalistic } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/payouts/Calendar';
import type { DateRange } from '@/lib/payoutsTable';
import type { Subaccount, WatcherScope } from '@/api/types';
import {
  ALL_WATCHER_SCOPES,
  scopeLabel,
  watcherSinceForPreset,
  type WatcherDatePreset,
  type WatcherFilter,
  type WatcherSort,
} from '@/lib/watcherLinks';

type Category = 'scope' | 'date' | 'sort' | 'account';

/** The popover's draft selection; the page maps it to the applied filter. */
export interface WatcherFilterDraft {
  scope: WatcherScope | null;
  datePreset: WatcherDatePreset | null;
  customRange: DateRange | null;
  sort: WatcherSort;
  accountId: string | null;
}

export const EMPTY_WATCHER_DRAFT: WatcherFilterDraft = {
  scope: null,
  datePreset: null,
  customRange: null,
  sort: 'newest',
  accountId: null,
};

export function isWatcherDraftActive(d: WatcherFilterDraft): boolean {
  return d.scope !== null || d.datePreset !== null || d.customRange !== null || d.accountId !== null || d.sort !== 'newest';
}

/** Map the popover draft to the filter the list applies. */
export function watcherDraftToFilter(d: WatcherFilterDraft, nowMs: number): WatcherFilter {
  const sinceMs = d.customRange
    ? d.customRange.startSec * 1000
    : d.datePreset
      ? watcherSinceForPreset(d.datePreset, nowMs)
      : null;
  const untilMs = d.customRange ? d.customRange.endSec * 1000 : null;
  return { scope: d.scope, accountId: d.accountId, sinceMs, untilMs, sort: d.sort };
}

const DATE_OPTIONS: { value: WatcherDatePreset; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];
const SORT_OPTIONS: { value: WatcherSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

const CATEGORIES: { key: Category; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'scope', label: 'Scope', Icon: LiKeyMinimalistic },
  { key: 'date', label: 'Date', Icon: LiCalendarMinimalistic },
  { key: 'sort', label: 'Sort by', Icon: LiSort },
  { key: 'account', label: 'Account', Icon: LiLayersMinimalistic },
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
 * The watcher-links Filter popover: Scope, Date (presets or a custom range), Sort by,
 * and Account. Draft-then-Apply: "Apply filter(s)" commits and closes, "Reset" clears
 * both the draft and the applied filter. Closes on outside click or Escape.
 */
export function WatcherLinksFilter({
  applied,
  sessionAccountId,
  subaccounts,
  onApply,
  onReset,
  onClose,
}: {
  applied: WatcherFilterDraft;
  sessionAccountId: string | null;
  subaccounts: Subaccount[];
  onApply: (d: WatcherFilterDraft) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WatcherFilterDraft>(applied);
  const [category, setCategory] = useState<Category>('scope');
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

  const accounts = [
    ...(sessionAccountId !== null ? [{ id: sessionAccountId, label: 'Main account' }] : []),
    ...subaccounts.map((s) => ({ id: s.id, label: s.sub_account })),
  ];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter watcher links"
      className="absolute right-0 top-full z-20 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-popover px-4 pb-5 pt-4 shadow-xl sm:px-8 sm:pb-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">Filter watcher links</p>
          <p className="mt-0.5 text-xs text-body-alt">Find by account, scope, or date.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_WATCHER_DRAFT);
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
              setDraft((d) => ({ ...d, customRange: range, datePreset: null }));
              setShowCalendar(false);
            }}
          />
        </div>
      ) : (
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
            {category === 'scope' &&
              ALL_WATCHER_SCOPES.map((s) => (
                <Option
                  key={s}
                  label={scopeLabel(s)}
                  checked={draft.scope === s}
                  onClick={() => setDraft((d) => ({ ...d, scope: d.scope === s ? null : s }))}
                />
              ))}
            {category === 'date' && (
              <>
                {DATE_OPTIONS.map((o) => (
                  <Option
                    key={o.value}
                    label={o.label}
                    checked={draft.datePreset === o.value}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        datePreset: d.datePreset === o.value ? null : o.value,
                        customRange: null,
                      }))
                    }
                  />
                ))}
                <Option label="Custom" checked={draft.customRange !== null} onClick={() => setShowCalendar(true)} />
              </>
            )}
            {category === 'sort' &&
              SORT_OPTIONS.map((o) => (
                <Option
                  key={o.value}
                  label={o.label}
                  checked={draft.sort === o.value}
                  onClick={() => setDraft((d) => ({ ...d, sort: o.value }))}
                />
              ))}
            {category === 'account' &&
              accounts.map((a) => (
                <Option
                  key={a.id}
                  label={a.label}
                  checked={draft.accountId === a.id}
                  onClick={() => setDraft((d) => ({ ...d, accountId: d.accountId === a.id ? null : a.id }))}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
