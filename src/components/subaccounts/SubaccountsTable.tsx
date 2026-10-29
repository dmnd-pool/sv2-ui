import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiCheckCircle, LiCopy, LiKey } from 'solar-icon-react/li';
import { cn, formatHashrate, overlayContainer } from '@/lib/utils';
import { CellCheckbox } from '@/components/ui/CellCheckbox';
import { InfoHint } from '@/components/ui/InfoHint';
import { formatBtc, type EnrichedSubaccount } from '@/lib/subaccountsTable';
import { truncateMiddle } from '@/lib/payoutsTable';
import { ACCOUNT_REJECTION_HINT, LIVE_HASHRATE_HINT } from '@/lib/metricWindows';

/** The empty message shown in the table body when a search or filter excludes every row. */
export interface SubaccountsEmpty {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

/** A rejection rate as a percentage, or -- when the account has submitted no shares. */
function rejectionText(rejection: number | null): string {
  return rejection === null ? '--' : `${(rejection * 100).toFixed(2)}%`;
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

const SECRET_BUTTON =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-btn-secondary text-placeholder transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40';

function PasswordRow({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  const available = Boolean(value);
  const copy = () => {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs leading-4 text-body-alt">{label}</span>
      <span
        title={value ?? undefined}
        className={cn('min-w-0 flex-1 truncate font-mono text-xs', !available && 'font-sans text-body-alt')}
      >
        {available ? truncateMiddle(value as string, 8, 6) : 'Not available'}
      </span>
      <button
        type="button"
        onClick={copy}
        disabled={!available}
        aria-label={`Copy ${label} password`}
        className={SECRET_BUTTON}
      >
        {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function PasswordCell({ subaccount }: { subaccount: EnrichedSubaccount }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const PANEL_WIDTH = 288;

  const toggle = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (open) {
      setOpen(false);
      return;
    }
    // Keep the panel inside the viewport when the column sits near the right edge.
    setAt({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 12) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-xs leading-4 text-body-alt transition-colors hover:bg-muted hover:text-foreground"
      >
        <LiKey className="h-3.5 w-3.5" />
        View
      </button>
      {open &&
        at &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Mining passwords for ${subaccount.name}`}
            style={{ top: at.top, left: at.left, width: PANEL_WIDTH }}
            className="fixed z-50 flex flex-col gap-3 rounded-2xl border-[0.5px] border-border bg-card p-4 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
          >
            <p className="text-xs leading-4 text-body-alt">Mining passwords</p>
            <PasswordRow label="PPLNS" value={subaccount.pplnsPassword} />
            <PasswordRow label="FPPS" value={subaccount.fppsPassword} />
          </div>,
          overlayContainer(),
        )}
    </>
  );
}

/**
 * One subaccount as a mobile card: Name / Hashrate on the first line,
 * Rejection rate / Today’s generated BTC on the second. The mobile frame
 * draws neither the select column nor the row action, so this card carries no
 * checkbox and no switch action; a phone can still switch accounts from the account
 * switcher in the top bar.
 */
function SubaccountCard({ subaccount }: { subaccount: EnrichedSubaccount }) {
  const cells: [string, React.ReactNode][] = [
    ['Name', <span className="font-medium text-foreground">{subaccount.name}</span>],
    ['Hashrate', <span className="text-foreground">{formatHashrate(subaccount.hashrate)}</span>],
    ['Rejection rate', <span className="text-foreground">{rejectionText(subaccount.rejection)}</span>],
    ['Today’s generated BTC', <BtcCell value={subaccount.todayEarnings} />],
  ];
  return (
    <div className="flex flex-col gap-2 border-b-[0.5px] border-border px-3 py-3 last:border-0">
      {[cells.slice(0, 2), cells.slice(2)].map((row, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          {row.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col">
              <p className="truncate text-xs leading-4 text-body-alt">{label}</p>
              <p className="truncate text-sm leading-5">{value}</p>
            </div>
          ))}
        </div>
      ))}
      <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
        <p className="text-xs leading-4 text-body-alt">Passwords</p>
        <PasswordCell subaccount={subaccount} />
      </div>
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
    <div className="px-4 py-8 text-center">
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
        <table className="w-full min-w-[820px] border-collapse text-sm leading-5">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-muted text-sm leading-5 text-body-alt">
              <th className="w-14 px-3 py-3">
                <CellCheckbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={onToggleAll}
                  label="Select all subaccounts"
                />
              </th>
              <th className="px-3 py-3 text-left font-normal">Name</th>
              <th className="px-3 py-3 text-left font-normal">
                <span className="inline-flex items-center gap-2">Hashrate <InfoHint text={LIVE_HASHRATE_HINT} /></span>
              </th>
              <th className="px-3 py-3 text-left font-normal">Password</th>
              <th className="px-3 py-3 text-left font-normal">
                <span className="inline-flex items-center gap-2">Rejection <InfoHint text={ACCOUNT_REJECTION_HINT} /></span>
              </th>
              <th className="px-3 py-3 text-left font-normal">Today’s generated BTC</th>
              <th className="px-4 py-3 text-left font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {emptyRow && (
              <tr>
                <td colSpan={7}>{emptyRow}</td>
              </tr>
            )}
            {subaccounts.map((s) => (
              <tr key={s.id} className="border-b-[0.5px] border-border last:border-0">
                <td className="px-3 py-3">
                  <CellCheckbox
                    checked={selected.has(s.id)}
                    onChange={() => onToggleOne(s.id)}
                    label={`Select ${s.name}`}
                  />
                </td>
                <td className="px-3 py-3 font-medium text-foreground">{s.name}</td>
                <td className="px-3 py-3 text-foreground">{formatHashrate(s.hashrate)}</td>
                <td className="px-3 py-3 text-foreground"><PasswordCell subaccount={s} /></td>
                <td className="px-3 py-3 text-foreground">{rejectionText(s.rejection)}</td>
                <td className="px-3 py-3">
                  <BtcCell value={s.todayEarnings} />
                </td>
                <td className="px-4 py-3">
                  {onOpen && (
                    <button
                      type="button"
                      onClick={() => onOpen(s)}
                      disabled={opening}
                      className="text-sm leading-5 text-foreground underline underline-offset-2 transition-opacity hover:opacity-70 disabled:opacity-40"
                    >
                      Switch to account
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
