import type { ReactNode } from 'react';
import { LiInfoCircle } from 'solar-icon-react/li';
import { useAccountWorkers } from '@/hooks/useAccountData';
import { deriveWorkerStats } from '@/lib/workerStats';

function StatCard({ title, value, caption, hint }: { title: string; value: ReactNode; caption: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-body-alt">{title}</span>
        {hint && <LiInfoCircle className="h-3.5 w-3.5 text-placeholder" aria-label={hint} />}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-heading">{value}</p>
      <p className="mt-1 text-xs text-body-alt">{caption}</p>
    </div>
  );
}

/**
 * Active / Offline / Rejection / Today's earnings cards, derived from the worker
 * roster. Today's earnings has no source in this PR's cloud data layer yet, so it
 * shows the zero baseline; only Active and Rejection carry an info tooltip.
 */
export function WorkerStatCards({ from, to }: { from: string; to: string }) {
  const { data } = useAccountWorkers(from, to);
  const stats = deriveWorkerStats(data?.workers ?? []);
  const rejection = stats.rejectionRate === null ? '--' : `${(stats.rejectionRate * 100).toFixed(2)}%`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active workers"
        value={`${stats.activeCount}/${stats.totalCount}`}
        caption="Connected workers will appear here."
        hint="Workers currently connected, out of your total roster."
      />
      <StatCard
        title="Offline workers"
        value={stats.offlineCount}
        caption="You don't have any offline workers."
      />
      <StatCard
        title="Rejection rate"
        value={rejection}
        caption="Rejected share rate will appear after mining starts."
        hint="Share of submitted shares the pool rejected, across PPLNS and FPPS."
      />
      <StatCard
        title="Today's earnings"
        value="0 BTC"
        caption="Rewards will appear here as mining activity is recorded."
      />
    </div>
  );
}
