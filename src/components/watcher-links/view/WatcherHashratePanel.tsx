import { LiQuestionCircle } from 'solar-icon-react/li';
import type { HashrateSnapshot } from '@/api/types';
import { formatHashrate } from '@/lib/utils';
import { formatLastUpdated } from '@/lib/watcherLinks';

const PPLNS_COLOR = '#2b7fff';
const FPPS_COLOR = '#e67c2a';

/** One scheme's coloured square, label, info icon and value, per the design. */
function SchemeStat({ color, label, hint, value }: { color: string; label: string; hint: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-sm text-body-alt">{label}</span>
        <LiQuestionCircle className="h-4 w-4 text-placeholder" aria-label={hint} />
      </span>
      <p className="font-mono text-2xl text-foreground">
        {formatHashrate(value)}
      </p>
    </div>
  );
}

/**
 * The read-only live-hashrate card for the Watcher View: the Live badge and last-updated
 * time, the total, then the PPLNS and FPPS split (blue / orange, matching the chart). The
 * "from yesterday" delta is not shown: the hashrate endpoint returns no previous-day
 * value, so there is nothing to compute it from.
 */
export function WatcherHashratePanel({
  snapshot,
  isLoading,
  isError,
}: {
  snapshot: HashrateSnapshot | null;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl border border-border bg-muted" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-body-alt">
        Hashrate data is unavailable right now.
      </div>
    );
  }

  const total = snapshot?.total_hashrate ?? 0;
  const pplns = snapshot?.pplns_hashrate ?? 0;
  const fpps = snapshot?.fpps_hashrate ?? 0;
  const lastUpdated = formatLastUpdated(snapshot?.observed_at, Date.now());

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-xs text-body-alt">
          <span className="h-1 w-1 rounded-full bg-success" /> Live hashrate
        </span>
        {lastUpdated && <span className="text-sm text-body-alt">Last updated {lastUpdated}</span>}
      </div>

      <p className="mt-4 font-mono text-3xl font-semibold text-heading">{formatHashrate(total)}</p>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
        <SchemeStat color={PPLNS_COLOR} label="PPLNS" hint="Hashrate mining under the PPLNS scheme." value={pplns} />
        <div className="h-14 w-px bg-border" />
        <SchemeStat color={FPPS_COLOR} label="FPPS" hint="Hashrate mining under the FPPS scheme." value={fpps} />
      </div>
    </div>
  );
}
