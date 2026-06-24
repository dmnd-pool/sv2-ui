import type { ReactNode } from 'react';
import { LiInfoCircle } from 'solar-icon-react/li';
import { useAccountAllWorkers, useTodayEarnings } from '@/hooks/useAccountData';
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

function formatBtc(btc: number): string {
  if (btc === 0) return '0 BTC';
  return `${btc.toFixed(8).replace(/\.?0+$/, '')} BTC`;
}

/**
 * Active / Offline / Rejection / Today's earnings cards. Worker counts come from
 * the full roster; today's earnings is derived from on-chain payouts (see
 * useTodayEarnings), not a hardcoded value. While the earnings lookup is loading or
 * fails it shows "--" (unknown) rather than a misleading 0; a genuine zero shows
 * "0 BTC".
 */
export function WorkerStatCards() {
  const { data: workers } = useAccountAllWorkers();
  const { data: earnings } = useTodayEarnings();
  const stats = deriveWorkerStats(workers ?? []);
  const rejection = stats.rejectionRate === null ? '--' : `${(stats.rejectionRate * 100).toFixed(2)}%`;
  const earningsLabel = earnings === undefined ? '--' : formatBtc(earnings);

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
        value={earningsLabel}
        caption="Earnings paid out on-chain today will appear here."
        hint="Sum of payouts received at your FPPS and PPLNS addresses in confirmed transactions today."
      />
    </div>
  );
}
