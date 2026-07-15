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

/** The generated-BTC table (one page of daily rows): Date, Average hashrate, Generated BTC. */
export function GeneratedBtcTable({ entries, empty }: { entries: GeneratedBtcEntry[]; empty?: GeneratedBtcEmpty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
            <th className="px-6 py-3.5 text-left font-medium">Date</th>
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
              <td colSpan={3} className="px-6 py-12 text-center">
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
          {entries.map((e) => (
            <tr key={e.entry_day} className="border-b border-border last:border-0">
              <td className="px-6 py-3.5 text-foreground">{formatGeneratedDate(e.entry_day)}</td>
              <td className="px-6 py-3.5 font-mono text-foreground">{formatHashrate(e.hashrate)}</td>
              <td className="px-6 py-3.5 font-mono text-foreground">
                {formatBtc(e.btc_generated)} <span className="text-body-alt">BTC</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
