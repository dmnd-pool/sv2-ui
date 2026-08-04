import { cn } from '@/lib/utils';
import { workerBarFill, WORKER_BAR_COUNT } from '@/lib/workerBars';

/**
 * The online-worker meter: a fixed strip of bars whose filled count is the share of
 * workers currently online, so a large fleet still reads at a glance.
 *
 * Shared by the home and workers pages. The fill rule lives in `workerBars` because it
 * carries the two clamps that matter on a status widget: one live rig never reads as an
 * empty strip, and one dead rig never reads as a full one.
 */
export function WorkerBars({ active, total, className }: { active: number; total: number; className?: string }) {
  const filled = workerBarFill(active, total);
  return (
    <span className={cn('flex gap-0.5', className)} role="presentation">
      {Array.from({ length: WORKER_BAR_COUNT }, (_, i) => (
        <span
          key={i}
          className={cn('h-3 w-1 rounded-[0.5px]', i < filled ? 'bg-success-text' : 'bg-secondary')}
        />
      ))}
    </span>
  );
}
