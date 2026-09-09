import { Link } from 'wouter';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { LiAltArrowRight } from 'solar-icon-react/li';
import { InfoHint } from '@/components/ui/InfoHint';
import { formatHashrate } from '@/lib/utils';
import { sliceColor, type DonutSlice } from '@/lib/aggregatedStats';

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

  const heading = (
    <span className="flex items-center gap-2">
      <h3 className="!font-body text-lg font-semibold leading-7 text-heading-alt">Combined Live Hashrate</h3>
      <InfoHint text="The total hashrate from all connected workers and subaccounts." />
    </span>
  );

  const totalValue = (
    <span className="flex flex-col items-center gap-0.5">
      <span className="font-heading text-3xl font-semibold leading-10 text-foreground">{totalParts.amount}</span>
      <span className="text-xs leading-4 text-secondary-label">{totalParts.unit}</span>
    </span>
  );

  const hasHashrate = total > 0 && slices.length > 0;

  return (
    <div className="relative flex h-full flex-col items-start gap-6 border-[0.5px] border-border bg-card p-4 lg:p-8 sm:flex-row sm:gap-12">
      <div className="relative h-40 w-40 shrink-0 self-center sm:self-start">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="hashrate"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell key={s.id} fill={sliceColor(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {hasHashrate && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">{totalValue}</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 self-stretch">
        <div className="flex items-center justify-between gap-3">
          {heading}
          {hasHashrate && (
            <Link
              href="/subaccounts"
              className="flex shrink-0 items-center gap-1 text-sm text-foreground transition-colors hover:text-body-alt"
            >
              View subaccounts
              <LiAltArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {hasHashrate && (
          <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
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
                        style={{ backgroundColor: sliceColor(i) }}
                      />
                      <span className="truncate text-sm leading-5 text-body-alt">{s.name}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap">
                      <span className="text-base font-medium leading-6 text-foreground">{parts.amount} </span>
                      <span className="text-xs leading-4 text-body-alt">{parts.unit}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!hasHashrate && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">{totalValue}</div>
      )}
    </div>
  );
}
