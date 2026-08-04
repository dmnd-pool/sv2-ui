import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';
import { Reading } from '@/components/ui/Reading';
import { WorkerBars } from '@/components/ui/WorkerBars';
import { useAccountAllWorkers, useTodayEarnings } from '@/hooks/useAccountData';
import { deriveWorkerStats } from '@/lib/workerStats';
import { classifyWorker } from '@/lib/workersTable';
import { BTC_DISPLAY_DP } from '@/lib/utils';
import type { AggregatedStats } from '@/lib/aggregatedStats';

/**
 * A stat card. The reading is one big numeral in the heading face with the unit
 * trailing it at body size, which is why value and unit are separate props rather
 * than one formatted string. `emphasis` colours the numeral for a rated figure, and
 * `captionTone` follows the design's split between an empty hint and a live caption.
 */
function StatCard({
  title,
  value,
  unit,
  unitSize = 'lg',
  emphasis,
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
  emphasis?: boolean;
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
      <Reading value={value} unit={unit} size="md" tone={emphasis ? 'success' : 'default'} unitSize={unitSize} />
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
        hint="Workers currently connected and submitting shares to the pool."
      />
      <StatCard
        tour="stats-workers"
        title="Offline workers"
        value={stats.offlineCount}
        captionTone={hasWorkers ? 'strong' : 'muted'}
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
        unit={hasMined ? '%' : undefined}
        emphasis={hasMined}
        captionTone={hasMined ? 'strong' : 'muted'}
        caption={hasMined ? 'Across PPLNS and FPPS shares.' : 'Rejected share rate will appear after mining starts.'}
        hint="The percentage of shares that were rejected and did not count toward Payouts."
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
              : 'Earnings generated today across all accounts will appear here.'
            : todayEarnings !== undefined && todayEarnings > 0
              ? 'Paid out on-chain today.'
              : 'Earnings paid out on-chain today will appear here.'
        }
        hint="Payouts are based on your contribution to recently submitted shares. Earnings can vary, but may be higher over time."
      />
    </div>
  );
}
