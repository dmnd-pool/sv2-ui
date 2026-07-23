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

function EmptyRow({ empty }: { empty: PayoutsEmpty }) {
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
 * One row as a mobile card (frame 1378:87254): Date/Transaction ID/Amount on one line,
 * Mode/Payout address/Action below. The frame carries no Account field even in
 * aggregated mode (same gap as the Workers and Generated BTC mobile frames), so this
 * omits it too rather than inventing a slot for it; the mempool link and plain
 * (non-copy) address/txid text match the frame exactly.
 */
function PayoutsCard({ payout }: { payout: Payout }) {
  return (
    <div className="flex flex-col border-b border-border px-3 py-2 last:border-0">
      <div className="flex items-center gap-6">
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Date</p>
          <p className="text-sm text-foreground">{formatPayoutDate(payout.date)}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Transaction ID</p>
          <p className="font-mono text-sm text-foreground">{truncateMiddle(payout.txid, 6, 4)}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Amount</p>
          <p className="font-mono text-sm text-foreground">
            {formatBtcFromSats(payout.amountSats)} <span className="text-xs text-body-alt">BTC</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Mode</p>
          <ModeBadge mode={payout.mode} />
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Payout address</p>
          <p className="font-mono text-sm text-foreground">{truncateMiddle(payout.toAddress, 4, 4)}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs text-body-alt">Action</p>
          <a
            href={mempoolTxUrl(payout.txid)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-body-alt"
          >
            Open explorer <LiSquareShareLine className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * The payouts list: a table at sm+ (Date, [Account], Transaction ID, Amount, Mode,
 * Payout address, Action), a row-card list below sm matching frame 1378:87254.
 */
export function PayoutsTable({
  payouts,
  empty,
  showAccount = false,
}: {
  payouts: Payout[];
  empty?: PayoutsEmpty;
  /** Aggregated mode adds the paid-to account, since rows then span accounts. */
  showAccount?: boolean;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-y border-border text-xs text-body-alt">
              <th className="px-6 py-3.5 text-left font-medium">Date</th>
              {showAccount && <th className="px-6 py-3.5 text-left font-medium">Account</th>}
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
                <td colSpan={showAccount ? 7 : 6}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {payouts.map((p) => (
              <tr key={`${p.txid}-${p.toAddress}-${p.account ?? ''}`} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-foreground">{formatPayoutDate(p.date)}</td>
                {showAccount && <td className="px-6 py-3.5 text-body-alt">{p.account ?? '--'}</td>}
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
      <div className="sm:hidden">
        {payouts.length === 0 && empty && <EmptyRow empty={empty} />}
        {payouts.map((p) => (
          <PayoutsCard key={`${p.txid}-${p.toAddress}-${p.account ?? ''}`} payout={p} />
        ))}
      </div>
    </>
  );
}
