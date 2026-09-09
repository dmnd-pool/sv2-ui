import type { PplnsProjection, PplnsProjectionDailyWork } from '@/api/types';
import { formatBtcFromSats } from '@/lib/payoutsTable';

const HASHRATE_UNITS: [number, string][] = [
  [1e18, 'EH/s'],
  [1e15, 'PH/s'],
  [1e12, 'TH/s'],
  [1e9, 'GH/s'],
  [1e6, 'MH/s'],
  [1e3, 'KH/s'],
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function roundTo(digits: number, value: number): string {
  const factor = Math.pow(10, digits);
  return String(Math.round(value * factor) / factor);
}

function twoDigits(value: number): string {
  const rounded = String(Math.round(value * 100) / 100);
  if (!rounded.includes('.')) return rounded;
  const [whole, fraction] = rounded.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

/** Horizon zero is the current normalized next-block scenario. */
export function currentPplnsHorizon(projection: PplnsProjection | null | undefined) {
  return projection?.horizons[0];
}

/** Whether accepted work remains in the modeled payout window. */
export function hasPayablePplnsWork(projection: PplnsProjection | null | undefined): boolean {
  return (currentPplnsHorizon(projection)?.retained_difficulty ?? 0) > 0;
}

/** Grand total of the daily breakdown: every retained day's value, earned plus projected. */
export function totalDailyWorkNetSats(dailyWork: PplnsProjectionDailyWork[]): number {
  return dailyWork.reduce((sum, day) => sum + day.total_net_sats, 0);
}

export function formatPplnsDifficulty(difficulty: number): string {
  if (difficulty >= 1e18) return `${roundTo(3, difficulty / 1e18)} E`;
  if (difficulty >= 1e15) return `${roundTo(3, difficulty / 1e15)} P`;
  if (difficulty >= 1e12) return `${roundTo(3, difficulty / 1e12)} T`;
  if (difficulty >= 1e9) return `${roundTo(3, difficulty / 1e9)} G`;
  if (difficulty >= 1e6) return `${roundTo(3, difficulty / 1e6)} M`;
  if (difficulty >= 1e3) return `${roundTo(3, difficulty / 1e3)} k`;
  return roundTo(3, difficulty);
}

/** A day's retained difficulty expressed as the average hashrate that produced it. */
export function formatPplnsAverageHashrate(retainedDifficulty: number): string {
  const raw = (retainedDifficulty * 2 ** 32) / 86400;
  const [scale, unit] = HASHRATE_UNITS.find(([threshold]) => raw >= threshold) ?? [1, 'H/s'];
  return `${twoDigits(raw / scale)} ${unit}`;
}

/** Format a YYYY-MM-DD work day in the same long UTC form used by the canonical table. */
export function formatPplnsWorkDay(workDay: string): string {
  const iso = (workDay ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return workDay || '—';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return iso;
  return `${WEEKDAYS[date.getUTCDay()]} ${day} ${MONTHS[month - 1]} ${year}`;
}

export interface PplnsDailyWorkDateFilter {
  sinceMs: number | null;
  untilMs: number | null;
}

/** Keep daily-work rows within inclusive UTC day bounds. */
export function filterPplnsDailyWork(
  dailyWork: PplnsProjectionDailyWork[],
  filter: PplnsDailyWorkDateFilter,
): PplnsProjectionDailyWork[] {
  if (filter.sinceMs === null && filter.untilMs === null) return dailyWork;
  return dailyWork.filter((day) => {
    const dayMs = Date.parse(day.work_day);
    if (Number.isNaN(dayMs)) return false;
    return (filter.sinceMs === null || dayMs >= filter.sinceMs) &&
      (filter.untilMs === null || dayMs <= filter.untilMs);
  });
}

/** Search every value rendered in a daily-work row, using the same display formatters. */
export function searchPplnsDailyWork(
  dailyWork: PplnsProjectionDailyWork[],
  query: string,
): PplnsProjectionDailyWork[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return dailyWork;
  return dailyWork.filter((day) =>
    [
      day.work_day,
      formatPplnsWorkDay(day.work_day),
      formatPplnsDifficulty(day.retained_difficulty),
      formatPplnsAverageHashrate(day.retained_difficulty),
      formatBtcFromSats(day.total_net_sats),
    ].some((value) => value.toLowerCase().includes(needle)),
  );
}
