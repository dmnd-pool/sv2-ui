import * as Popover from '@radix-ui/react-popover';
import { Copy, Download, ChevronDown } from 'lucide-react';
import { CONNECTION_SAFETY_WARNING, connectionDetailsToText, downloadConnectionDetails } from '@/components/workers/ConnectionDetails';
import { useToast } from '@/components/ui/toast';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LiCopy, LiCheckCircle, LiCloseCircle, LiShieldWarning, LiQuestionCircle } from 'solar-icon-react/li';
import { overlayContainer } from '@/lib/utils';
import { useConnectionAccount } from '@/components/workers/ConnectionDetails';
import { ConnectionAccountControl } from './ConnectionDetails';
import { POOL_URL, POOL_USERNAME_HINT } from '@/lib/poolConnection';

/** A boxed value with a Copy button, as the drawer's steps show credentials. */
function CopyField({
  value,
  prefix,
  loading = false,
  onCopied,
}: {
  value: string;
  prefix?: string;
  loading?: boolean;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Clear the "Copied" label after a moment, cancelling the timer if the drawer
  // closes first so it never fires on an unmounted row.
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    onCopied?.();
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted py-1.5 pl-3 pr-1.5">
      {/* The design puts a question-circle ahead of each payout-mode password. No
          tooltip copy is drawn for it, so it stays decorative and the adjacent
          "Watch our learning resource" prompt carries the explanation. */}
      {prefix && <LiQuestionCircle className="h-3.5 w-3.5 shrink-0 text-placeholder" aria-hidden />}
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
        {prefix && <span className="text-body-alt">{prefix}: </span>}
        {loading ? <span className="inline-block h-3 w-32 animate-pulse rounded bg-border align-middle" /> : value || 'Not available'}
      </span>
      <button
        type="button"
        onClick={copy}
        disabled={loading || !value}
        aria-label={`Copy ${prefix ?? 'value'}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-border disabled:opacity-50"
      >
        {copied ? 'Copied' : 'Copy'}
        {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/** One numbered step: the index badge, a title, a description and its content. */
function Step({ index, title, description, children }: { index: number; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border py-4 last:border-0">
      <span className="mt-0.5 shrink-0 text-sm text-body-alt">{index}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold text-heading">{title}</p>
          <p className="mt-0.5 text-xs text-body-alt">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The "Connect workers" setup guide: a right-side drawer walking a miner through
 * pointing hardware at the pool. The credentials come from the account profile, so the
 * values are the miner's real ones. Copying the FPPS password raises a permission
 * warning, since using it without permission gets the miner's shares rejected.
 */
export function ConnectWorkersDrawer({ onClose }: { onClose: () => void }) {
  const { account, accountName, aggregated } = useConnectionAccount();
  const [fppsWarning, setFppsWarning] = useState(false);

  useEffect(() => {
    if (aggregated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, aggregated]);

  if (aggregated) return null;

  // Portal out of the page's spacing wrapper (whose `> * + *` margin would be
  // offsetting this fixed overlay) into the themed shell, which keeps the design
  // tokens in scope. See overlayContainer.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect workers"
        className="relative flex h-full w-full max-w-[472px] flex-col overflow-y-auto bg-popover p-8 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">{!aggregated && accountName ? `Connect workers to ${accountName}` : 'Connect workers'}</h2>
            <p className="mt-1 text-xs text-body-alt">
              {aggregated ? 'Choose the account you want to connect your miner to.' : 'Follow these steps to connect your miner.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          <ConnectionExportActions key={account?.id ?? 'none'} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-5 w-5" />
          </button>
          </div>
        </div>

        <div className="mt-4"><ConnectionAccountControl /></div>
        {account && <div key={account.id} className="mt-4 flex-1">
          <Step
            index={1}
            title="Configure your miner"
            description="Open your miner's configuration page and enter the pool URL."
          >
            <CopyField value={POOL_URL} />
          </Step>

          <Step
            index={2}
            title="Enter your username"
            description="Use any worker name or leave it empty."
          >
            {/* The pool accepts any username, so this states that rather than inventing
                a value the miner would have to match exactly. */}
            <p className="text-sm text-foreground">{POOL_USERNAME_HINT}</p>
          </Step>

          <Step
            index={3}
            title="Choose a payout mode"
            description={`Use a password for ${account.name}. Your payout-mode password identifies the account.`}
          >
            <div className="space-y-2">
              <CopyField prefix="PPLNS" value={account.pplnsPassword} />
              <CopyField
                prefix="FPPS"
                value={account.fppsPassword ?? ''}
                onCopied={() => setFppsWarning(true)}
              />

              {fppsWarning && (
                <div className="flex items-start gap-2 rounded-xl bg-warning/15 p-3">
                  <LiShieldWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      Only use FPPS if you have permission to do so.
                    </p>
                    <p className="mt-0.5 text-xs text-body-alt">
                      Using an unauthorized password can cause your miner to drop connection or change its payout mode.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFppsWarning(false)}
                    aria-label="Dismiss warning"
                    className="shrink-0 text-placeholder transition-colors hover:text-foreground"
                  >
                    <LiCloseCircle className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* <p className="text-xs text-body-alt">
                Not sure which one to choose?{' '}
                {SETUP_TUTORIAL_URL ? (
                  <a
                    href={SETUP_TUTORIAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info underline underline-offset-2"
                  >
                    Watch our learning resource
                  </a>
                ) : (
                  // No confirmed tutorial URL yet, so the prompt shows without linking
                  // to a page that would not resolve.
                  <span className="text-info">Watch our learning resource</span>
                )}
              </p> */}
            </div>
          </Step>

          <Step index={4} title="Start mining" description="Save the configuration and restart your miner." />
        </div>}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-[hsl(var(--btn))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>,
    overlayContainer(),
  );
}

/** Export happens only on an explicit click; credentials stay out of URLs. */
function ConnectionExportActions() {
  const { account, options, currentId, currentName, canExportOtherAccounts, loadExportAccounts } = useConnectionAccount();
  const [targetId, setTargetId] = useState(account?.id ?? currentId ?? '');
  const id = useId();
  const targets = canExportOtherAccounts ? options : currentId ? [{ id: currentId, name: currentName }] : [];
  const available = targetId === 'all' ? canExportOtherAccounts : targets.some((target) => target.id === targetId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const toast = useToast();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const exportDetails = async (copy: boolean) => {
    if (busy || !available) return;
    setBusy(true);
    setStatus('');
    try {
      const accounts = await loadExportAccounts(targetId);
      if (!mounted.current) return;
      const content = connectionDetailsToText(accounts);
      if (copy) {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable. Download the details instead.');
        await navigator.clipboard.writeText(content);
      } else {
        downloadConnectionDetails(content);
      }
      toast({ type: 'success', message: copy ? 'Copied. Share securely and clear your clipboard afterwards.' : 'Downloaded. Save the file securely.' });
      setOpen(false);
    } catch {
      setStatus(copy ? 'Could not copy details. Try downloading instead.' : 'Could not export all requested details. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const actionClass = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-40';
  return <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setStatus(''); }}>
    <Popover.Trigger asChild>
      <button type="button" aria-label="Export worker connection details" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-info px-3 text-xs font-medium text-info-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-popover">
        Export <ChevronDown className="h-3 w-3" />
      </button>
    </Popover.Trigger>
    <Popover.Portal container={overlayContainer()}>
      <Popover.Content align="end" sideOffset={8} collisionPadding={16} aria-label="Export connection details"
        className="z-[60] max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[calc(100vw-32px)] space-y-2 overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-xl">
        <p className="rounded-lg bg-warning/10 p-2.5 text-xs text-body-alt">{CONNECTION_SAFETY_WARNING}</p>
        <div>
          <label htmlFor={id} className="block px-1 pb-1.5 text-xs font-medium text-body-alt">Account to export</label>
          <select id={id} value={available ? targetId : ''} onChange={(event) => { setTargetId(event.target.value); setStatus(''); }} disabled={busy}
            className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="" disabled>Select an account</option>
            {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
            {canExportOtherAccounts && options.length > 1 && <option value="all">All accounts</option>}
          </select>
          <button type="button" disabled={busy || !available} onClick={() => void exportDetails(false)} className={actionClass}><Download className="h-4 w-4" />Download details</button>
          <button type="button" disabled={busy || !available} onClick={() => void exportDetails(true)} className={actionClass}><Copy className="h-4 w-4" />Copy to share</button>
        </div>
        {busy && <p role="status" className="px-3 text-xs text-body-alt">Preparing details…</p>}
        {status && <p role="status" className="px-3 text-xs text-destructive">{status}</p>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
