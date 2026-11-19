import type { ReactNode } from 'react';
import type { GeneratedBtcDisplayEntry } from '@/lib/generatedBtcTable';
import { InfoHint } from '@/components/ui/InfoHint';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import { formatHashrate } from '@/lib/utils';
import { formatGeneratedDate, formatBtc, generatedBtcRowId, generatedAmount, generatedHashrate } from '@/lib/generatedBtcTable';
import { DAILY_HASHRATE_HINT } from '@/lib/metricWindows';

/** The empty message shown in the table body when the date filter excludes every row. */
export interface GeneratedBtcEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/** One generated BTC amount for the selected reward scheme. */
function BtcAmount({ amount, unitClass }: { amount: number; unitClass: string }) {
  return (
    <>
      {formatBtc(amount)} <span className={unitClass}>BTC</span>
    </>
  );
}

/** The empty-state block, shared by the desktop table body and the mobile card list. */
function EmptyRow({ empty }: { empty: GeneratedBtcEmpty }) {
  return (
    <div className="px-4 py-8 text-center">
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

/** A labelled metric in the mobile earnings card. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <p className="truncate text-xs leading-4 text-body-alt">{label}</p>
      <p className="truncate text-sm leading-5 text-foreground">{children}</p>
    </div>
  );
}

function GeneratedBtcCard({ entry, showAccount, scheme }: { entry: GeneratedBtcDisplayEntry; showAccount: boolean; scheme: string }) {
  return (
    <div className="flex flex-col border-x-[0.5px] border-b-[0.5px] border-border px-3 py-2">
      <div className="flex min-h-[47px] items-center gap-6">
        <Field label="Date">{formatGeneratedDate(entry.entry_day)}</Field>
        {showAccount && <Field label="Account">{entry.account ?? '--'}</Field>}
        <Field label={`${scheme} hashrate`}>{formatHashrate(generatedHashrate(entry))}</Field>
      </div>
      <div className="flex min-h-[47px] items-center gap-6">
        <Field label="Generated BTC">
          <BtcAmount amount={generatedAmount(entry)} unitClass="text-xs leading-4 text-body-alt" />
        </Field>
      </div>
    </div>
  );
}

/** Daily hashrate and generated BTC for the selected reward scheme. */
export function GeneratedBtcTable({
  entries,
  empty,
  showAccount = false,
  scheme = 'FPPS',
  selectable = true,
  selected = new Set<string>(),
  allSelected = false,
  someSelected = false,
  onToggleAll,
  onToggleOne,
}: {
  entries: GeneratedBtcDisplayEntry[];
  empty?: GeneratedBtcEmpty;
  /** Aggregated mode adds the owning account, since rows then span accounts. */
  showAccount?: boolean;
  scheme?: 'FPPS' | 'PPLNS';
  selectable?: boolean;
  selected?: Set<string>;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleAll?: () => void;
  onToggleOne?: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              {selectable && <th className="w-14 px-0 py-3">
                <CellCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={() => onToggleAll?.()} label="Select all generated BTC" />
              </th>}
              <th className="px-4 py-3 text-left font-normal">Date</th>
              {showAccount && <th className="px-4 py-3 text-left font-normal">Account</th>}
              <th className="px-4 py-3 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  {scheme} hashrate
                  <InfoHint text={scheme === 'FPPS' ? DAILY_HASHRATE_HINT : 'Average PPLNS hashrate derived from retained work for this UTC day.'} />
                </span>
              </th>
              <th className="px-4 py-3 text-left font-normal">Generated BTC</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && empty && (
              <tr>
                <td colSpan={(showAccount ? 4 : 3) + Number(selectable)}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={generatedBtcRowId(e)} className="border-b-[0.5px] border-border last:border-0">
                {selectable && <td className="w-14 px-0 py-3">
                  <CellCheckbox checked={selected.has(generatedBtcRowId(e))} onChange={() => onToggleOne?.(generatedBtcRowId(e))} label={`Select generated BTC for ${e.entry_day}${e.account ? ` (${e.account})` : ''}`} />
                </td>}
                <td className="px-4 py-3 text-foreground">{formatGeneratedDate(e.entry_day)}</td>
                {showAccount && <td className="px-4 py-3 text-foreground">{e.account ?? '--'}</td>}
                <td className="px-4 py-3 text-foreground">{formatHashrate(generatedHashrate(e))}</td>
                <td className="px-4 py-3 text-foreground">
                  <BtcAmount amount={generatedAmount(e)} unitClass="text-xs leading-4 text-body-alt" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden">
        {selectable && entries.length > 0 && <div className="flex items-center border-b border-border p-3">
          <CellCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={() => onToggleAll?.()} label="Select all generated BTC" />
        </div>}
        {entries.length === 0 && empty && <EmptyRow empty={empty} />}
        {entries.map((e) => (
          <div key={generatedBtcRowId(e)}>
            {selectable && <div className="flex items-center px-3 pt-3">
              <CellCheckbox checked={selected.has(generatedBtcRowId(e))} onChange={() => onToggleOne?.(generatedBtcRowId(e))} label={`Select generated BTC for ${e.entry_day}${e.account ? ` (${e.account})` : ''}`} />
            </div>}
            <GeneratedBtcCard entry={e} showAccount={showAccount} scheme={scheme} />
          </div>
        ))}
      </div>
    </>
  );
}
