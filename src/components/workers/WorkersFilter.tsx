import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { LiStar, LiTuning, LiMinusCircle } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import {
  EMPTY_WORKER_FILTER,
  STATUS_LABEL,
  type WorkerFilter,
  type WorkerStatus,
  type WorkerModeFilter,
  type WorkerRejectionFilter,
} from '@/lib/workersTable';

type Category = 'status' | 'mode' | 'rejection';

const STATUS_OPTIONS: WorkerStatus[] = ['online', 'offline', 'offline_24h'];
const MODE_OPTIONS: WorkerModeFilter[] = ['PPLNS', 'FPPS'];
const REJECTION_OPTIONS: { value: WorkerRejectionFilter; label: string }[] = [
  { value: 'lt1', label: 'Less than 1%' },
  { value: '1to3', label: '1% - 3%' },
  { value: 'gt3', label: 'Greater than 3%' },
];

// Facet-rail icons, matching the design: Status=Star, Mode=Tuning, Rejection rate=Minus Circle.
const CATEGORIES: { key: Category; label: string; Icon: typeof LiStar }[] = [
  { key: 'status', label: 'Status', Icon: LiStar },
  { key: 'mode', label: 'Mode', Icon: LiTuning },
  { key: 'rejection', label: 'Rejection rate', Icon: LiMinusCircle },
];

/** A multi-select option: an 18px square checkbox + a 14px label (Status, Mode). */
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
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-transparent bg-[hsl(var(--btn))]' : 'border-placeholder',
        )}
      >
        {checked && <Check className="h-3 w-3 text-[hsl(var(--btn-foreground))]" strokeWidth={3} />}
      </span>
      <span className={cn('whitespace-nowrap', checked && 'text-foreground')}>{label}</span>
    </button>
  );
}

/** A single-select option: a 16px radio + a 14px label (Rejection rate). */
function RadioOption({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className="flex items-center gap-2 text-left text-sm text-body-alt transition-colors hover:text-foreground"
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
 * The workers Filter popover. A draft of the selection lives here; "Apply filter(s)"
 * commits it and closes, "Reset" clears both the draft and the applied filter (staying
 * open). Status and Mode are multi-select checkboxes; Rejection rate is a single-select
 * radio. Closes on outside click or Escape. Buckets are design-derived (see workersTable).
 */
export function WorkersFilter({
  applied,
  onApply,
  onReset,
  onClose,
}: {
  applied: WorkerFilter;
  onApply: (f: WorkerFilter) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<WorkerFilter>(applied);
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

  // Multi-select toggle: add the value if absent, remove it if present.
  const toggle = <T,>(key: 'status' | 'mode', value: T) =>
    setDraft((d) => {
      const list = d[key] as T[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...d, [key]: next };
    });

  // Single-select toggle: clicking the chosen option again clears it.
  const pickRejection = (value: WorkerRejectionFilter) =>
    setDraft((d) => ({ ...d, rejection: d.rejection === value ? null : value }));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter workers"
      className="absolute right-0 top-full z-20 mt-2 w-[500px] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-popover px-4 pb-5 pt-4 shadow-xl sm:px-8 sm:pb-8"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-heading">Filter workers</p>
            <p className="mt-0.5 text-xs text-body-alt">Filter by status, mode, or rejection rate.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_WORKER_FILTER);
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

      <div className="mt-4 flex gap-4 overflow-x-auto sm:gap-6">
        <div className="flex w-[120px] shrink-0 flex-col gap-4">
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
          <div className="flex shrink-0 flex-col gap-3" role="group" aria-label="Status">
            {STATUS_OPTIONS.map((s) => (
              <CheckOption
                key={s}
                label={s === 'offline_24h' ? 'Offline for 24h+' : STATUS_LABEL[s]}
                checked={draft.status.includes(s)}
                onClick={() => toggle('status', s)}
              />
            ))}
          </div>
        )}

        {category === 'mode' && (
          <div className="flex shrink-0 flex-col gap-3" role="group" aria-label="Mode">
            {MODE_OPTIONS.map((m) => (
              <CheckOption key={m} label={m} checked={draft.mode.includes(m)} onClick={() => toggle('mode', m)} />
            ))}
          </div>
        )}

        {category === 'rejection' && (
          <div className="flex shrink-0 flex-col gap-3" role="radiogroup" aria-label="Rejection rate">
            {REJECTION_OPTIONS.map((o) => (
              <RadioOption
                key={o.value}
                label={o.label}
                checked={draft.rejection === o.value}
                onClick={() => pickRejection(o.value)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
