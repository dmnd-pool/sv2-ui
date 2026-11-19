import type { ReactNode } from 'react';
import type { PplnsProjectionDailyWork } from '@/api/types';
import { Reading } from '@/components/ui/Reading';
import { derivePplnsProjectionStats, formatPplnsAverageHashrate, formatPplnsDifficulty } from '@/lib/pplnsProjection';
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
export function PplnsProjectionStatCards({ dailyWork, aggregated = false }: { dailyWork: PplnsProjectionDailyWork[]; aggregated?: boolean }) {
  const stats = derivePplnsProjectionStats(dailyWork);
  const daysCaption = `${stats.workDays} retained work day${stats.workDays === 1 ? '' : 's'}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Estimated total if a block were found now" caption="Not paid yet. Final only when the pool finds a block.">
        <Reading value={formatBtcFromSats(stats.totalNetSats)} unit="BTC" />
      </Card>

      <Card title="Average PPLNS hashrate" caption={aggregated ? 'Combined rate across retained days' : 'Across retained work days'}>
        <Reading value={stats.workDays > 0 ? formatPplnsAverageHashrate(stats.retainedDifficulty / stats.workDays) : '--'} />
      </Card>

      <Card title="Next block estimate" caption="Your potential reward, excluding earnings from earlier blocks.">
        <Reading value={formatBtcFromSats(stats.projectedNetSats)} unit="BTC" />
      </Card>

      <Card title="Retained work" caption={aggregated ? `${daysCaption} across all accounts` : daysCaption}>
        <Reading value={formatPplnsDifficulty(stats.retainedDifficulty)} />
      </Card>

    </div>
  );
}
