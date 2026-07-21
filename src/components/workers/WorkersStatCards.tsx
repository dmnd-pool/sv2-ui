import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';
import type { WorkersPageStats } from '@/lib/workersTable';

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      {children}
    </div>
  );
}

/** A 12-segment bar showing the active share of the roster (Active card viz). */
function ActivityBar({ active, total }: { active: number; total: number }) {
  const segments = 12;
  const filled = total > 0 ? Math.round((active / total) * segments) : 0;
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn('h-3.5 w-1 rounded-sm', i < filled ? 'bg-success' : 'bg-border')} />
      ))}
    </div>
  );
}

/** Total / Active / Offline / Rejection-rate cards above the workers table. */
export function WorkersStatCards({ stats }: { stats: WorkersPageStats }) {
  const rejection = stats.rejectionRate === null ? '--' : `${(stats.rejectionRate * 100).toFixed(1)}`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Total workers" hint="The total number of workers on this account.">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{stats.total}</p>
        <p className="mt-1 text-xs text-body-alt">Workers on this account</p>
      </Card>

      <Card title="Active workers" hint="Workers currently connected and submitting shares to the pool.">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{stats.active}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <ActivityBar active={stats.active} total={stats.total} />
          <span className="text-xs text-body-alt">
            {stats.active} active &middot; {stats.offline} offline
          </span>
        </div>
      </Card>

      <Card title="Offline">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{stats.offline}</p>
        <p className="mt-1 text-xs text-body-alt">
          {stats.offline24h > 0 ? `${stats.offline24h} offline for over 24h` : 'None offline over 24h'}
        </p>
      </Card>

      <Card title="Rejection rate" hint="The percentage of shares that were rejected and did not count toward Payouts.">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">
          {rejection}
          {stats.rejectionRate !== null && <span className="ml-1 text-base font-normal text-body-alt">%</span>}
        </p>
        <p className="mt-1 text-xs text-body-alt">Across all workers</p>
      </Card>
    </div>
  );
}
