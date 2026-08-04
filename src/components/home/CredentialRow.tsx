import { useState } from 'react';
import { LiCopy, LiEye, LiEyeClosed, LiCheckCircle, LiQuestionCircle } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';

function truncateMiddle(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 6)}...${value.slice(-8)}`;
}

/**
 * One row of the connect-workers panel: a label and a value with copy, plus an
 * eye toggle for secret values (the PPLNS / FPPS passwords). Secrets show a
 * truncated preview until revealed; copy always copies the full value.
 */
/** The design's icon affordance: a 32px secondary-filled circle holding a 16px glyph. */
const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-[32px] bg-btn-secondary text-placeholder transition-colors hover:text-foreground';

export function CredentialRow({
  label,
  value,
  secret = false,
  copyable = true,
  loading = false,
  hint,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copyable?: boolean;
  loading?: boolean;
  hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shown = secret && !revealed ? truncateMiddle(value) : value;

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-1">
      <span className="flex shrink-0 items-center gap-2 text-sm leading-5 text-body-alt">
        {label}
        {hint && <LiQuestionCircle className="h-4 w-4 text-placeholder" aria-label={hint} />}
      </span>
      <div className="flex min-w-0 items-center gap-1">
        {loading ? (
          <span className="h-4 w-28 animate-pulse rounded bg-muted" />
        ) : (
          <span className="truncate text-sm leading-5 text-foreground">{shown}</span>
        )}
        {secret && !loading && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
            className={ICON_BUTTON}
          >
            {revealed ? <LiEyeClosed className="h-4 w-4" /> : <LiEye className="h-4 w-4" />}
          </button>
        )}
        {copyable && (
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${label}`}
            disabled={loading}
            className={cn(ICON_BUTTON, 'disabled:opacity-50')}
          >
            {copied ? <LiCheckCircle className="h-4 w-4 text-success" /> : <LiCopy className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
