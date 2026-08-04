import type { ReactNode } from 'react';
import { useAccountHashrate } from '@/hooks/useAccountData';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { InfoHint } from '@/components/ui/InfoHint';
import { Reading } from '@/components/ui/Reading';
import { MiningIcon } from '@/components/dashboard/icons/MiningIcon';

const PPLNS_COLOR = '#2b7fff';
const FPPS_COLOR = '#e67c2a';

const PPLNS_HINT =
  'Payouts are based on your contribution to recently submitted shares. Earnings can vary, but may be higher over time.';

/** "Last updated" from the snapshot's observed_at, rounded to whole minutes. */
function lastUpdatedLabel(observedAt: string | undefined, now: number): string | null {
  if (!observedAt) return null;
  const ms = Date.parse(observedAt);
  if (Number.isNaN(ms)) return null;
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins === 0) return 'Last updated just now';
  return `Last updated ${mins} minute${mins === 1 ? '' : 's'} ago`;
}

/** A coloured swatch, scheme name and its hint, sitting above the figure it labels. */
function SchemeLabel({ color, name, children }: { color: string; name: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: color }} />
      <span className="text-sm leading-5 text-body-alt">{name}</span>
      {children}
    </div>
  );
}

/**
 * The account's live hashrate. A miner on a single payout scheme sees that scheme
 * labelled above one figure; once both schemes report, the headline becomes the total
 * and a split row breaks it down, which is how the design draws each case.
 */
export function LiveHashrateCard() {
  const { data, isLoading } = useAccountHashrate();
  const total = data?.total_hashrate ?? 0;
  const pplns = data?.pplns_hashrate ?? 0;
  const fpps = data?.fpps_hashrate ?? 0;
  const lastUpdated = lastUpdatedLabel(data?.observed_at, Date.now());
  const split = pplns > 0 && fpps > 0;

  return (
    <div className="flex h-full flex-col border-[0.5px] border-border bg-card p-4 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded-sm border-[0.5px] border-border px-3 py-1 text-xs leading-4 text-body-alt">
          <span className="h-1 w-1 rounded-full bg-success" />
          Live hashrate
        </span>
        {total > 0 && lastUpdated && <span className="text-sm leading-5 text-body-alt">{lastUpdated}</span>}
      </div>

      {isLoading ? (
        <div className="mt-4 h-24 animate-pulse bg-muted" />
      ) : total > 0 ? (
        <div className="mt-4 flex flex-1 flex-col justify-end gap-1">
          {/* One scheme reporting reads as that scheme's figure; both read as a total. */}
          {!split && (
            <SchemeLabel color={pplns > 0 ? PPLNS_COLOR : FPPS_COLOR} name={pplns > 0 ? 'PPLNS' : 'FPPS'}>
              <InfoHint text={PPLNS_HINT} />
            </SchemeLabel>
          )}
          <Reading value={formatAxisValue(total, pickHashrateScale([total]).divisor)} unit={pickHashrateScale([total]).unit} size="lg" />
          {split && (
            <>
              <div className="mt-4 h-px w-full bg-border" />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <SchemeLabel color={PPLNS_COLOR} name="PPLNS">
                    <InfoHint text={PPLNS_HINT} />
                  </SchemeLabel>
                  <Reading value={formatAxisValue(pplns, pickHashrateScale([pplns]).divisor)} unit={pickHashrateScale([pplns]).unit} size="sm" />
                </div>
                <div className="h-16 w-px bg-border" />
                <div className="flex flex-col gap-1">
                  <SchemeLabel color={FPPS_COLOR} name="FPPS" />
                  <Reading value={formatAxisValue(fpps, pickHashrateScale([fpps]).divisor)} unit={pickHashrateScale([fpps]).unit} size="sm" />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 h-px w-full bg-border" />
          <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2">
            <MiningIcon className="h-16 w-16" />
            <p className="text-center text-lg font-medium leading-7 text-foreground">No mining activity yet</p>
            <p className="text-center text-sm leading-5 text-body-alt">
              Your live hashrate will appear here. Connect a worker to
              <br />
              start submitting shares and track performance.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
