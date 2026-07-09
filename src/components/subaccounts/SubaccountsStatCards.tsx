import type { ReactNode } from 'react';
import { LiInfoCircle } from 'solar-icon-react/li';
import { formatHashrate } from '@/lib/utils';
import { formatBtc, type SubaccountsPageStats } from '@/lib/subaccountsTable';

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-body-alt">{title}</span>
        {hint && <LiInfoCircle className="h-3.5 w-3.5 text-placeholder" aria-label={hint} />}
      </div>
      {children}
    </div>
  );
}

/** Total subaccounts / Active workers / Combined hashrate / Today's total earnings. */
export function SubaccountsStatCards({ stats }: { stats: SubaccountsPageStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Total subaccounts">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{stats.total}</p>
        <p className="mt-1 text-xs text-body-alt">Mining operations</p>
      </Card>

      <Card title="Active workers" hint="Connected workers summed across every subaccount.">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{stats.activeWorkers}</p>
        <p className="mt-1 text-xs text-body-alt">Across all subaccounts</p>
      </Card>

      <Card title="Combined hashrate">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">{formatHashrate(stats.combinedHashrate)}</p>
        <p className="mt-1 text-xs text-body-alt">Across all subaccounts</p>
      </Card>

      <Card title="Today's total earnings">
        <p className="mt-2 font-mono text-2xl font-semibold text-heading">
          {formatBtc(stats.todayEarnings)}
          <span className="ml-1 text-base font-normal text-body-alt">BTC</span>
        </p>
        <p className="mt-1 text-xs text-body-alt">Generated across all subaccounts</p>
      </Card>
    </div>
  );
}
