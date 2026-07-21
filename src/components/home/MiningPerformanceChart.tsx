import { useState } from 'react';
import { LiGraphUp } from 'solar-icon-react/li';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAccountHashrateHistory } from '@/hooks/useAccountData';
import { cn, formatHashrate } from '@/lib/utils';
import type { HashratePoint, HashrateRange } from '@/api/types';
import { Calendar } from '@/components/payouts/Calendar';
import type { DateRange } from '@/lib/payoutsTable';
import { CardEmptyState } from './CardEmptyState';

const RANGES: HashrateRange[] = ['1H', '6H', '24H', '7D'];

// A custom span (multiple days) reads as dates; the short presets read as time.
function formatAxisTime(value: string, isCustom: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return isCustom
    ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const seriesLabel = (name: string | number): string => (name === 'pplns_hashrate' ? 'PPLNS' : 'FPPS');

// Series colours from the design: PPLNS blue, FPPS orange (the same on both themes).
const PPLNS_COLOR = '#2b7fff';
const FPPS_COLOR = '#e67c2a';

/** Historical PPLNS + FPPS hashrate, with a 1H/6H/24H/7D/Custom range toggle. */
export function MiningPerformanceChart() {
  const [range, setRange] = useState<HashrateRange>('24H');
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // A chosen custom window drives the query; otherwise the active preset does.
  const customWindow = custom
    ? { from: new Date(custom.startSec * 1000).toISOString(), to: new Date(custom.endSec * 1000).toISOString() }
    : null;
  const { data, isLoading } = useAccountHashrateHistory(range, customWindow);
  const points: HashratePoint[] = data ?? [];
  const isCustom = custom !== null;

  const selectPreset = (r: HashrateRange) => {
    setCustom(null);
    setRange(r);
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Mining Performance</h3>
        <div className="inline-flex items-center rounded-lg bg-muted p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => selectPreset(r)}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                !isCustom && range === r ? 'bg-background text-foreground shadow-sm' : 'text-body-alt hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors',
              isCustom ? 'bg-background text-foreground shadow-sm' : 'text-body-alt hover:text-foreground',
            )}
          >
            Custom
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="absolute right-5 top-14 z-20 rounded-2xl border border-border bg-popover p-4 shadow-xl">
          <Calendar
            onCancel={() => setPickerOpen(false)}
            onDone={(r) => {
              setCustom(r);
              setPickerOpen(false);
            }}
          />
        </div>
      )}

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
                  <stop offset="5%" stopColor={PPLNS_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PPLNS_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fppsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FPPS_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={FPPS_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="observed_at"
                tickFormatter={(value: string) => formatAxisTime(value, isCustom)}
                minTickGap={48}
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
                labelFormatter={(value) => formatAxisTime(String(value), isCustom)}
                formatter={(value, name) => [formatHashrate(Number(value)), seriesLabel(name)]}
              />
              <Legend formatter={(value) => seriesLabel(value)} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="pplns_hashrate" stroke={PPLNS_COLOR} strokeWidth={2} fill="url(#pplnsFill)" />
              <Area type="monotone" dataKey="fpps_hashrate" stroke={FPPS_COLOR} strokeWidth={2} fill="url(#fppsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
