import { Link } from 'wouter';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { LiAltArrowRight } from 'solar-icon-react/li';
import { InfoHint } from '@/components/ui/InfoHint';
import { formatHashrate } from '@/lib/utils';
import type { DonutSlice } from '@/lib/aggregatedStats';

// Slice colors in the order the design assigns them, cycling for further subaccounts.
const SLICE_COLORS = ['#d946ef', '#22c55e', '#3b82f6', '#f97316'];

/** Split "89.00 TH/s" so the value and its unit can be sized separately. */
function splitHashrate(value: number): { amount: string; unit: string } {
  const [amount, unit] = formatHashrate(value).split(' ');
  return { amount: amount ?? '0', unit: unit ?? 'H/s' };
}

/**
 * Aggregated hashrate across every subaccount: a donut of each account's share with
 * the combined total in the middle, and a legend listing what each contributes. Shown
 * only in aggregated mode, where combining accounts is the point.
 */
export function CombinedHashrateCard({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const totalParts = splitHashrate(total);
  // Recharts renders nothing for an all-zero dataset, so a roster that has not mined
  // yet still gets a ring: every account contributes an equal, visibly empty share.
  const hasHashrate = slices.some((s) => s.hashrate > 0);
  const chartData = hasHashrate ? slices : slices.map((s) => ({ ...s, hashrate: 1 }));

  return (
    <div className="flex flex-col items-start gap-6 rounded-xl border border-border bg-card p-5 sm:flex-row sm:gap-12">
      <div className="relative h-40 w-40 shrink-0 self-center sm:self-start">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="hashrate"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {chartData.map((s, i) => (
                <Cell key={s.id} fill={hasHashrate ? SLICE_COLORS[i % SLICE_COLORS.length] : 'hsl(var(--border))'} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-3xl font-semibold text-foreground">{totalParts.amount}</span>
          <span className="text-xs text-placeholder">{totalParts.unit}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 self-stretch">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-heading">Combined Hashrate</h3>
            <InfoHint text="The total hashrate from all connected workers and subaccounts." />
          </span>
          <Link
            href="/subaccounts"
            className="flex shrink-0 items-center gap-1 text-sm text-foreground transition-colors hover:text-body-alt"
          >
            View subaccounts
            <LiAltArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ul className="flex flex-col gap-2">
          {slices.map((s, i) => {
            const parts = splitHashrate(s.hashrate);
            return (
              <li key={s.id} className="flex flex-col gap-2">
                {i > 0 && <span aria-hidden className="h-px w-full bg-border" />}
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                    />
                    <span className="truncate text-sm text-body-alt">{s.name}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    <span className="text-base text-foreground">{parts.amount} </span>
                    <span className="text-xs text-body-alt">{parts.unit}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
