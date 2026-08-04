import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { exportPresetRange, type PayoutDatePreset, type DateRange } from '@/lib/payoutsTable';
import { CalendarSheet } from './CalendarSheet';

type ExportChoice = PayoutDatePreset | 'custom';

const PRESETS: { value: ExportChoice; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom' },
];

/** A preset row: a 16px radio and its label, which darkens once chosen. */
function Radio({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className="flex items-center gap-2 text-left text-sm leading-5 transition-opacity hover:opacity-80"
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-[hsl(var(--btn))]' : 'border-placeholder',
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-[hsl(var(--btn))]" />}
      </span>
      <span className={checked ? 'text-foreground' : 'text-body-alt'}>{label}</span>
    </button>
  );
}

/**
 * The export popover: pick a date range (a preset or a custom calendar range), then
 * export. Anchored under the Export CSV button; closes on outside click or Escape.
 * Reports the chosen range so the page builds the CSV. `title` names the data being
 * exported, so the workers page reuses this with its own heading.
 *
 * Choosing Custom opens the calendar as its own surface rather than growing this
 * panel: a floating popover on desktop and a bottom sheet on mobile, which is how the
 * frames draw it (the panel keeps its 328px height in every state).
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
      // The calendar renders outside this panel (portalled on mobile, floated on
      // desktop), so a click inside it must not read as "outside" and close us.
      if (showCalendar) return;
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
  }, [onCancel, showCalendar]);

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
    <>
      <div
        ref={ref}
        role="dialog"
        aria-label={title}
        className={cn(
          'absolute right-0 top-full z-20 mt-2 flex w-[396px] max-w-[calc(100vw-2rem)] flex-col gap-4',
          'rounded-3xl border-[0.5px] border-border bg-card px-8 py-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]',
        )}
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="!font-body text-lg font-bold leading-7 text-foreground">{title}</p>
            <p className="text-sm leading-5 text-body-alt">Choose a date range for the report.</p>
          </div>
          <div aria-hidden className="h-[0.5px] bg-border" />
        </div>

        <div className="flex flex-col gap-4" role="radiogroup" aria-label="Export date range">
          {PRESETS.map((p) => (
            <Radio key={p.value} label={p.label} checked={choice === p.value} onClick={() => select(p.value)} />
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div aria-hidden className="h-[0.5px] bg-border" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 flex-1 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-6 text-base leading-6 text-foreground transition-opacity hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canExport}
              onClick={doExport}
              className="h-11 flex-1 rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {showCalendar && (
        <CalendarSheet
          anchorClassName="right-[404px] top-full mt-2"
          onCancel={() => {
            setShowCalendar(false);
            setChoice(null);
          }}
          onDone={(range) => {
            setCustomRange(range);
            setShowCalendar(false);
          }}
        />
      )}
    </>
  );
}
