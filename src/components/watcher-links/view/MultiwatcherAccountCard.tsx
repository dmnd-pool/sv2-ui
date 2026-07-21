import { useWatcherHashrate, useWatcherGeneratedBtc } from '@/hooks/useWatcherView';
import { formatBtc, sumGenerated } from '@/lib/generatedBtcTable';
import { WatcherHashratePanel } from './WatcherHashratePanel';

/** True when a query failed because the token does not grant that scope (or is invalid). */
function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && /no longer valid|401/.test(error.message);
}

/**
 * One account's read-only summary inside the multiwatcher view. Which panels show is
 * driven by the link's enforcement mode; a panel whose token-only fetch is rejected
 * for lack of scope is quietly dropped, so the card never claims data it cannot read.
 */
export function MultiwatcherAccountCard({
  token,
  showHashrate,
  showGenerated,
}: {
  token: string;
  showHashrate: boolean;
  showGenerated: boolean;
}) {
  const hashrate = useWatcherHashrate(token);
  const generated = useWatcherGeneratedBtc(token, showGenerated);

  const hashrateOk = showHashrate && !(hashrate.isError && isUnauthorized(hashrate.error));
  const generatedOk = showGenerated && !(generated.isError && isUnauthorized(generated.error));
  const totalBtc = sumGenerated(generated.data ?? []);

  return (
    <div className="space-y-4">
      {hashrateOk && (
        <WatcherHashratePanel
          snapshot={hashrate.data ?? null}
          isLoading={hashrate.isLoading}
          isError={hashrate.isError && !isUnauthorized(hashrate.error)}
        />
      )}
      {generatedOk && (
        <div className="rounded-xl border border-border bg-card p-6">
          <span className="text-sm text-body-alt">Generated BTC</span>
          {generated.isLoading ? (
            <p className="mt-2 h-8 w-32 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-semibold text-heading">
              {formatBtc(totalBtc)}
              <span className="ml-1 text-base font-normal text-body-alt">BTC</span>
            </p>
          )}
          <p className="mt-1 text-xs text-body-alt">Total Bitcoin generated</p>
        </div>
      )}
    </div>
  );
}
