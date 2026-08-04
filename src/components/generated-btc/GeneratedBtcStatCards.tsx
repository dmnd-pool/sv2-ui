import type { ReactNode } from 'react';
import { Reading } from '@/components/ui/Reading';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { formatBtc } from '@/lib/generatedBtcTable';

/**
 * A stat card. Same shell and type ramp as the home, workers and subaccounts cards so
 * the pages cannot drift apart, except that this page sets its unit one step larger
 * (18/28) than they do, which is how the frame draws it.
 */
function Card({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-6 border-[0.5px] border-border bg-card p-4 lg:p-8">
      <span className="text-sm leading-5 text-body-alt">{title}</span>
      <div className="flex flex-col gap-1">
        {children}
        <p className="text-sm leading-5 text-body-alt">{sub}</p>
      </div>
    </div>
  );
}

/** Generated BTC (total) / Average hashrate / Active workers. */
export function GeneratedBtcStatCards({
  generated,
  averageHashrate,
  activeWorkers,
}: {
  generated: number;
  averageHashrate: number;
  activeWorkers: number;
}) {
  // One unit for the hashrate figure, matching how every other hashrate reading is set.
  const scale = pickHashrateScale([averageHashrate]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Generated BTC" sub="Total Bitcoin generated">
        <Reading value={formatBtc(generated)} unit="BTC" unitSize="lg" />
      </Card>

      <Card title="Average hashrate" sub="Average hashrate across workers">
        <Reading value={formatAxisValue(averageHashrate, scale.divisor)} unit={scale.unit} unitSize="lg" />
      </Card>

      <Card title="Active workers" sub="Workers that submitted shares">
        <Reading value={activeWorkers} />
      </Card>
    </div>
  );
}
