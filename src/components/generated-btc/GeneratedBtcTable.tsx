import type { ReactNode } from 'react';
import type { GeneratedBtcEntry } from '@/api/types';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import { InfoHint } from '@/components/ui/InfoHint';
import { formatHashrate } from '@/lib/utils';
import { formatGeneratedDate, formatBtc, generatedBtcRowId } from '@/lib/generatedBtcTable';

/** The empty message shown in the table body when the date filter excludes every row. */
export interface GeneratedBtcEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/**
 * A day's generated amount. A known amount carries the BTC unit; an amount the API
 * did not report reads as a bare "--", since "-- BTC" would imply a measured zero.
 */
function BtcAmount({ amount, unitClass }: { amount: number | null | undefined; unitClass: string }) {
  if (amount == null) return <>--</>;
  return (
    <>
      {formatBtc(amount)} <span className={unitClass}>BTC</span>
    </>
  );
}

/** The empty-state block, shared by the desktop table body and the mobile card list. */
function EmptyRow({ empty }: { empty: GeneratedBtcEmpty }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{empty.title}</p>
      <p className="mt-1 text-sm text-body-alt">{empty.hint}</p>
      <button
        type="button"
        onClick={empty.onClear}
        className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        {empty.clearLabel}
      </button>
    </div>
  );
}

/**
 * One row as a mobile card (frame 1376:63577): Date/[Account]/Avg. hashrate on one
 * line, Generated BTC below. Mode and Estimated payout are drawn on this frame too but
 * stay omitted here, same as the desktop table (both unbacked by the API).
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <p className="truncate text-xs leading-4 text-body-alt">{label}</p>
      <p className="truncate text-sm leading-5 text-foreground">{children}</p>
    </div>
  );
}

function GeneratedBtcCard({ entry, showAccount }: { entry: GeneratedBtcEntry; showAccount: boolean }) {
  return (
    <div className="flex flex-col border-x-[0.5px] border-b-[0.5px] border-border px-3 py-2">
      <div className="flex min-h-[47px] items-center gap-6">
        <Field label="Date">{formatGeneratedDate(entry.entry_day)}</Field>
        {showAccount && <Field label="Account">{entry.account ?? '--'}</Field>}
        <Field label="Avg. hashrate">{formatHashrate(entry.hashrate)}</Field>
      </div>
      <div className="flex min-h-[47px] items-center gap-6">
        <Field label="Generated BTC">
          <BtcAmount amount={entry.btc_generated} unitClass="text-xs leading-4 text-body-alt" />
        </Field>
      </div>
    </div>
  );
}

/**
 * The generated-BTC list: a table at sm+ (Date, [Account], Average hashrate, Generated
 * BTC), a row-card list below sm matching frame 1376:63577. Both render the same rows,
 * just laid out differently per viewport.
 */
export function GeneratedBtcTable({
  entries,
  empty,
  showAccount = false,
  selected,
  allSelected = false,
  someSelected = false,
  onToggleAll,
  onToggleOne,
}: {
  entries: GeneratedBtcEntry[];
  empty?: GeneratedBtcEmpty;
  /** Aggregated mode adds the owning account, since rows then span accounts. */
  showAccount?: boolean;
  /**
   * Row selection, which scopes the CSV export. Omitted by the read-only watcher view,
   * which has no export and so must not show a control that does nothing.
   */
  selected?: Set<string>;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleAll?: () => void;
  onToggleOne?: (id: string) => void;
}) {
  const selectable = onToggleAll !== undefined && onToggleOne !== undefined;
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              {selectable && (
                <th className="w-14 px-0 py-4">
                  <CellCheckbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={onToggleAll}
                    label="Select all days"
                  />
                </th>
              )}
              <th className="px-6 py-4 text-left font-normal">Date</th>
              {showAccount && <th className="px-6 py-4 text-left font-normal">Account</th>}
              <th className="px-6 py-4 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  Average hashrate
                  <InfoHint text="The worker's average hashrate" />
                </span>
              </th>
              <th className="px-6 py-4 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  Generated BTC
                  <InfoHint text="The estimated amount of Bitcoin generated from accepted shares before payout adjustments." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && empty && (
              <tr>
                <td colSpan={(showAccount ? 4 : 3) + (selectable ? 1 : 0)}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={generatedBtcRowId(e)} className="border-b-[0.5px] border-border last:border-0">
                {selectable && (
                  <td className="w-14 px-0 py-4">
                    <CellCheckbox
                      checked={selected?.has(generatedBtcRowId(e)) ?? false}
                      onChange={() => onToggleOne(generatedBtcRowId(e))}
                      label={`Select ${formatGeneratedDate(e.entry_day)}`}
                    />
                  </td>
                )}
                <td className="px-6 py-4 text-foreground">{formatGeneratedDate(e.entry_day)}</td>
                {showAccount && <td className="px-6 py-4 text-foreground">{e.account ?? '--'}</td>}
                <td className="px-6 py-4 text-foreground">{formatHashrate(e.hashrate)}</td>
                <td className="px-6 py-4 text-foreground">
                  <BtcAmount amount={e.btc_generated} unitClass="text-xs leading-4 text-body-alt" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden">
        {entries.length === 0 && empty && <EmptyRow empty={empty} />}
        {entries.map((e) => (
          <GeneratedBtcCard key={generatedBtcRowId(e)} entry={e} showAccount={showAccount} />
        ))}
      </div>
    </>
  );
}
