import { useState } from 'react';
import { LiAltArrowLeft, LiAltArrowRight } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { monthInfo, clampRange, type DateRange } from '@/lib/payoutsTable';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A picked calendar day as its UTC-midnight unix seconds. */
function dayKey(year: number, month0: number, day: number): number {
  return Math.floor(Date.UTC(year, month0, day) / 1000);
}
function fmt(sec: number): string {
  const d = new Date(sec * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/**
 * A month calendar for picking a start/end date range. The first click sets the
 * start; the second sets the end (order is normalized). "Done" is enabled once a
 * range exists and reports it as inclusive unix-second bounds (start-of-day to
 * end-of-day). Purely presentational; no external date dependency.
 */
export function Calendar({ onCancel, onDone }: { onCancel: () => void; onDone: (range: DateRange) => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month0, setMonth0] = useState(today.getUTCMonth());
  const [startKey, setStartKey] = useState<number | null>(null);
  const [endKey, setEndKey] = useState<number | null>(null);

  const { daysInMonth, firstWeekdayMon } = monthInfo(year, month0);

  const step = (delta: number) => {
    const m = month0 + delta;
    if (m < 0) {
      setYear((y) => y - 1);
      setMonth0(11);
    } else if (m > 11) {
      setYear((y) => y + 1);
      setMonth0(0);
    } else {
      setMonth0(m);
    }
  };

  const clickDay = (day: number) => {
    const key = dayKey(year, month0, day);
    // First pick, or restart after a full range is chosen.
    if (startKey === null || endKey !== null) {
      setStartKey(key);
      setEndKey(null);
    } else {
      setEndKey(key);
    }
  };

  // Live range (normalized) for highlighting and the input displays.
  const range = startKey !== null && endKey !== null ? clampRange(startKey, endKey) : null;
  const inRange = (key: number) => (range ? key >= range.startSec && key <= range.endSec : key === startKey);

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekdayMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="w-[320px] rounded-2xl border border-border bg-popover p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="rounded-full p-1.5 text-body-alt hover:bg-muted hover:text-foreground">
          <LiAltArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-heading">
          {MONTHS[month0]} {year}
        </span>
        <button type="button" onClick={() => step(1)} aria-label="Next month" className="rounded-full p-1.5 text-body-alt hover:bg-muted hover:text-foreground">
          <LiAltArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-body-alt">
          {startKey !== null ? fmt(range ? range.startSec : startKey) : 'Enter start date'}
        </div>
        <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-body-alt">
          {range ? fmt(range.endSec) : 'Enter end date'}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-xs font-medium text-body-alt">
            {w}
          </span>
        ))}
        {cells.map((day, i) =>
          day === null ? (
            <span key={`b${i}`} />
          ) : (
            <button
              key={day}
              type="button"
              onClick={() => clickDay(day)}
              className={cn(
                'flex h-8 items-center justify-center rounded-full text-sm transition-colors',
                inRange(dayKey(year, month0, day))
                  ? 'bg-[hsl(var(--btn))] text-[hsl(var(--btn-foreground))]'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              {day}
            </button>
          ),
        )}
      </div>

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
          disabled={startKey === null}
          onClick={() => onDone(range ?? { startSec: startKey!, endSec: startKey! + 24 * 60 * 60 - 1 })}
          className="rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
