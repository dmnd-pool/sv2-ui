import { useState } from 'react';
import { LiGraphUp } from 'solar-icon-react/li';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAccountHashrateHistory, useAggregatedHashrateHistory } from '@/hooks/useAccountData';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { cn } from '@/lib/utils';
import type { HashratePoint, HashrateRange } from '@/api/types';
import { CalendarSheet } from '@/components/payouts/CalendarSheet';
import type { DateRange } from '@/lib/payoutsTable';
import { formatAxisValue, pickHashrateScale, tooltipTimestamp, xAxisTickLabel, yAxisTicks } from '@/lib/chartAxis';

const RANGES: HashrateRange[] = ['1H', '6H', '24H', '7D'];

// Series colours from the design: PPLNS blue, FPPS orange (the same on both themes).
const PPLNS_COLOR = '#2b7fff';
const FPPS_COLOR = '#e67c2a';

// The selected range chip carries a two-layer lift; the unselected ones are flat.
const ACTIVE_CHIP_SHADOW = 'shadow-[0_20px_30px_-5px_rgba(0,0,0,0.05),0_8px_20px_-6px_rgba(0,0,0,0.05)]';

// The x axis is labelled at five fixed positions rather than at every sample.
const X_TICK_COUNT = 5;

interface Series {
  key: 'pplns_hashrate' | 'fpps_hashrate';
  label: string;
  color: string;
}

const ALL_SERIES: Series[] = [
  { key: 'pplns_hashrate', label: 'PPLNS', color: PPLNS_COLOR },
  { key: 'fpps_hashrate', label: 'FPPS', color: FPPS_COLOR },
];

/** Evenly spaced timestamps across the window, so the axis never crowds. */
function pickXTicks(points: HashratePoint[]): string[] {
  if (points.length <= X_TICK_COUNT) return points.map((p) => p.observed_at);
  const last = points.length - 1;
  return Array.from({ length: X_TICK_COUNT }, (_, i) => points[Math.round((i * last) / (X_TICK_COUNT - 1))].observed_at);
}

function latest(points: HashratePoint[], key: Series['key']): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i][key];
    if (typeof value === 'number') return value;
  }
  return null;
}

/** Historical PPLNS + FPPS hashrate, with a 1H/6H/24H/7D/Custom range toggle. */
export function MiningPerformanceChart() {
  const [range, setRange] = useState<HashrateRange>('24H');
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // A chosen custom window drives the query; otherwise the active preset does.
  const customWindow = custom
    ? { from: new Date(custom.startSec * 1000).toISOString(), to: new Date(custom.endSec * 1000).toISOString() }
    : null;
  // In aggregated mode the line is every account's hashrate combined, so the chart reads
  // from the aggregated series; the two queries are cached separately so toggling never
  // shows one account's history under the combined heading.
  const { aggregated } = useAggregatedModeContext();
  const single = useAccountHashrateHistory(range, customWindow);
  const combined = useAggregatedHashrateHistory(range, customWindow, aggregated);
  const { data, isLoading } = aggregated ? combined : single;
  const points: HashratePoint[] = data ?? [];
  const isCustom = custom !== null;

  const selectPreset = (r: HashrateRange) => {
    setCustom(null);
    setRange(r);
  };

  // One unit for the whole axis: the design prints it once above the plot and leaves the
  // ticks as bare numbers, so each tick cannot pick its own unit.
  const scale = pickHashrateScale(points.flatMap((p) => [p.pplns_hashrate, p.fpps_hashrate]));
  const peak = points.reduce(
    (max, p) => Math.max(max, p.pplns_hashrate ?? 0, p.fpps_hashrate ?? 0),
    0,
  );
  const { domainMax, ticks: yTicks } = yAxisTicks(peak);
  const xTicks = pickXTicks(points);
  // "Now" is only truthful on a preset window, which always runs up to the present.
  const endsNow = !isCustom;
  // Only chart a scheme the account actually earned on, so a PPLNS-only miner gets one
  // line and one legend entry instead of a flat zero series pinned to the axis.
  const series = ALL_SERIES.filter((s) => points.some((p) => (p[s.key] ?? 0) > 0));

  // Two different empty cases. No samples at all is the first-run state and drops the
  // range control, matching the design. Samples that are all zero means the account has
  // history but nothing landed in THIS window, so the control has to stay reachable or
  // the miner cannot get back to a range that does have data.
  const hasSamples = points.length > 0;
  const hasPlot = hasSamples && peak > 0;

  return (
    <div
      className={cn(
        'relative flex flex-col border-[0.5px] border-border bg-card',
        hasSamples ? 'gap-6 p-4 lg:p-8' : 'gap-10 px-4 pb-8 pt-4 lg:px-8 lg:pb-16 lg:pt-8',
      )}
    >
      <div className={cn('flex w-full', hasSamples ? 'items-center justify-between' : 'flex-col gap-4')}>
        <div className="flex w-full items-center justify-between">
          <h3 className="!font-body text-lg font-semibold leading-7 tracking-normal text-heading-alt">
            Mining Performance
          </h3>
          {hasSamples && (
            <div className="flex items-center gap-2 rounded-sm border-[0.5px] border-border bg-muted p-0.5">
              {RANGES.map((r) => {
                const active = !isCustom && range === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => selectPreset(r)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-9 flex-col items-center justify-center px-1 py-0.5 text-center text-sm leading-5 transition-colors',
                      active
                        ? `rounded-sm bg-background text-foreground ${ACTIVE_CHIP_SHADOW}`
                        : 'rounded text-body-alt hover:text-foreground',
                    )}
                  >
                    {r}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-pressed={isCustom}
                className={cn(
                  'flex flex-col items-center justify-center px-1 py-0.5 text-center text-sm leading-5 transition-colors',
                  isCustom
                    ? `rounded-sm bg-background text-foreground ${ACTIVE_CHIP_SHADOW}`
                    : 'rounded text-body-alt hover:text-foreground',
                )}
              >
                Custom
              </button>
            </div>
          )}
        </div>
        {/* The empty state rules off the title instead of showing controls with nothing to act on. */}
        {!hasSamples && <div className="h-px w-full bg-border" />}
      </div>

      {pickerOpen && (
        <CalendarSheet
          anchorClassName="right-8 top-16"
          onCancel={() => setPickerOpen(false)}
          onDone={(r) => {
            setCustom(r);
            setPickerOpen(false);
          }}
        />
      )}

      {isLoading ? (
        <div className="h-[252px] w-full animate-pulse bg-muted" />
      ) : !hasPlot ? (
        <div className="flex flex-col items-center gap-2">
          <LiGraphUp className="h-12 w-12 opacity-[0.48]" />
          <p className="text-center text-lg font-medium leading-7 text-foreground">No performance data yet</p>
          <p className="text-center text-sm leading-5 text-body-alt">
            Historical hashrate trends will appear here once your workers begin mining.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-12">
            {series.map((s) => {
              const value = latest(points, s.key);
              return (
                <div key={s.key} className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: s.color }} />
                    <span className="text-xs leading-4 text-body-alt">{s.label}</span>
                  </div>
                  <span className="text-sm font-medium leading-5 text-body-alt">
                    {value === null ? '--' : `${formatAxisValue(value, scale.divisor)} ${scale.unit}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex w-full flex-col gap-2">
            <span className="text-sm font-medium leading-5 text-foreground">{scale.unit}</span>
            <div className="h-[252px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    {ALL_SERIES.map((s) => (
                      <linearGradient key={s.key} id={`${s.key}Fill`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  {/* syncWithTicks keeps a line per labelled tick, so no unlabelled zero line. */}
                  <CartesianGrid vertical={false} syncWithTicks stroke="hsl(var(--grid))" strokeWidth={0.5} />
                  <XAxis
                    dataKey="observed_at"
                    ticks={xTicks}
                    interval={0}
                    tickFormatter={(value: string, index: number) =>
                      xAxisTickLabel(value, index, xTicks.length - 1, { isCustom, endsNow })
                    }
                    axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--body-alt))', fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis
                    domain={[0, domainMax]}
                    ticks={yTicks}
                    tickFormatter={(value: number) => formatAxisValue(value, scale.divisor)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--body-alt))', fontSize: 12 }}
                    /* A 30px tick column, then a 16px gutter before the plot. */
                    width={46}
                    tickMargin={16}
                  />
                  <Tooltip
                    cursor={{ stroke: PPLNS_COLOR, strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="flex flex-col items-start gap-0 rounded-xl bg-tooltip px-4 py-3 shadow-2xl">
                          <p className="text-xs font-light leading-4 text-on-solid-alt">
                            {tooltipTimestamp(String(label), Date.now())}
                          </p>
                          {payload.map((entry) => {
                            const meta = ALL_SERIES.find((s) => s.key === entry.dataKey);
                            if (!meta) return null;
                            return (
                              <div key={String(entry.dataKey)} className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-[2px]"
                                    style={{ backgroundColor: meta.color }}
                                  />
                                  <span className="text-sm leading-5 text-body-alt">{meta.label}</span>
                                </div>
                                <p className="whitespace-nowrap">
                                  <span className="text-base font-semibold leading-6 text-on-solid">
                                    {formatAxisValue(Number(entry.value), scale.divisor)}
                                  </span>{' '}
                                  <span className="text-xs leading-4 text-body-alt">{scale.unit}</span>
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  {series.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill={`url(#${s.key}Fill)`}
                      activeDot={{ r: 10, fill: s.color, stroke: '#ffffff', strokeWidth: 4 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
