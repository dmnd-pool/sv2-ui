/**
 * Aggregated dashboard mode: a per-browser flag that switches the dashboard to sum
 * data across every subaccount. Persisted in localStorage alongside the other
 * dashboard preferences; the value is stored as the literal "true" so any stale or
 * unexpected value reads back as off rather than a broken state.
 */
export const AGG_STORAGE_KEY = 'dmnd.dashboard.aggregated';

/** Parse a stored value into the boolean flag; anything but "true" is off. */
export function readAggregated(raw: string | null): boolean {
  return raw === 'true';
}
