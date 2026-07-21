import { useAccountHashrate } from '@/hooks/useAccountData';
import { formatHashrate } from '@/lib/utils';
import { MiningIcon } from '@/components/dashboard/icons/MiningIcon';
import { CardEmptyState } from './CardEmptyState';

/** "Last updated" from the snapshot's observed_at, rounded to whole minutes. */
function lastUpdatedLabel(observedAt: string | undefined, now: number): string | null {
  if (!observedAt) return null;
  const ms = Date.parse(observedAt);
  if (Number.isNaN(ms)) return null;
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins === 0) return 'Last updated just now';
  return `Last updated ${mins} minute${mins === 1 ? '' : 's'} ago`;
}

/** The account's live total hashrate, with a PPLNS / FPPS breakdown when mining. */
export function LiveHashrateCard() {
  const { data, isLoading } = useAccountHashrate();
  const total = data?.total_hashrate ?? 0;
  const lastUpdated = lastUpdatedLabel(data?.observed_at, Date.now());

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live hashrate
        </span>
        {total > 0 && lastUpdated && <span className="text-xs text-body-alt">{lastUpdated}</span>}
      </div>
      {isLoading ? (
        <div className="mt-5 h-24 animate-pulse rounded-lg bg-muted" />
      ) : total > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-3xl font-semibold text-heading">{formatHashrate(total)}</p>
          <div className="mt-3 flex gap-6 text-sm">
            <span>
              <span className="text-body-alt">PPLNS </span>
              <span className="font-mono text-foreground">{formatHashrate(data?.pplns_hashrate ?? 0)}</span>
            </span>
            <span>
              <span className="text-body-alt">FPPS </span>
              <span className="font-mono text-foreground">{formatHashrate(data?.fpps_hashrate ?? 0)}</span>
            </span>
          </div>
        </div>
      ) : (
        <CardEmptyState
          icon={<MiningIcon className="h-16 w-16" />}
          title="No mining activity yet"
          subtitle="Your live hashrate will appear here. Connect a worker to start submitting shares and track performance."
        />
      )}
    </div>
  );
}
