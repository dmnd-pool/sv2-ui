import { useState } from 'react';
import { LiCloseCircle, LiCopy, LiCheckCircle, LiSquareShareLine, LiDangerTriangle } from 'solar-icon-react/li';
import { modeLabel, type MultiwatcherMode } from '@/lib/multiwatcher';

/** A labelled value with a copy button; used for the multiwatcher URL and its curl command. */
function CopyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-body-alt">{label}</span>
      <span className="flex items-start gap-1.5">
        <span className="min-w-0 break-all text-sm leading-5 text-foreground underline underline-offset-2">{value}</span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${label}`}
            className="mt-0.5 shrink-0 text-placeholder transition-colors hover:text-foreground"
          >
            <LiSquareShareLine className="h-3.5 w-3.5" />
          </a>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex h-9 w-fit items-center gap-2 rounded-[32px] border-[0.5px] border-black/20 bg-btn-secondary px-5 text-sm leading-5 text-foreground transition-opacity hover:opacity-80"
      >
        {copied ? <LiCheckCircle className="h-3.5 w-3.5 text-success" /> : <LiCopy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** The reveal shown after a multiwatcher link is generated: its URL and a curl command. */
export function MultiwatcherCreated({ url, mode, onClose }: { url: string; mode: MultiwatcherMode; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b-[0.5px] border-border p-6 sm:p-8">
        <div>
          <h2 className="text-lg font-semibold text-heading">Multiwatcher link created</h2>
          <p className="mt-1 text-sm text-body-alt">Share this link to give read-only access to {modeLabel(mode)}.</p>
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
        <div className="flex gap-1 rounded-[16px] bg-toast-warning p-3">
          <LiDangerTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">Keep this link safe.</p>
            <p className="mt-1 text-sm text-body-alt">
              Anyone with it can view the selected data, and it stops working when one of its Watcher links is revoked.
            </p>
          </div>
        </div>

        <CopyRow label="URL" value={url} href={url} />
        <CopyRow label="cURL" value={`curl "${url}"`} />
      </div>

      <div className="mt-auto border-t border-border p-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-[32px] border border-black/20 bg-[hsl(var(--btn))] px-6 text-base leading-6 text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
        >
          Close
        </button>
      </div>
    </>
  );
}
