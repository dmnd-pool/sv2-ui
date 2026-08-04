/**
 * Axis helpers for the Mining Performance chart.
 *
 * The design prints the hashrate unit ONCE as a label above the plot and then
 * renders bare numbers on the y axis, so the whole axis has to share a single
 * unit chosen from the largest sample rather than formatting each tick on its own.
 * Times render in UTC because the design labels them that way ("Today · 06:32 UTC"),
 * which also keeps a miner's reading unambiguous across timezones.
 */

const UNITS = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'] as const;

export interface HashrateScale {
  unit: string;
  divisor: number;
}

/** One unit for the entire axis, taken from the largest non-null sample. */
export function pickHashrateScale(values: (number | null | undefined)[]): HashrateScale {
  let max = 0;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > max) max = v;
  }
  if (max <= 0) return { unit: UNITS[0], divisor: 1 };
  const step = Math.floor(Math.log(max) / Math.log(1000));
  const index = Math.min(Math.max(step, 0), UNITS.length - 1);
  return { unit: UNITS[index], divisor: Math.pow(1000, index) };
}

/** A tick as a bare number in the axis unit; the unit is shown separately. */
export function formatAxisValue(value: number, divisor: number): string {
  if (!Number.isFinite(value)) return '';
  return (value / divisor).toFixed(1).replace(/\.0$/, '');
}

/**
 * Four evenly spaced y ticks over a rounded-up domain. The design labels exactly four
 * gridlines and never labels zero, so the domain top is derived from a rounded quarter
 * step rather than from the raw maximum.
 */
export function yAxisTicks(max: number): { domainMax: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { domainMax: 1, ticks: [] };
  const quarter = max / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(quarter)));
  const step = Math.ceil(quarter / magnitude) * magnitude;
  return { domainMax: step * 4, ticks: [1, 2, 3, 4].map((n) => step * n) };
}

/**
 * The tooltip's timestamp line. Reads "Today" for a sample from the current UTC day and
 * the date otherwise, so a point in a historical window is never mislabelled as today.
 */
export function tooltipTimestamp(value: string, nowMs: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  const sameDay = date.toISOString().slice(0, 10) === new Date(nowMs).toISOString().slice(0, 10);
  const day = sameDay ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${day}  ·  ${time} UTC`;
}

export interface TickContext {
  /** A custom span reads as dates; the short presets read as times. */
  isCustom: boolean;
  /** True only when the window actually runs up to the present moment. */
  endsNow: boolean;
}

/**
 * The design labels the right-most tick "Now". That is only honest when the window
 * ends at the present, so a historical custom range keeps its real timestamp.
 */
export function xAxisTickLabel(value: string, index: number, lastIndex: number, ctx: TickContext): string {
  if (index === lastIndex && ctx.endsNow) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return ctx.isCustom
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
}
