import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { formatHashrate } from '@/lib/utils';
import { formatBrokerFee, splitValueUnit } from '@/lib/brokerTable';

/**
 * A broker summary card. Square corners and a hairline on all four sides, matching
 * the frames: unlike the miner stat cards these are not rounded.
 */
function Card({
  title,
  sub,
  hint,
  children,
}: {
  title: string;
  sub: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 border-[0.5px] border-border bg-card p-4 lg:p-8">
      <span className="flex items-center gap-2 text-sm leading-5 text-body-alt">
        {title}
        {hint && <InfoHint text={hint} />}
      </span>
      <div className="flex flex-col gap-1">
        {children}
        <p className="text-sm leading-5 text-body-alt">{sub}</p>
      </div>
    </div>
  );
}

/**
 * The value line: the numeral in the heading face, the unit a step down in the body
 * face. The frames set the numeral in Bold rather than the SemiBold used on titles.
 */
function Value({ value, unit }: { value: string; unit?: string }) {
  return (
    <p className="font-heading text-2xl font-bold leading-9 tracking-[-1px] text-foreground">
      {value}
      {unit && <span className="!font-body ml-1 text-lg font-normal leading-7 text-body-alt">{unit}</span>}
    </p>
  );
}

/**
 * Total miners / Total hashrate / Estimated earnings / Average broker fee.
 *
 * Estimated earnings has no backing field: the API returns a work counter, not an
 * amount, so the figure reads as unavailable rather than showing a fabricated or
 * zeroed number on a money surface.
 */
export function BrokerStatCards({
  minerCount,
  totalHashrate,
  averageFee,
}: {
  minerCount: number;
  totalHashrate: number;
  averageFee: number | null;
}) {
  const hashrate = splitValueUnit(formatHashrate(totalHashrate));

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Total miners" sub="Miners using your referral code">
        <Value value={String(minerCount)} />
      </Card>

      <Card title="Total hashrate" sub="Combined across all miners">
        <Value value={hashrate.value} unit={hashrate.unit} />
      </Card>

      <Card title="Estimated earnings" sub="Estimated across all miners.">
        <Value value="--" />
      </Card>

      <Card
        title="Average broker fee"
        sub="Average fee earned from miners"
        hint="The average fee you earn across the miners using your referral code."
      >
        <Value value={formatBrokerFee(averageFee)} />
      </Card>
    </div>
  );
}
