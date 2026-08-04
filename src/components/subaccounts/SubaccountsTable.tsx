import { formatHashrate } from '@/lib/utils';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import { formatBtc, type EnrichedSubaccount } from '@/lib/subaccountsTable';

/** The empty message shown in the table body when a search or filter excludes every row. */
export interface SubaccountsEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/** A rejection rate as a percentage, or -- when the account has submitted no shares. */
function rejectionText(rejection: number | null): string {
  return rejection === null ? '--' : `${(rejection * 100).toFixed(1)}%`;
}

/**
 * A BTC figure: the amount at body size with the unit trailing one step smaller and in
 * the muted tone, as the design sets every BTC cell. A null total reads as unknown
 * rather than 0, which on money data would wrongly say "earned nothing".
 */
function BtcCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-body-alt">--</span>;
  return (
    <>
      <span className="text-foreground">{formatBtc(value)}</span>{' '}
      <span className="text-xs leading-4 text-body-alt">BTC</span>
    </>
  );
}

/**
 * One subaccount as a mobile card: Name / Active workers / Hashrate on the first line,
 * Rejection rate / Today's earnings / Generated BTC on the second. The mobile frame
 * draws neither the select column nor the row action, so this card carries no
 * checkbox and no Open link; a phone can still open a subaccount from the account
 * switcher in the top bar.
 */
function SubaccountCard({ subaccount }: { subaccount: EnrichedSubaccount }) {
  const cells: [string, React.ReactNode][] = [
    ['Name', <span className="font-medium text-foreground">{subaccount.name}</span>],
    ['Active workers', <span className="text-foreground">{subaccount.active}</span>],
    ['Hashrate', <span className="text-foreground">{formatHashrate(subaccount.hashrate)}</span>],
    ['Rejection rate', <span className="text-foreground">{rejectionText(subaccount.rejection)}</span>],
    ["Today's earnings", <BtcCell value={subaccount.todayEarnings} />],
    ['Generated BTC', <BtcCell value={subaccount.generatedBtc} />],
  ];
  return (
    <div className="flex flex-col gap-2 border-b-[0.5px] border-border px-3 py-3 last:border-0">
      {[cells.slice(0, 3), cells.slice(3)].map((row, i) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          {row.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col">
              <p className="truncate text-xs leading-4 text-body-alt">{label}</p>
              <p className="truncate text-sm leading-5">{value}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The subaccounts table (one page of enriched rows). Columns are not sortable by
 * header click; sorting is done through the Filter popover's "Sort by" section, to
 * match the design. Below sm the rows become cards (see SubaccountCard).
 */
export function SubaccountsTable({
  subaccounts,
  empty,
  selected,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleOne,
  onOpen,
  opening,
}: {
  subaccounts: EnrichedSubaccount[];
  empty?: SubaccountsEmpty;
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  /** Switches the dashboard to that subaccount; undefined when it cannot be opened. */
  onOpen?: (subaccount: EnrichedSubaccount) => void;
  opening: boolean;
}) {
  const emptyRow = subaccounts.length === 0 && empty && (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{empty.title}</p>
      <p className="mt-1 text-sm text-body-alt">{empty.hint}</p>
      <button
        type="button"
        onClick={empty.onClear}
        className="mt-4 inline-flex items-center rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 py-2 text-sm leading-5 text-foreground transition-colors hover:opacity-80"
      >
        {empty.clearLabel}
      </button>
    </div>
  );

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[900px] border-collapse text-sm leading-5">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              <th className="w-14 px-6 py-4">
                <CellCheckbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={onToggleAll}
                  label="Select all subaccounts"
                />
              </th>
              <th className="px-6 py-4 text-left font-normal">Name</th>
              <th className="px-6 py-4 text-left font-normal">Active workers</th>
              <th className="px-6 py-4 text-left font-normal">Hashrate</th>
              <th className="px-6 py-4 text-left font-normal">Rejection rate</th>
              <th className="px-6 py-4 text-left font-normal">Generated BTC</th>
              <th className="px-6 py-4 text-left font-normal">Today&rsquo;s earnings</th>
              <th className="px-8 py-4 text-left font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {emptyRow && (
              <tr>
                <td colSpan={8}>{emptyRow}</td>
              </tr>
            )}
            {subaccounts.map((s) => (
              <tr key={s.id} className="border-b-[0.5px] border-border last:border-0">
                <td className="px-6 py-4">
                  <CellCheckbox
                    checked={selected.has(s.id)}
                    onChange={() => onToggleOne(s.id)}
                    label={`Select ${s.name}`}
                  />
                </td>
                <td className="px-6 py-4 font-medium text-foreground">{s.name}</td>
                <td className="px-6 py-4 text-foreground">{s.active}</td>
                <td className="px-6 py-4 text-foreground">{formatHashrate(s.hashrate)}</td>
                <td className="px-6 py-4 text-foreground">{rejectionText(s.rejection)}</td>
                <td className="px-6 py-4">
                  <BtcCell value={s.generatedBtc} />
                </td>
                <td className="px-6 py-4">
                  <BtcCell value={s.todayEarnings} />
                </td>
                <td className="px-8 py-4">
                  {onOpen && (
                    <button
                      type="button"
                      onClick={() => onOpen(s)}
                      disabled={opening}
                      className="text-sm leading-5 text-foreground underline underline-offset-2 transition-opacity hover:opacity-70 disabled:opacity-40"
                    >
                      Open
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden">
        {emptyRow}
        {subaccounts.map((s) => (
          <SubaccountCard key={s.id} subaccount={s} />
        ))}
      </div>
    </>
  );
}
