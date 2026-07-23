import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { useAccountAllWorkers, useTodayEarnings } from '@/hooks/useAccountData';
import { deriveWorkerStats } from '@/lib/workerStats';
import { classifyWorker } from '@/lib/workersTable';
import type { AggregatedStats } from '@/lib/aggregatedStats';

function StatCard({
  title,
  value,
  caption,
  hint,
  tour,
}: {
  title: string;
  value: ReactNode;
  caption: string;
  hint?: string;
  tour?: string;
}) {
  return (
    <div data-tour={tour} className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
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
export function WorkerStatCards({ aggregated }: { aggregated?: AggregatedStats }) {
  const { data: workers } = useAccountAllWorkers();
  const { data: earnings } = useTodayEarnings();
  const roster = workers ?? [];
  const single = deriveWorkerStats(roster);
  // Offline for over 24h reuses the workers-page classifier (last-seen from
  // connected_at), so the home matches how that page counts stale workers.
  const now = Date.now();
  // In aggregated mode every figure is the roll-up across subaccounts, so the cards
  // can never show one account's numbers while the rest of the page shows the total.
  const stats = aggregated
    ? {
        activeCount: aggregated.activeWorkers,
        totalCount: aggregated.totalWorkers,
        offlineCount: aggregated.offlineWorkers,
        rejectionRate: aggregated.rejectionRate,
      }
    : single;
  const offline24h = aggregated
    ? aggregated.offline24h
    : roster.filter((w) => classifyWorker(w, now) === 'offline_24h').length;
  const todayEarnings = aggregated ? aggregated.todayEarnings : earnings;
  const hasWorkers = stats.totalCount > 0;
  const hasMined = stats.rejectionRate !== null;
  const rejection = stats.rejectionRate === null ? '--' : `${(stats.rejectionRate * 100).toFixed(2)}%`;
  const earningsLabel = todayEarnings === undefined ? '--' : formatBtc(todayEarnings);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        tour="stats-workers"
        title="Active workers"
        value={`${stats.activeCount}/${stats.totalCount}`}
        // Once workers exist, show the live split; before that, the empty hint.
        caption={
          hasWorkers ? `${stats.activeCount} active • ${stats.offlineCount} offline` : 'Connected workers will appear here.'
        }
        hint="Workers currently connected and submitting shares to the pool."
      />
      <StatCard
        tour="stats-workers"
        title="Offline workers"
        value={stats.offlineCount}
        caption={
          !hasWorkers
            ? "You don't have any offline workers."
            : stats.offlineCount === 0
              ? 'No worker is offline'
              : offline24h > 0
                ? `${offline24h} offline for over 24h`
                : `${stats.offlineCount} worker${stats.offlineCount === 1 ? '' : 's'} offline`
        }
      />
      <StatCard
        tour="stats-earnings"
        title="Rejection rate"
        value={rejection}
        caption={hasMined ? 'Across PPLNS and FPPS shares.' : 'Rejected share rate will appear after mining starts.'}
        hint="The percentage of shares that were rejected and did not count toward Payouts."
      />
      <StatCard
        tour="stats-earnings"
        title="Today's earnings"
        value={earningsLabel}
        // Aggregated mode sums each subaccount's today_generated_btc (accrued, not yet
        // paid out), a different figure than single mode's on-chain-paid total, so the
        // caption can't claim "paid out" for both.
        caption={
          aggregated
            ? todayEarnings !== undefined && todayEarnings > 0
              ? 'Generated today across subaccounts.'
              : 'Earnings generated today across subaccounts will appear here.'
            : todayEarnings !== undefined && todayEarnings > 0
              ? 'Paid out on-chain today.'
              : 'Earnings paid out on-chain today will appear here.'
        }
        hint="Payouts are based on your contribution to recently submitted shares. Earnings can vary, but may be higher over time."
      />
    </div>
  );
}
