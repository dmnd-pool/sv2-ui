import { useEffect, useState } from 'react';
import { LiCloseCircle, LiCopy, LiCheckCircle, LiSquareShareLine } from 'solar-icon-react/li';
import type { Subaccount, WatcherLink } from '@/api/types';
import { accountLabel, formatWatcherDateTime, scopeLabels, truncateToken, watcherLinkUrl, watcherUrlLabel } from '@/lib/watcherLinks';
import { RevokeWatcherLinkConfirm } from './RevokeWatcherLinkConfirm';

/** A labelled row with the value and a copy button, as used for the token and URL. */
function DetailRow({ label, value, copyValue, href }: { label: string; value: string; copyValue: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-body-alt">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 truncate font-mono text-sm text-foreground">{value}</span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${label}`}
            className="shrink-0 text-placeholder transition-colors hover:text-foreground"
          >
            <LiSquareShareLine className="h-3.5 w-3.5" />
          </a>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(copyValue);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * The details side panel for one watcher link: which account it reads, its scopes,
 * its token and URL (copyable), when it was created, and the revoke action. The
 * token is shown truncated here; the full value is only ever copied.
 */
export function WatcherLinkDetailsPanel({
  link,
  sessionAccountId,
  subaccounts,
  origin,
  onClose,
  onRevoke,
}: {
  link: WatcherLink;
  sessionAccountId: string | null;
  subaccounts: Subaccount[];
  origin: string;
  onClose: () => void;
  onRevoke: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const url = watcherLinkUrl(origin, link.user_id, link.token);
  const account = accountLabel(link.user_id, sessionAccountId, subaccounts);

  if (confirming) {
    return (
      <RevokeWatcherLinkConfirm
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          await onRevoke(link.id);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Watcher link details"
        className="relative flex max-h-full w-full max-w-[472px] flex-col overflow-y-auto rounded-bl-xl border-b border-l border-border bg-popover shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Watcher link Details</h2>
            <p className="mt-1 text-sm text-body-alt">View this Watcher link, copy its details, or disable access.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-placeholder transition-colors hover:text-foreground"
          >
            <LiCloseCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-body-alt">Account</span>
            <span className="text-sm text-foreground">{account ?? '--'}</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-body-alt">Scopes</span>
            <span className="flex flex-wrap items-center gap-1">
              {scopeLabels(link.scopes).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1 text-xs text-body-alt"
                >
                  {s}
                </span>
              ))}
            </span>
          </div>

          <DetailRow label="Token" value={truncateToken(link.token)} copyValue={link.token} />
          <DetailRow label="URL" value={watcherUrlLabel(origin, link.token)} copyValue={url} href={url} />

          <div className="flex flex-col gap-2">
            <span className="text-xs text-body-alt">Created</span>
            <span className="text-sm text-foreground">{formatWatcherDateTime(link.created_at)}</span>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-border p-6">
          <div>
            <p className="text-base font-medium text-foreground">Revoke watcher link</p>
            <p className="mt-1 text-sm text-body-alt">This watcher link will stop working immediately.</p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
