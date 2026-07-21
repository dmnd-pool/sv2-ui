import type { SubaccountFees } from '@/api/types';
import { formatFeePercent } from '@/lib/watcherLinks';

/** One fee card: label, the rate with a percent sign, and a caption naming who charges it. */
function FeeCard({ label, rate, caption }: { label: string; rate: number; caption: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-body-alt">{label}</p>
      <p className="mt-2 text-heading">
        <span className="text-2xl font-bold">{formatFeePercent(rate)}</span>
        <span className="ml-1 text-lg text-body-alt">%</span>
      </p>
      <p className="mt-2 text-sm text-body-alt">{caption}</p>
    </div>
  );
}

/**
 * The Fees section of the Watcher View, shown when the link grants the fees scope. The
 * pool and broker rates are the whole surface `/api/user/fees` exposes, so it is the
 * two cards the design draws and nothing more; the card treatment follows the stat
 * cards used elsewhere in the app rather than the design's flat panels.
 */
export function WatcherFeesSection({
  fees,
  isLoading,
  isError,
}: {
  fees: SubaccountFees | null;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-muted" />
        ))}
      </div>
    );
  }

  if (isError || !fees) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-base font-semibold text-foreground">Couldn&apos;t load fees</p>
        <p className="mt-1 text-sm text-body-alt">Something went wrong fetching this account&apos;s fee rates.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FeeCard label="Pool fee" rate={fees.pool_fee} caption="Charged by DMND Pool" />
      <FeeCard label="Broker fee" rate={fees.broker_fee} caption="Applied by broker" />
    </div>
  );
}
