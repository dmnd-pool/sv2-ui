import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, formatHashrate } from '@/lib/utils';
import type { HashratePoint, HashrateRange } from '@/api/types';
import { downsampleHashrate } from '@/lib/hashrateHistory';
import { Calendar } from '@/components/payouts/Calendar';
import type { CustomWindow } from '@/hooks/useWatcherView';

const RANGES: HashrateRange[] = ['1H', '6H', '24H', '7D'];

// The two series' colours come straight from the design: PPLNS blue, FPPS orange.
const PPLNS_COLOR = '#2b7fff';
const FPPS_COLOR = '#e67c2a';

function formatAxisTime(value: string, range: HashrateRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Intraday ranges read as clock times; a multi-day range reads as dates.
  return range === '7D'
    ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const seriesLabel = (name: string | number): string => (name === 'pplns_hashrate' ? 'PPLNS' : 'FPPS');

/**
 * The read-only mining-performance chart for the Watcher View. It takes its points as
 * a prop (fed by the token-only client) rather than calling an account hook, so the
 * public page never reaches the owner's authenticated data.
 */
export function WatcherPerformanceChart({
  points,
  isLoading,
  range,
  onRange,
  custom,
  onCustom,
}: {
  points: HashratePoint[];
  isLoading: boolean;
  range: HashrateRange;
  onRange: (r: HashrateRange) => void;
  /** The active custom window, or null when a preset range is selected. */
  custom: CustomWindow | null;
  onCustom: (window: CustomWindow) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const data = downsampleHashrate(points, 300);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Mining Performance</h3>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRange(r)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                // A preset is only "selected" when no custom window overrides it.
                custom === null && range === r ? 'bg-muted text-foreground' : 'text-body-alt hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              custom !== null ? 'bg-muted text-foreground' : 'text-body-alt hover:text-foreground',
            )}
          >
            Custom
          </button>
        </div>
      </div>

      {calendarOpen && (
        <Calendar
          onCancel={() => setCalendarOpen(false)}
          onDone={(r) => {
            setCalendarOpen(false);
            onCustom({ fromMs: r.startSec * 1000, toMs: r.endSec * 1000 });
          }}
        />
      )}

      {isLoading ? (
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-64 items-center justify-center text-sm text-body-alt">
          No hashrate history to show yet.
        </div>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="watcher-pplns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PPLNS_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PPLNS_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="watcher-fpps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FPPS_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={FPPS_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="observed_at"
                tickFormatter={(v) => formatAxisTime(v, range)}
                tick={{ fill: 'hsl(var(--body-alt))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v) => formatHashrate(v)}
                tick={{ fill: 'hsl(var(--body-alt))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number, name) => [formatHashrate(value), seriesLabel(name)]}
                labelFormatter={(v) => formatAxisTime(String(v), range)}
              />
              <Legend formatter={(value) => seriesLabel(value)} iconType="circle" />
              <Area
                type="monotone"
                dataKey="pplns_hashrate"
                stroke={PPLNS_COLOR}
                fill="url(#watcher-pplns)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="fpps_hashrate"
                stroke={FPPS_COLOR}
                fill="url(#watcher-fpps)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
