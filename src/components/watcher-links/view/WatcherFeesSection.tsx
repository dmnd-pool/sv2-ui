import type { SubaccountFees } from '@/api/types';
import { formatFeePercent, totalPoolFee } from '@/lib/watcherLinks';

/** One fee card: label, the rate with a percent sign, and a caption naming who charges it. */
function FeeCard({ label, rate, caption }: { label: string; rate: number; caption: string }) {
  return (
    <div className="border-[0.5px] border-border bg-card p-4 lg:p-5">
      <p className="text-sm text-body-alt">{label}</p>
      <p className="mt-1.5 text-heading">
        <span className="text-xl font-bold leading-8">{formatFeePercent(rate)}</span>
        <span className="ml-1 text-base text-body-alt">%</span>
      </p>
      <p className="mt-1.5 text-sm text-body-alt">{caption}</p>
    </div>
  );
}

/**
 * The Fees section of the Watcher View, shown when the link grants the fees scope.
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
    );
  }

  if (isError || !fees) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-base font-semibold text-foreground">Couldn&apos;t load fees</p>
        <p className="mt-1 text-sm text-body-alt">Something went wrong fetching this account&apos;s fee rates.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FeeCard label="Pool fee" rate={totalPoolFee(fees)} caption="Charged by DMND Pool" />
    </div>
  );
}
