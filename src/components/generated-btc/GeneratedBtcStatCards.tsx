import type { ReactNode } from 'react';
import { Reading } from '@/components/ui/Reading';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { formatBtc, formatGeneratedDate } from '@/lib/generatedBtcTable';
import type { GeneratedBtcEntry } from '@/api/types';
import { InfoHint } from '@/components/ui/InfoHint';
import { GENERATED_AVG_HASHRATE_HINT } from '@/lib/metricWindows';

/**
 * A stat card. Same shell and type ramp as the home, workers and subaccounts cards so
 * the pages cannot drift apart, except that this page sets its unit one step larger
 * (18/28) than they do, which is how the frame draws it.
 */
function Card({ title, sub, hint, children }: { title: string; sub: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-6 border-[0.5px] border-border bg-card p-4 lg:p-8">
      <span className="inline-flex items-center gap-2 text-sm leading-5 text-body-alt">
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

/** Generated BTC (total) / Average hashrate / Highest earning day, all over the rows shown. */
export function GeneratedBtcStatCards({
  generated,
  averageHashrate,
  highestDay,
}: {
  generated: number;
  averageHashrate: number;
  highestDay: GeneratedBtcEntry | null;
}) {
  // One unit for the hashrate figure, matching how every other hashrate reading is set.
  const scale = pickHashrateScale([averageHashrate]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Generated BTC" sub="FPPS generated + PPLNS projected">
        <Reading value={formatBtc(generated)} unit="BTC" unitSize="lg" />
      </Card>

      <Card title="Average FPPS hashrate" sub="Across the days listed" hint={GENERATED_AVG_HASHRATE_HINT}>
        <Reading value={formatAxisValue(averageHashrate, scale.divisor)} unit={scale.unit} unitSize="lg" />
      </Card>

      <Card
        title="Highest earning day"
        sub={highestDay ? formatGeneratedDate(highestDay.entry_day) : 'No earnings recorded yet'}
      >
        {highestDay ? (
          <Reading value={formatBtc(highestDay.btc_generated)} unit="BTC" unitSize="lg" />
        ) : (
          <Reading value="--" />
        )}
      </Card>
    </div>
  );
}
