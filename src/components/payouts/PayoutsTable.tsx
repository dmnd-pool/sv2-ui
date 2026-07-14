import { useState } from 'react';
import { LiSquareShareLine, LiCopy, LiCheckCircle } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import {
  formatBtcFromSats,
  formatPayoutDate,
  truncateMiddle,
  mempoolTxUrl,
  type Payout,
} from '@/lib/payoutsTable';

/** The PPLNS / FPPS outline badge in the Mode column. */
function ModeBadge({ mode }: { mode: 'pplns' | 'fpps' }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border px-3 py-1 text-xs font-medium text-body-alt">
      {mode.toUpperCase()}
    </span>
  );
}

/**
 * The truncated transaction id with a copy-to-clipboard button that copies the full
 * id. The button is hidden at rest and revealed on hover or keyboard focus; once
 * copied it stays visible briefly to confirm.
 */
function TxidCell({ txid }: { txid: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(txid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="group/txid inline-flex items-center gap-1.5">
      <span className="font-mono">{truncateMiddle(txid, 6, 4)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Transaction ID copied' : 'Copy transaction ID'}
        className={cn(
          'shrink-0 text-placeholder transition-opacity hover:text-foreground',
          // Hidden at rest so the cell matches the design; revealed on hover or
          // keyboard focus. On touch devices (no hover) it stays visible, and once
          // copied it stays visible briefly to confirm.
          copied
            ? 'opacity-100'
            : 'opacity-0 focus-visible:opacity-100 group-hover/txid:opacity-100 [@media(hover:none)]:opacity-100',
        )}
      >
        {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

/** The empty message shown in the table body when a search or filter excludes every row. */
export interface PayoutsEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/** The payouts table (one page of rows): Date, Transaction ID, Amount, Mode, Payout address, Action. */
export function PayoutsTable({ payouts, empty }: { payouts: Payout[]; empty?: PayoutsEmpty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-xs text-body-alt">
            <th className="px-6 py-3.5 text-left font-medium">Date</th>
            <th className="px-6 py-3.5 text-left font-medium">Transaction ID</th>
            <th className="px-6 py-3.5 text-left font-medium">Amount</th>
            <th className="px-6 py-3.5 text-left font-medium">Mode</th>
            <th className="px-6 py-3.5 text-left font-medium">Payout address</th>
            <th className="px-6 py-3.5 text-left font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {payouts.length === 0 && empty && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center">
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
          {payouts.map((p) => (
            <tr key={`${p.txid}-${p.toAddress}`} className="border-b border-border last:border-0">
              <td className="px-6 py-3.5 text-foreground">{formatPayoutDate(p.date)}</td>
              <td className="px-6 py-3.5 text-foreground">
                <TxidCell txid={p.txid} />
              </td>
              <td className="px-6 py-3.5 font-mono text-foreground">
                {formatBtcFromSats(p.amountSats)} <span className="text-body-alt">BTC</span>
              </td>
              <td className="px-6 py-3.5">
                <ModeBadge mode={p.mode} />
              </td>
              <td className="px-6 py-3.5 font-mono text-foreground">{truncateMiddle(p.toAddress, 4, 4)}</td>
              <td className="px-6 py-3.5">
                <a
                  href={mempoolTxUrl(p.txid)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-body-alt"
                >
                  Open explorer <LiSquareShareLine className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
