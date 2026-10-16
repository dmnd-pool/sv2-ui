import type { ReactNode } from 'react';
import type { PplnsProjectionDailyWork } from '@/api/types';
import { Reading } from '@/components/ui/Reading';
import { derivePplnsProjectionStats, formatPplnsDifficulty } from '@/lib/pplnsProjection';
import { formatBtcFromSats } from '@/lib/payoutsTable';

function Card({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-2 border-[0.5px] border-border bg-card p-4 lg:p-5">
      <span className="text-sm leading-5 text-body-alt">{title}</span>
      {children}
      <p className="text-sm leading-5 text-body-alt">{caption}</p>
    </div>
  );
}

/** Full-window PPLNS totals. Search and date filters only narrow the table below. */
export function PplnsProjectionStatCards({ dailyWork }: { dailyWork: PplnsProjectionDailyWork[] }) {
  const stats = derivePplnsProjectionStats(dailyWork);
  const daysCaption = `${stats.workDays} retained work day${stats.workDays === 1 ? '' : 's'}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card title="Total PPLNS value" caption="Earned plus next-block projection">
        <Reading value={formatBtcFromSats(stats.totalNetSats)} unit="BTC" />
      </Card>

      <Card title="Next-block projection" caption="Estimated if the pool finds the next block">
        <Reading value={formatBtcFromSats(stats.projectedNetSats)} unit="BTC" />
      </Card>

      <Card title="Retained work" caption={daysCaption}>
        <Reading value={formatPplnsDifficulty(stats.retainedDifficulty)} />
      </Card>
    </div>
  );
}
