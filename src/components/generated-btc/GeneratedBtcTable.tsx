import { LiInfoCircle } from 'solar-icon-react/li';
import type { GeneratedBtcEntry } from '@/api/types';
import { formatHashrate } from '@/lib/utils';
import { formatGeneratedDate, formatBtc } from '@/lib/generatedBtcTable';

/** The empty message shown in the table body when the date filter excludes every row. */
export interface GeneratedBtcEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

function InfoHint({ label }: { label: string }) {
  return <LiInfoCircle className="ml-1 inline h-3.5 w-3.5 align-middle text-placeholder" aria-label={label} />;
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
function GeneratedBtcCard({ entry, showAccount }: { entry: GeneratedBtcEntry; showAccount: boolean }) {
  return (
    <div className="flex flex-col border-b border-border px-3 py-2 last:border-0">
      <div className="flex items-center gap-6">
        <div className="flex flex-1 flex-col">
          <p className="text-xs text-body-alt">Date</p>
          <p className="text-sm text-foreground">{formatGeneratedDate(entry.entry_day)}</p>
        </div>
        {showAccount && (
          <div className="flex flex-1 flex-col">
            <p className="text-xs text-body-alt">Account</p>
            <p className="text-sm text-foreground">{entry.account ?? '--'}</p>
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <p className="text-xs text-body-alt">Avg. hashrate</p>
          <p className="text-sm font-mono text-foreground">{formatHashrate(entry.hashrate)}</p>
        </div>
      </div>
      <div className="flex flex-col">
        <p className="text-xs text-body-alt">Generated BTC</p>
        <p className="font-mono text-sm text-foreground">
          {formatBtc(entry.btc_generated)} <span className="text-xs text-body-alt">BTC</span>
        </p>
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
}: {
  entries: GeneratedBtcEntry[];
  empty?: GeneratedBtcEmpty;
  /** Aggregated mode adds the owning account, since rows then span accounts. */
  showAccount?: boolean;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-y border-border text-xs text-body-alt">
              <th className="px-6 py-3.5 text-left font-medium">Date</th>
              {showAccount && <th className="px-6 py-3.5 text-left font-medium">Account</th>}
              <th className="px-6 py-3.5 text-left font-medium">
                Average hashrate
                <InfoHint label="The worker's average hashrate" />
              </th>
              <th className="px-6 py-3.5 text-left font-medium">
                Generated BTC
                <InfoHint label="The estimated amount of Bitcoin generated from accepted shares before payout adjustments." />
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && empty && (
              <tr>
                <td colSpan={showAccount ? 4 : 3}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={`${e.entry_day}-${e.account ?? ''}`} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-foreground">{formatGeneratedDate(e.entry_day)}</td>
                {showAccount && <td className="px-6 py-3.5 text-body-alt">{e.account ?? '--'}</td>}
                <td className="px-6 py-3.5 font-mono text-foreground">{formatHashrate(e.hashrate)}</td>
                <td className="px-6 py-3.5 font-mono text-foreground">
                  {formatBtc(e.btc_generated)} <span className="text-body-alt">BTC</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden">
        {entries.length === 0 && empty && <EmptyRow empty={empty} />}
        {entries.map((e) => (
          <GeneratedBtcCard key={`${e.entry_day}-${e.account ?? ''}`} entry={e} showAccount={showAccount} />
        ))}
      </div>
    </>
  );
}
