import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';
import { Reading } from '@/components/ui/Reading';
import { WorkerBars } from '@/components/ui/WorkerBars';
import { useAccountAllWorkers, useAccountHashrate, useAccountShareStats, useTodayEarnings } from '@/hooks/useAccountData';
import { deriveWorkerStats } from '@/lib/workerStats';
import { BTC_DISPLAY_DP } from '@/lib/utils';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import type { AggregatedStats } from '@/lib/aggregatedStats';
import { ACCOUNT_REJECTION_HINT, ACTIVE_WORKERS_HINT, WORKER_METRICS_HINT } from '@/lib/metricWindows';

/**
 * A stat card. The reading is one big numeral in the heading face with the unit
 * trailing it at body size, which is why value and unit are separate props rather
 * than one formatted string. `captionTone` follows the design's split between an empty
 * hint and a live caption.
 */
function StatCard({
  title,
  value,
  unit,
  unitSize = 'lg',
  caption,
  captionTone = 'muted',
  meter,
  hint,
  tour,
}: {
  title: string;
  value: string | number;
  unit?: string;
  unitSize?: 'base' | 'lg';
  caption: string;
  captionTone?: 'muted' | 'strong';
  meter?: ReactNode;
  hint?: string;
  tour?: string;
}) {
  return (
    <div data-tour={tour} className="flex flex-col justify-between border-[0.5px] border-border bg-card p-4 lg:p-8">
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      <Reading value={value} unit={unit} size="md" unitSize={unitSize} />
      <div className="flex flex-col gap-2">
        {meter}
        <p className={cn('text-sm leading-5', captionTone === 'strong' ? 'text-foreground' : 'text-body-alt')}>
          {caption}
        </p>
      </div>
    </div>
  );
}

function formatBtc(btc: number): string {
  if (btc === 0) return '0 BTC';
  return `${btc.toFixed(BTC_DISPLAY_DP).replace(/\.?0+$/, '')} BTC`;
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
  const { data: shareStats } = useAccountShareStats(aggregated === undefined);
  const { data: hashrate } = useAccountHashrate(aggregated === undefined);
  const { data: earnings } = useTodayEarnings(aggregated === undefined);
  const roster = workers ?? [];
  const single = deriveWorkerStats(roster);
  const shareTotal = (shareStats?.accepted ?? 0) + (shareStats?.rejected ?? 0);
  const singleRejection = shareTotal > 0 ? (shareStats?.rejected ?? 0) / shareTotal : null;
  // In aggregated mode every figure is the roll-up across subaccounts, so the cards
  // can never show one account's numbers while the rest of the page shows the total.
  const stats = aggregated
    ? {
        activeCount: aggregated.activeWorkers,
        totalCount: aggregated.totalWorkers,
        offlineCount: aggregated.offlineWorkers,
        rejectionRate: aggregated.rejectionRate,
      }
    : { ...single, rejectionRate: singleRejection };
  const todayEarnings = aggregated ? aggregated.todayEarnings : earnings;
  const totalHashrate = aggregated ? aggregated.combinedHashrate : (hashrate?.total_hashrate ?? 0);
  // No active worker means no rate to divide, which is unknown rather than zero.
  const perWorker = stats.activeCount > 0 ? totalHashrate / stats.activeCount : null;
  const perWorkerScale = pickHashrateScale([perWorker ?? 0]);
  const hasWorkers = stats.totalCount > 0;
  const hasMined = stats.rejectionRate !== null;
  const rejection = stats.rejectionRate === null ? '--' : (stats.rejectionRate * 100).toFixed(2);
  const earningsValue = todayEarnings === undefined ? '--' : formatBtc(todayEarnings);
  const earningsKnown = todayEarnings !== undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        tour="stats-workers"
        title="Active workers"
        value={stats.activeCount}
        unit={`/${stats.totalCount}`}
        unitSize="base"
        meter={aggregated && hasWorkers ? <WorkerBars active={stats.activeCount} total={stats.totalCount} /> : undefined}
        // Once workers exist, show the live split; before that, the empty hint.
        caption={
          hasWorkers ? `${stats.activeCount} active • ${stats.offlineCount} offline` : 'Connected workers will appear here.'
        }
        hint={ACTIVE_WORKERS_HINT}
      />
      <StatCard
        tour="stats-workers"
        title="Average hashrate"
        value={perWorker === null ? '--' : formatAxisValue(perWorker, perWorkerScale.divisor)}
        unit={perWorker === null ? undefined : perWorkerScale.unit}
        unitSize="base"
        captionTone={perWorker === null ? 'muted' : 'strong'}
        caption={
          perWorker === null
            ? 'Shown once a worker is active.'
            : `Averaged over ${stats.activeCount} active worker${stats.activeCount === 1 ? '' : 's'}`
        }
        hint={WORKER_METRICS_HINT}
      />
      <StatCard
        tour="stats-earnings"
        title="Rejection rate"
        value={rejection}
        unit={hasMined ? '%' : undefined}
        captionTone={hasMined ? 'strong' : 'muted'}
        caption={hasMined ? 'Last 24 hours across all shares.' : 'Rejected share rate will appear after mining starts.'}
        hint={ACCOUNT_REJECTION_HINT}
      />
      <StatCard
        tour="stats-earnings"
        title="Today's earnings"
        value={earningsKnown ? earningsValue.replace(' BTC', '') : '--'}
        unit={earningsKnown ? 'BTC' : undefined}
        captionTone={earningsKnown && todayEarnings > 0 ? 'strong' : 'muted'}
        // Aggregated mode sums each subaccount's today_generated_btc (accrued, not yet
        // paid out), a different figure than single mode's on-chain-paid total, so the
        // caption can't claim "paid out" for both.
        caption={
          aggregated
            ? todayEarnings !== undefined && todayEarnings > 0
              ? 'Generated today across all accounts.'
              : 'Earnings generated today across all accounts.'
            : todayEarnings !== undefined && todayEarnings > 0
              ? 'Paid out on-chain today.'
              : 'Earnings paid out on-chain today.'
        }
        hint={
          aggregated
            ? 'Bitcoin generated today across the accounts in this view.'
            : 'Confirmed payouts sent to your payout address today.'
        }
      />
    </div>
  );
}
