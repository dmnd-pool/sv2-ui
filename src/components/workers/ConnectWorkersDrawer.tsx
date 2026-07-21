import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LiCopy, LiCheckCircle, LiCloseCircle, LiShieldWarning, LiQuestionCircle } from 'solar-icon-react/li';
import { overlayContainer } from '@/lib/utils';
import { useAccountProfile } from '@/hooks/useAccountData';
import { POOL_URL, POOL_USERNAME_HINT, SETUP_TUTORIAL_URL } from '@/lib/poolConnection';

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
        {loading ? <span className="inline-block h-3 w-32 animate-pulse rounded bg-border align-middle" /> : value}
      </span>
      <button
        type="button"
        onClick={copy}
        disabled={loading}
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
  const { data: account, isLoading } = useAccountProfile();
  const [fppsWarning, setFppsWarning] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal out of the page's `space-y-6` wrapper (whose `> * + *` margin was
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
            <h2 className="text-lg font-semibold text-heading">Connect workers</h2>
            <p className="mt-1 text-xs text-body-alt">
              Follow these steps to connect your mining hardware or software to DMND.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex-1">
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
            description="Use the username below so your miner connects to the correct account."
          >
            {/* The pool accepts any username, so this states that rather than inventing
                a value the miner would have to match exactly. */}
            <CopyField value={POOL_USERNAME_HINT} />
          </Step>

          <Step
            index={3}
            title="Choose a payout mode"
            description="Select the password that matches your preferred payout method."
          >
            <div className="space-y-2">
              <CopyField prefix="PPLNS" value={account?.token ?? ''} loading={isLoading} />
              <CopyField
                prefix="FPPS"
                value={account?.fpps_token ?? ''}
                loading={isLoading}
                onCopied={() => setFppsWarning(true)}
              />

              {fppsWarning && (
                <div className="flex items-start gap-2 rounded-xl bg-warning/15 p-3">
                  <LiShieldWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      Make sure you have permission to use FPPS
                    </p>
                    <p className="mt-0.5 text-xs text-body-alt">
                      Using an unauthorized fallback password can cause your miner to drop connection or reject
                      shares.
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

              <p className="text-xs text-body-alt">
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
              </p>
            </div>
          </Step>

          <Step index={4} title="Start mining" description="Save the configuration and restart your miner." />
        </div>

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
