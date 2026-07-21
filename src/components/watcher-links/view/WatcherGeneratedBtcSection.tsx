import type { GeneratedBtcEntry } from '@/api/types';
import { formatBtc, sumGenerated } from '@/lib/generatedBtcTable';
import { GeneratedBtcTable } from '@/components/generated-btc/GeneratedBtcTable';

/**
 * The Generated BTC section of the Watcher View, shown when the link grants the
 * earnings scope. It reuses the signed-in Generated BTC table so the columns and
 * formatting match; the design has no watcher-specific earnings frame yet, so the
 * surrounding treatment follows that page rather than inventing a new one.
 */
export function WatcherGeneratedBtcSection({
  entries,
  isLoading,
  isError,
}: {
  entries: GeneratedBtcEntry[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-base font-semibold text-foreground">Couldn&apos;t load earnings</p>
        <p className="mt-1 text-sm text-body-alt">Something went wrong fetching this account&apos;s generated Bitcoin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-body-alt">Total generated</p>
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{formatBtc(sumGenerated(entries))}</p>
      </div>
      <div className="rounded-xl border border-border bg-card">
        {entries.length === 0 ? (
          // The signed-in empty state links back into the dashboard, which a watcher
          // has no access to, so this states the same thing without the call to action.
          <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-body-alt">
            No generated Bitcoin to show yet.
          </div>
        ) : (
          <GeneratedBtcTable entries={entries} />
        )}
      </div>
    </div>
  );
}
