import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { Reading } from '@/components/ui/Reading';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { formatBtc, type SubaccountsPageStats } from '@/lib/subaccountsTable';

/**
 * A stat card. Same shell and type ramp as the home and workers cards, so the three
 * pages cannot drift apart: the reading is a numeral in the heading face with its unit
 * trailing at body size, and the caption sits at body size below it.
 */
function Card({
  title,
  hint,
  children,
  caption,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 border-[0.5px] border-border bg-card p-4 lg:p-8">
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      {children}
      <p className="text-sm leading-5 text-body-alt">{caption}</p>
    </div>
  );
}

/** Total subaccounts / Active workers / Combined hashrate / Today's total earnings. */
export function SubaccountsStatCards({ stats }: { stats: SubaccountsPageStats }) {
  // One unit for the combined figure, matching how every other hashrate reading is set.
  const scale = pickHashrateScale([stats.combinedHashrate]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Total subaccounts" caption="Mining operations">
        <Reading value={stats.total} />
      </Card>

      <Card
        title="Active workers"
        hint="Connected workers summed across every subaccount."
        caption="Across all subaccounts"
      >
        <Reading value={stats.activeWorkers} />
      </Card>

      <Card title="Combined hashrate" caption="Across all subaccounts">
        <Reading value={formatAxisValue(stats.combinedHashrate, scale.divisor)} unit={scale.unit} />
      </Card>

      <Card title="Today's total earnings" caption="Generated across all subaccounts">
        <Reading value={formatBtc(stats.todayEarnings)} unit="BTC" />
      </Card>
    </div>
  );
}
