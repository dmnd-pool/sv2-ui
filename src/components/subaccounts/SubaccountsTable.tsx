import { LiInfoCircle, LiAltArrowDown, LiAltArrowUp } from 'solar-icon-react/li';
import { cn, formatHashrate } from '@/lib/utils';
import { formatBtc, type EnrichedSubaccount, type SubaccountSortKey, type SortDir } from '@/lib/subaccountsTable';

interface SortState {
  key: SubaccountSortKey;
  dir: SortDir;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  hint,
}: {
  label: string;
  sortKey: SubaccountSortKey;
  sort: SortState;
  onSort: (key: SubaccountSortKey) => void;
  hint?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-4 py-3 text-left font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        {hint && <LiInfoCircle className="h-3.5 w-3.5 text-placeholder" aria-label={hint} />}
        {active && (sort.dir === 'asc' ? <LiAltArrowUp className="h-3 w-3" /> : <LiAltArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

/** The subaccounts table (one page of enriched rows). Name/hashrate/rejection/earnings sort. */
export function SubaccountsTable({
  subaccounts,
  sort,
  onSort,
}: {
  subaccounts: EnrichedSubaccount[];
  sort: SortState;
  onSort: (key: SubaccountSortKey) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
            <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
            <th className="px-4 py-3 text-left font-medium">Active workers</th>
            <th className="px-4 py-3 text-left font-medium">Offline workers</th>
            <SortHeader label="Hashrate" sortKey="hashrate" sort={sort} onSort={onSort} hint="Combined hashrate for this subaccount." />
            <SortHeader
              label="Rejection rate"
              sortKey="rejection"
              sort={sort}
              onSort={onSort}
              hint="Rejected share rate over the recent window."
            />
            <SortHeader label="Today's earnings" sortKey="earnings" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {subaccounts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-body-alt">
                No subaccounts match your search.
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
