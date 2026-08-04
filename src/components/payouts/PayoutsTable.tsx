import { useState } from 'react';
import { LiSquareShareLine, LiCopy, LiCheckCircle } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import {
  formatBtcFromSats,
  formatPayoutDate,
  payoutRowId,
  truncateMiddle,
  mempoolTxUrl,
  type Payout,
} from '@/lib/payoutsTable';

/** The PPLNS / FPPS outline badge in the Mode column. */
function ModeBadge({ mode }: { mode: 'pplns' | 'fpps' }) {
  return (
    <span className="inline-flex h-6 items-center rounded-lg border-[0.5px] border-border px-3 text-xs leading-4 text-body-alt">
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
      <span>{truncateMiddle(txid, 6, 4)}</span>
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
    <div className="flex flex-col gap-1 border-x-[0.5px] border-b-[0.5px] border-border px-3 py-2">
      <div className="flex items-center gap-6">
        <div className="flex shrink-0 flex-col">
          <p className="text-xs leading-4 text-body-alt">Date</p>
          <p className="text-sm leading-5 text-foreground">{formatPayoutDate(payout.date)}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs leading-4 text-body-alt">Transaction ID</p>
          <p className="text-sm leading-5 text-foreground">{truncateMiddle(payout.txid, 6, 4)}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs leading-4 text-body-alt">Amount</p>
          <p className="text-sm leading-5 text-foreground">
            {formatBtcFromSats(payout.amountSats)} <span className="text-xs leading-4 text-body-alt">BTC</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex shrink-0 flex-col">
          <p className="text-xs leading-4 text-body-alt">Mode</p>
          <ModeBadge mode={payout.mode} />
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs leading-4 text-body-alt">Payout address</p>
          <p className="text-sm leading-5 text-foreground">{truncateMiddle(payout.toAddress, 4, 4)}</p>
        </div>
        <div className="flex shrink-0 flex-col">
          <p className="text-xs leading-4 text-body-alt">Action</p>
          <a
            href={mempoolTxUrl(payout.txid)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm leading-5 text-foreground underline underline-offset-2 transition-opacity hover:opacity-70"
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
  selected,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleOne,
}: {
  payouts: Payout[];
  empty?: PayoutsEmpty;
  /** Aggregated mode adds the paid-to account, since rows then span accounts. */
  showAccount?: boolean;
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              <th className="w-14 px-0 py-4">
                <CellCheckbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={onToggleAll}
                  label="Select all payouts"
                />
              </th>
              <th className="px-6 py-4 text-left font-normal">Date</th>
              {showAccount && <th className="px-6 py-4 text-left font-normal">Account</th>}
              <th className="px-6 py-4 text-left font-normal">Transaction ID</th>
              <th className="px-6 py-4 text-left font-normal">Amount</th>
              <th className="px-6 py-4 text-left font-normal">Mode</th>
              <th className="px-6 py-4 text-left font-normal">Payout address</th>
              <th className="px-6 py-4 text-left font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 && empty && (
              <tr>
                <td colSpan={showAccount ? 8 : 7}>
                  <EmptyRow empty={empty} />
                </td>
              </tr>
            )}
            {payouts.map((p) => (
              <tr key={payoutRowId(p)} className="border-b-[0.5px] border-border last:border-0">
                <td className="w-14 px-0 py-4">
                  <CellCheckbox
                    checked={selected.has(payoutRowId(p))}
                    onChange={() => onToggleOne(payoutRowId(p))}
                    label={`Select payout ${truncateMiddle(p.txid, 6, 4)}`}
                  />
                </td>
                <td className="px-6 py-4 text-foreground">{formatPayoutDate(p.date)}</td>
                {/* Plain text in the body colour, as drawn -- the design gives the account
                    no badge or chip, and no different weight from the other values. */}
                {showAccount && <td className="px-6 py-4 text-foreground">{p.account ?? '--'}</td>}
                <td className="px-6 py-4 text-foreground">
                  <TxidCell txid={p.txid} />
                </td>
                <td className="px-6 py-4 text-foreground">
                  {formatBtcFromSats(p.amountSats)}{' '}
                  <span className="text-xs leading-4 text-body-alt">BTC</span>
                </td>
                <td className="px-6 py-4">
                  <ModeBadge mode={p.mode} />
                </td>
                <td className="px-6 py-4 text-foreground">{truncateMiddle(p.toAddress, 4, 4)}</td>
                <td className="px-8 py-4">
                  <a
                    href={mempoolTxUrl(p.txid)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm leading-5 text-foreground underline underline-offset-2 transition-opacity hover:opacity-70"
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
          <PayoutsCard key={payoutRowId(p)} payout={p} />
        ))}
      </div>
    </>
  );
}
