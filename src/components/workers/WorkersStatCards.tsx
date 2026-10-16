import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { Reading } from '@/components/ui/Reading';
import { WorkerBars } from '@/components/ui/WorkerBars';
import { cn } from '@/lib/utils';
import type { WorkersPageStats } from '@/lib/workersTable';
import {
  ACTIVE_WORKERS_HINT,
  OFFLINE_WORKER_HINT,
  WORKER_REJECTION_HINT,
  WORKER_ROSTER_HINT,
} from '@/lib/metricWindows';

/**
 * A stat card. Same shell and type ramp as the home cards, so the two pages cannot
 * drift apart: the reading is a numeral in the heading face with its unit trailing at
 * body size, and the caption sits at body size below it.
 */
function Card({
  title,
  hint,
  children,
  caption,
  captionTone = 'muted',
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  caption: ReactNode;
  captionTone?: 'muted' | 'strong';
}) {
  return (
    <div className="flex flex-col justify-between gap-2 border-[0.5px] border-border bg-card p-4 lg:p-5">
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      {children}
      <div className={cn('text-sm leading-5', captionTone === 'strong' ? 'text-foreground' : 'text-body-alt')}>
        {caption}
      </div>
    </div>
  );
}

/** Total / Active / Offline / Rejection-rate cards above the workers table. */
export function WorkersStatCards({ stats }: { stats: WorkersPageStats }) {
  const hasWorkers = stats.total > 0;
  const rated = stats.rejectionRate !== null;
  const rejection = rated ? (stats.rejectionRate! * 100).toFixed(1) : '--';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Total workers" hint={WORKER_ROSTER_HINT} caption="Seen during the last 24 hours">
        <Reading value={stats.total} />
      </Card>

      <Card
        title="Active workers"
        hint={ACTIVE_WORKERS_HINT}
        captionTone={hasWorkers ? 'strong' : 'muted'}
        caption={
          <span className="flex flex-col gap-2">
            {hasWorkers && <WorkerBars active={stats.active} total={stats.total} />}
            <span>
              {stats.active} active &middot; {stats.offline} offline
            </span>
          </span>
        }
      >
        <Reading value={stats.active} />
      </Card>

      <Card
        title="Offline"
        hint={OFFLINE_WORKER_HINT}
        captionTone={hasWorkers ? 'strong' : 'muted'}
        caption={stats.offline > 0 ? 'Inactive in the last 10 minutes' : 'All workers are active'}
      >
        <Reading value={stats.offline} />
      </Card>

      <Card
        title="Rejection rate"
        hint={WORKER_REJECTION_HINT}
        captionTone={rated ? 'strong' : 'muted'}
        caption="Last 10 minutes across all workers"
      >
        <Reading value={rejection} unit={rated ? '%' : undefined} />
      </Card>
    </div>
  );
}
