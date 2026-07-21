import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { exportPresetRange, type PayoutDatePreset, type DateRange } from '@/lib/payoutsTable';
import { Calendar } from './Calendar';

type ExportChoice = PayoutDatePreset | 'custom';

const PRESETS: { value: ExportChoice; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom' },
];

function Radio({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className="flex items-center gap-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:text-body-alt"
    >
      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', checked ? 'border-[hsl(var(--btn))]' : 'border-placeholder')}>
        {checked && <span className="h-2 w-2 rounded-full bg-[hsl(var(--btn))]" />}
      </span>
      {label}
    </button>
  );
}

/**
 * The export popover: pick a date range (a preset or a custom calendar range), then
 * export. Anchored under the Export CSV button; closes on outside click or Escape.
 * Reports the chosen range so the page builds the CSV. `title` names the data being
 * exported, so the workers page reuses this with its own heading.
 */
export function PayoutsExportModal({
  title = 'Export payouts data',
  onCancel,
  onExport,
}: {
  title?: string;
  onCancel: () => void;
  onExport: (range: DateRange) => void;
}) {
  const [choice, setChoice] = useState<ExportChoice | null>(null);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  const select = (value: ExportChoice) => {
    setChoice(value);
    setShowCalendar(value === 'custom');
    if (value !== 'custom') setCustomRange(null);
  };

  const canExport = choice !== null && (choice !== 'custom' || customRange !== null);

  const doExport = () => {
    if (choice === null) return;
    const range = choice === 'custom' ? customRange : exportPresetRange(choice, Date.now());
    if (range) onExport(range);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      className="absolute right-0 top-full z-20 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-popover p-5 shadow-xl"
    >
      <p className="text-sm font-semibold text-heading">{title}</p>
      <p className="mt-0.5 text-xs text-body-alt">Choose a date range for the report.</p>

      <div className="mt-3 flex flex-col" role="radiogroup" aria-label="Export date range">
        {PRESETS.map((p) => (
          <Radio key={p.value} label={p.label} checked={choice === p.value} onClick={() => select(p.value)} />
        ))}
      </div>

      {showCalendar && (
        <div className="mt-3">
          <Calendar
            onCancel={() => {
              setShowCalendar(false);
              setChoice(null);
            }}
            onDone={(range) => {
              setCustomRange(range);
              setShowCalendar(false);
            }}
          />
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canExport}
          onClick={doExport}
          className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
