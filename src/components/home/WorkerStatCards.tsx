import type { Worker, HashrateSnapshot, SubaccountShareStats, SubaccountFees } from '@/api/types';
import { Children, type ReactNode } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { formatFeePercent, totalPoolFee } from '@/lib/watcherLinks';
import { WorkerBars } from '@/components/ui/WorkerBars';
import { useAccountAllWorkers, useAccountSummary, useLatestPayout } from '@/hooks/useAccountData';
import { deriveWorkerStats } from '@/lib/workerStats';
import { formatPayoutDate, type latestPayout } from '@/lib/payoutsTable';
import { BTC_DISPLAY_DP, cn } from '@/lib/utils';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import type { AggregatedStats } from '@/lib/aggregatedStats';
import { ACCOUNT_REJECTION_HINT, ACTIVE_WORKERS_HINT, WORKER_METRICS_HINT } from '@/lib/metricWindows';

function formatBtc(btc: number): string {
  if (btc === 0) return '0 BTC';
  return `${btc.toFixed(BTC_DISPLAY_DP).replace(/\.?0+$/, '')} BTC`;
}

/** Generated FPPS BTC and the latest confirmed payout precede mining-health metrics. */
export function WorkerStatCards({ aggregated }: { aggregated?: AggregatedStats }) {
  const { data: workers } = useAccountAllWorkers();
  const summary = useAccountSummary(aggregated === undefined);
  const knownSummary = summary.isSuccess ? summary.data : undefined;
  const generatedBtc = aggregated?.todayEarnings ?? (knownSummary ? knownSummary.today_generated_btc ?? 0 : undefined);
  const payoutQuery = useLatestPayout(true, aggregated !== undefined);
  const payout = payoutQuery.isSuccess ? payoutQuery.data : undefined;
  return <WorkerStatCardsView workers={workers} shareStats={knownSummary?.share_stats} hashrate={knownSummary?.hashrate}
    payout={payout} generatedBtc={generatedBtc} showGenerated aggregated={aggregated} />;
}

/** Data-only dashboard metrics. Visibility is explicit so public views cannot imply access to another scope. */
export function WorkerStatCardsView({ workers, shareStats, hashrate, payout, generatedBtc, aggregated, showGenerated = false, showWorkers = true, showHashrate = true, showRejection = true, showEarnings = true, children }: {
  workers?: Worker[];
  shareStats?: SubaccountShareStats;
  hashrate?: HashrateSnapshot;
  payout?: ReturnType<typeof latestPayout>;
  generatedBtc?: number;
  showGenerated?: boolean;
  aggregated?: AggregatedStats;
  showWorkers?: boolean;
  showHashrate?: boolean;
  showRejection?: boolean;
  showEarnings?: boolean;
  children?: ReactNode;
}) {
  const roster = workers ?? [];
  const workersKnown = aggregated !== undefined || workers !== undefined;
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
  const totalHashrate = aggregated ? aggregated.combinedHashrate : hashrate?.total_hashrate;
  // No active worker means no rate to divide, which is unknown rather than zero.
  const perWorker = workersKnown && stats.activeCount > 0 && totalHashrate !== undefined ? totalHashrate / stats.activeCount : null;
  const perWorkerScale = pickHashrateScale([perWorker ?? 0]);
  const hasWorkers = stats.totalCount > 0;
  const hasMined = stats.rejectionRate !== null;
  const rejection = stats.rejectionRate === null ? '--' : (stats.rejectionRate * 100).toFixed(2);
  const cardCount = Number(showWorkers) + Number(showWorkers && showHashrate) + Number(showRejection) + Number(showEarnings) + Number(showGenerated) + Children.toArray(children).length;

  return (
    <div className={cn('grid grid-cols-1 gap-2', cardCount > 1 && 'sm:grid-cols-2', cardCount === 3 && 'lg:grid-cols-3', cardCount === 4 && 'lg:grid-cols-4',
      cardCount === 5 && 'lg:grid-cols-6 lg:[&>div]:col-span-2 lg:[&>div:nth-child(-n+2)]:col-span-3')}>
      {showGenerated && <TodayGeneratedBtcCard generatedBtc={generatedBtc} aggregated={aggregated !== undefined} />}
      {showEarnings && <LatestPayoutCard payout={payout} aggregated={aggregated !== undefined} />}
      {showWorkers && <StatCard
        tour="stats-workers"
        title="Active workers"
        value={workersKnown ? stats.activeCount : '--'}
        unit={workersKnown ? `/${stats.totalCount}` : undefined}
        unitSize="base"
        meter={aggregated && hasWorkers ? <WorkerBars active={stats.activeCount} total={stats.totalCount} /> : undefined}
        // Once workers exist, show the live split; before that, the empty hint.
        caption={
          !workersKnown ? 'Worker statistics unavailable.' : hasWorkers ? `${stats.activeCount} active • ${stats.offlineCount} offline` : 'Connected workers will appear here.'
        }
        hint={ACTIVE_WORKERS_HINT}
      />}
      {showWorkers && showHashrate && <StatCard
        tour="stats-workers"
        title="Average hashrate"
        value={perWorker === null ? '--' : formatAxisValue(perWorker, perWorkerScale.divisor)}
        unit={perWorker === null ? undefined : perWorkerScale.unit}
        unitSize="base"
        captionTone={perWorker === null ? 'muted' : 'strong'}
        caption={
          perWorker === null
            ? 'Average hashrate of all active workers'
            : `Averaged over ${stats.activeCount} active worker${stats.activeCount === 1 ? '' : 's'}`
        }
        hint={WORKER_METRICS_HINT}
      />}
      {showRejection && <StatCard
        tour="stats-rejection"
        title="Rejection rate"
        value={rejection}
        unit={hasMined ? '%' : undefined}
        captionTone={hasMined ? 'strong' : 'muted'}
        caption={aggregated !== undefined
          ? 'Rejected shares over the last 24 hours across all accounts.'
          : 'Rejected shares over the last 24 hours for this account.'}
        hint={ACCOUNT_REJECTION_HINT}
      />}
      {children}
    </div>
  );
}

/** Reuses cached payout history, including payments confirmed before today. */
export function LatestPayoutCard({ payout, aggregated = false }: {
  payout?: ReturnType<typeof latestPayout>;
  aggregated?: boolean;
}) {
  const known = payout !== undefined;
  return <StatCard
    tour="stats-earnings"
    title="Latest payout"
    value={payout ? formatBtc(payout.amountSats / 1e8).replace(' BTC', '') : known ? '0' : '--'}
    unit={known ? 'BTC' : undefined}
    captionTone={payout ? 'strong' : 'muted'}
    caption={payout ? `Paid on ${formatPayoutDate(payout.date)} (UTC)`
      : known ? 'No confirmed payouts in the last 30 days.' : 'Payout information unavailable.'}
    hint={`Most recently confirmed payout transaction in the last 30 calendar days (UTC)${aggregated ? ' across the main account and all subaccounts' : ' for this account'}.`}
  />;
}

/** Generated FPPS BTC is accrued mining revenue, independent of confirmed payouts. */
export function TodayGeneratedBtcCard({ generatedBtc, aggregated = false }: {
  generatedBtc?: number;
  aggregated?: boolean;
}) {
  const known = generatedBtc !== undefined;
  return <StatCard
    tour="stats-earnings"
    title="Today's Generated BTC"
    value={known ? formatBtc(generatedBtc).replace(' BTC', '') : '--'}
    unit={known ? 'BTC' : undefined}
    caption={aggregated ? 'Generated across all accounts today.' : 'Generated by this account today.'}
    hint="Generated FPPS BTC generated since the start of the day (UTC)."
  />;
}

/** Only supplied (token-permitted) readings appear in this combined card. */
export function WatcherDataCard({ shares }: {
  shares?: { data?: SubaccountShareStats | null; isLoading: boolean; isError: boolean };
}) {
  const stats = shares?.data;
  const total = stats ? stats.accepted + stats.rejected : 0;
  const sharesKnown = !!stats && !shares?.isLoading && !shares?.isError;
  const caption = shares?.isLoading ? 'Loading share statistics…' : shares && !sharesKnown ? 'Share statistics unavailable.' : undefined;

  return (
    <StatCard title="Watcher data" caption={caption} hint={shares ? ACCOUNT_REJECTION_HINT : undefined}>
      <dl className="divide-y divide-border text-sm">
        {shares && <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-body-alt">Rejection rate</dt>
            <dd className="font-medium tabular-nums text-foreground">{sharesKnown && total > 0 ? `${((stats.rejected / total) * 100).toFixed(2)}%` : '--'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-body-alt">Accepted shares</dt>
            <dd className="font-medium tabular-nums text-foreground">{sharesKnown ? stats.accepted.toLocaleString() : '--'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-body-alt">Rejected shares</dt>
            <dd className="font-medium tabular-nums text-foreground">{sharesKnown ? stats.rejected.toLocaleString() : '--'}</dd>
          </div>
        </>}
      </dl>
    </StatCard>
  );
}

/** Home metric card; API fees are already percentages. */
export function PoolFeeCard({ data, isLoading, isError }: {
  data?: SubaccountFees | null;
  isLoading: boolean;
  isError: boolean;
}) {
  const known = !!data && !isLoading && !isError;
  return (
    <StatCard
      title="Pool fee"
      value={known ? formatFeePercent(totalPoolFee(data)) : '--'}
      unit={known ? '%' : undefined}
      caption={isLoading ? 'Loading fees…' : !known ? 'Fee rates unavailable.' : 'Charged by the Pool'}
    />
  );
}
