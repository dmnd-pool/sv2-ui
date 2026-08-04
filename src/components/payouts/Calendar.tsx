import { useState } from 'react';
import { LiAltArrowLeft, LiAltArrowRight } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import {
  monthInfo,
  clampRange,
  fullDayRange,
  formatCalendarDate,
  isRangeEndpoint,
  type DateRange,
} from '@/lib/payoutsTable';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** The two date readouts share one 40px, radius-16 field at the design's 12/16 type. */
const dateFieldClass = 'flex h-10 flex-1 items-center rounded-[16px] bg-muted px-4 py-2 text-xs leading-4 text-foreground';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A picked calendar day as its UTC-midnight unix seconds. */
function dayKey(year: number, month0: number, day: number): number {
  return Math.floor(Date.UTC(year, month0, day) / 1000);
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
  const isEndpoint = (key: number) => isRangeEndpoint(key, startKey, endKey);

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekdayMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div
      className={cn(
        // The design draws one component two ways: a 396px popover with 32px corners on
        // desktop, and a bottom-anchored full-bleed sheet with square corners on mobile.
        'flex flex-col gap-4 border-[0.5px] border-border bg-background p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]',
        'w-full rounded-none sm:w-[396px] sm:rounded-[32px]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="flex h-10 w-10 items-center justify-center rounded-[32px] bg-btn-secondary p-3 text-foreground transition-colors hover:opacity-80">
          <LiAltArrowLeft className="h-4 w-4" />
        </button>
        <span className="!font-body text-base font-semibold leading-6 text-heading-alt">
          {MONTHS[month0]} {year}
        </span>
        <button type="button" onClick={() => step(1)} aria-label="Next month" className="flex h-10 w-10 items-center justify-center rounded-[32px] bg-btn-secondary p-3 text-foreground transition-colors hover:opacity-80">
          <LiAltArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* The two date readouts: placeholder grey until a date is picked, then the
          picked date in the body colour, as the filled frame draws them. */}
      <div className="flex gap-2">
        <div className={cn(dateFieldClass, startKey === null && 'text-placeholder')}>
          {startKey !== null ? formatCalendarDate(range ? range.startSec : startKey) : 'Enter start date'}
        </div>
        <div className={cn(dateFieldClass, !range && 'text-placeholder')}>
          {range ? formatCalendarDate(range.endSec) : 'Enter end date'}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-x-0.5 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="flex aspect-square items-center justify-center text-sm font-medium leading-5 text-heading-alt">
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
                'flex aspect-square items-center justify-center rounded-full text-sm leading-5 transition-colors',
                isEndpoint(dayKey(year, month0, day))
                  ? 'bg-[#262626] text-on-solid'
                  : inRange(dayKey(year, month0, day))
                    ? 'bg-muted text-foreground'
                    : 'text-foreground hover:bg-muted',
              )}
            >
              {day}
            </button>
          ),
        )}
      </div>

      <div aria-hidden className="-mx-6 h-[0.5px] bg-border" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-6 py-2.5 text-base leading-6 text-foreground transition-colors hover:opacity-80"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={startKey === null}
          onClick={() => onDone(fullDayRange(startKey!, endKey ?? startKey!))}
          className="flex-1 rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 py-2.5 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
