import type { ReactNode } from 'react';
import { formatHashrate } from '@/lib/utils';
import { formatBtc } from '@/lib/generatedBtcTable';

function Card({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <span className="text-sm text-body-alt">{title}</span>
      {children}
      <p className="mt-1 text-xs text-body-alt">{sub}</p>
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
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Generated BTC" sub="Total Bitcoin generated">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">
          {formatBtc(generated)}
          <span className="ml-1 text-base font-normal text-body-alt">BTC</span>
        </p>
      </Card>

      <Card title="Average hashrate" sub="Average hashrate across workers">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{formatHashrate(averageHashrate)}</p>
      </Card>

      <Card title="Active workers" sub="Workers that submitted shares">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{activeWorkers}</p>
      </Card>
    </div>
  );
}
