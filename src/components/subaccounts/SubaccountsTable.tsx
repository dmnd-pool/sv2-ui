import { formatHashrate } from '@/lib/utils';
import { formatBtc, type EnrichedSubaccount } from '@/lib/subaccountsTable';

/** The empty message shown in the table body when a search or filter excludes every row. */
export interface SubaccountsEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/**
 * The subaccounts table (one page of enriched rows). Columns are not sortable by
 * header click; sorting is done through the Filter popover's "Sort by" section, to
 * match the design.
 */
export function SubaccountsTable({
  subaccounts,
  empty,
}: {
  subaccounts: EnrichedSubaccount[];
  empty?: SubaccountsEmpty;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Active workers</th>
            <th className="px-4 py-3 text-left font-medium">Offline workers</th>
            <th className="px-4 py-3 text-left font-medium">Hashrate</th>
            <th className="px-4 py-3 text-left font-medium">Rejection rate</th>
            <th className="px-4 py-3 text-left font-medium">Today's earnings</th>
          </tr>
        </thead>
        <tbody>
          {subaccounts.length === 0 && empty && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center">
                <p className="text-sm font-semibold text-foreground">{empty.title}</p>
                <p className="mt-1 text-sm text-body-alt">{empty.hint}</p>
                <button
                  type="button"
                  onClick={empty.onClear}
                  className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {empty.clearLabel}
                </button>
              </td>
            </tr>
          )}
          {subaccounts.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3.5 font-medium text-foreground">{s.name}</td>
              <td className="px-4 py-3.5 text-foreground">{s.active}</td>
              <td className="px-4 py-3.5 text-foreground">
                {s.offline}
                {s.offline24h > 0 && <span className="ml-1 text-destructive">({s.offline24h} &gt;24h)</span>}
              </td>
              <td className="px-4 py-3.5 font-mono text-foreground">{formatHashrate(s.hashrate)}</td>
              <td className="px-4 py-3.5 font-mono text-foreground">
                {s.rejection === null ? '--' : `${(s.rejection * 100).toFixed(1)}%`}
              </td>
              <td className="px-4 py-3.5 font-mono text-foreground">
                {formatBtc(s.todayEarnings)} <span className="text-body-alt">BTC</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
