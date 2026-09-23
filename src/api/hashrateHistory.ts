import type { HashratePoint } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Freeze and walk inclusive server windows, deduplicating their shared boundary. */
export async function fetchHashrateHistory(
  from: string,
  to: string,
  fetchWindow: (from: string, to: string) => Promise<HashratePoint[]>,
): Promise<HashratePoint[]> {
  const start = Date.parse(from);
  const end = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59Z` : to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('Invalid hashrate history range');
  }
  // Preserve the requested format for a single window, including date-only bounds.
  if (end - start <= WEEK_MS) return fetchWindow(from, to);
  const points = new Map<number, HashratePoint>();
  for (let cursor = start; cursor < end; cursor += WEEK_MS) {
    const rows = await fetchWindow(
      new Date(cursor).toISOString(),
      new Date(Math.min(cursor + WEEK_MS, end)).toISOString(),
    );
    for (const point of rows) points.set(Date.parse(point.observed_at), point);
  }
  return [...points.entries()].sort(([a], [b]) => a - b).map(([, point]) => point);
}
