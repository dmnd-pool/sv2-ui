import { useState } from 'react';
import { LiGraphUp } from 'solar-icon-react/li';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAccountHashrateHistory } from '@/hooks/useAccountData';
import { cn, formatHashrate } from '@/lib/utils';
import type { HashratePoint, HashrateRange } from '@/api/types';
import { CardEmptyState } from './CardEmptyState';

const RANGES: HashrateRange[] = ['1H', '1D', '7D', '30D'];

function formatAxisTime(value: string, range: HashrateRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return range === '1H' || range === '1D'
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const seriesLabel = (name: string | number): string => (name === 'pplns_hashrate' ? 'PPLNS' : 'FPPS');

/** Historical PPLNS + FPPS hashrate, with a 1H/1D/7D/30D range toggle. */
export function MiningPerformanceChart() {
  const [range, setRange] = useState<HashrateRange>('1D');
  const { data, isLoading } = useAccountHashrateHistory(range);
  const points: HashratePoint[] = data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Mining performance</h3>
        <div className="inline-flex items-center rounded-lg bg-muted p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                range === r ? 'bg-background text-foreground shadow-sm' : 'text-body-alt hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 h-[260px] animate-pulse rounded-lg bg-muted" />
      ) : points.length === 0 ? (
        <CardEmptyState
          icon={<LiGraphUp className="h-12 w-12" />}
          title="No performance data yet"
          subtitle="Historical hashrate trends will appear here once your workers begin mining."
        />
      ) : (
        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pplnsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fppsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="observed_at"
                tickFormatter={(value: string) => formatAxisTime(value, range)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--body-alt))', fontSize: 11 }}
                dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(value: number) => formatHashrate(value)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--body-alt))', fontSize: 11 }}
                width={76}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelFormatter={(value) => formatAxisTime(String(value), range)}
                formatter={(value, name) => [formatHashrate(Number(value)), seriesLabel(name)]}
              />
              <Legend formatter={(value) => seriesLabel(value)} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="pplns_hashrate" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#pplnsFill)" />
              <Area type="monotone" dataKey="fpps_hashrate" stroke="hsl(var(--info))" strokeWidth={2} fill="url(#fppsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
