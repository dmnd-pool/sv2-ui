import type { ReactNode } from 'react';
import { LiAltArrowDown, LiAltArrowUp } from 'solar-icon-react/li';
import { useAccountHashrate, useAccountHashrateHistory } from '@/hooks/useAccountData';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { InfoHint } from '@/components/ui/InfoHint';
import { Reading } from '@/components/ui/Reading';
import { MiningIcon } from '@/components/dashboard/icons/MiningIcon';
import { LIVE_HASHRATE_HINT } from '@/lib/metricWindows';
import { hashrateChangeFrom24HoursAgo, hashrateComparisonWindow } from '@/lib/hashrateHistory';

const PPLNS_COLOR = '#2b7fff';
const FPPS_COLOR = '#e67c2a';

/** "Last updated" from the snapshot's observed_at, rounded to whole minutes. */
function lastUpdatedLabel(observedAt: string | null | undefined, now: number): string | null {
  if (!observedAt) return null;
  const ms = Date.parse(observedAt);
  if (Number.isNaN(ms)) return null;
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins === 0) return 'Last updated just now';
  return `Last updated ${mins} minute${mins === 1 ? '' : 's'} ago`;
}

/** A coloured marker, scheme name and its hint, sitting above the figure it labels. */
function SchemeLabel({
  color,
  name,
  round = false,
  children,
}: {
  color: string;
  name: string;
  round?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={round ? 'h-2.5 w-2.5 rounded-full' : 'h-3 w-3 rounded-[2px]'} style={{ backgroundColor: color }} />
      <span className="text-sm leading-5 text-body-alt">{name}</span>
      {children}
    </div>
  );
}

function SchemeReading({
  color,
  name,
  value,
  align,
  round,
}: {
  color: string;
  name: string;
  value: number;
  align: 'left' | 'right';
  round?: boolean;
}) {
  const scale = pickHashrateScale([value]);
  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      <SchemeLabel color={color} name={name} round={round}>
        <InfoHint text={LIVE_HASHRATE_HINT} />
      </SchemeLabel>
      <Reading
        value={formatAxisValue(value, scale.divisor)}
        unit={scale.unit}
        size="sm"
        className={align === 'right' ? 'text-right' : undefined}
      />
    </div>
  );
}

function formatChange(change: number): string {
  return Math.abs(change).toFixed(1).replace(/\.0$/, '');
}

/**
 * The account's live total and its change from a comparable snapshot 24 hours ago, followed
 * by the active payout-scheme readings in a stable left/right split.
 */
export function LiveHashrateCard() {
  const { data, isLoading } = useAccountHashrate();
  const now = Date.now();
  const comparisonWindow = hashrateComparisonWindow(data?.observed_at, now);
  // This narrow custom window returns only raw two-minute snapshots, so the shared
  // history hook does not need to collapse points for chart rendering.
  const { data: comparisonHistory } = useAccountHashrateHistory(
    '24H',
    comparisonWindow,
    comparisonWindow !== null,
  );
  const total = data?.total_hashrate ?? 0;
  const pplns = data?.pplns_hashrate ?? 0;
  const fpps = data?.fpps_hashrate ?? 0;
  const lastUpdated = lastUpdatedLabel(data?.observed_at, now);
  const totalScale = pickHashrateScale([total]);
  const change = hashrateChangeFrom24HoursAgo(total, data?.observed_at, comparisonHistory ?? [], now);
  const rising = change !== null && change >= 0;
  const ChangeIcon = rising ? LiAltArrowUp : LiAltArrowDown;
  const hasSchemes = pplns > 0 || fpps > 0;

  return (
    <div className="flex h-full flex-col border-[0.5px] border-border bg-card p-3 lg:p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded-sm border-[0.5px] border-border px-3 py-1 text-xs leading-4 text-body-alt">
          <span className="h-1 w-1 rounded-full bg-success" />
          Live hashrate
        </span>
        {total > 0 && lastUpdated && <span className="text-sm leading-5 text-body-alt">{lastUpdated}</span>}
      </div>

      {isLoading ? (
        <div className="mt-2 h-24 animate-pulse bg-muted" />
      ) : total > 0 ? (
        <div className="mt-2 flex flex-1 flex-col justify-end">
          <div className="flex items-baseline gap-2">
            <Reading value={formatAxisValue(total, totalScale.divisor)} unit={totalScale.unit} size="md" />
            <span className="text-sm leading-5 text-body-alt">Total hashrate</span>
          </div>

          {change !== null && (
            <p className={`mt-0.5 flex items-center gap-1 text-xs leading-4 ${rising ? 'text-success-text' : 'text-destructive'}`}>
              <ChangeIcon className="h-3.5 w-3.5" />
              <span>{formatChange(change)}% vs 24h ago</span>
            </p>
          )}

          {hasSchemes && (
            <>
              <div className="mt-2 h-px w-full bg-border" />
              <div className="mt-2 grid grid-cols-2 gap-4">
                {pplns > 0 && (
                  <SchemeReading color={PPLNS_COLOR} name="PPLNS" value={pplns} align="left" />
                )}
                {fpps > 0 && (
                  <div className="col-start-2">
                    <SchemeReading color={FPPS_COLOR} name="FPPS" value={fpps} align="right" round />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mt-2 h-px w-full bg-border" />
          <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-1">
            <MiningIcon className="h-10 w-10" />
            <p className="text-center text-base font-medium leading-6 text-foreground">No mining activity yet</p>
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
