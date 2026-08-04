/**
 * The aggregated Active-workers strip: a fixed row of bars where the filled count is
 * the proportion of workers currently online. The design annotates it as a ratio
 * rather than one bar per worker, so a large fleet still reads at a glance.
 */

export const WORKER_BAR_COUNT = 10;

/**
 * How many bars to fill for `active` of `total` workers.
 *
 * The two clamps matter on a money-adjacent status widget: a fleet with one live rig
 * must never read as an empty strip, and a fleet with one dead rig must never read as
 * a full one. Only a genuine zero shows empty and only a genuine all-online shows full.
 */
export function workerBarFill(active: number, total: number): number {
  if (!Number.isFinite(active) || !Number.isFinite(total)) return 0;
  if (total <= 0 || active <= 0) return 0;
  if (active >= total) return WORKER_BAR_COUNT;
  const exact = (active / total) * WORKER_BAR_COUNT;
  return Math.min(WORKER_BAR_COUNT - 1, Math.max(1, Math.round(exact)));
}
