import { useState } from 'react';
import { Link } from 'wouter';
import { LiDangerTriangle } from 'solar-icon-react/li';
import { parseMultiwatcherPath, modeLabel } from '@/lib/multiwatcher';
import { MultiwatcherAccountCard } from '@/components/watcher-links/view/MultiwatcherAccountCard';
import { useAppliedTheme } from '@/hooks/useTheme';

/**
 * The public multiwatcher view. The mode and the (account, token) pairs are read from
 * the URL tail; each account is rendered read-only from its own token via the
 * token-only client, so the owner's session is never touched. Which data shows per
 * account follows the enforcement mode the link was created with.
 */
export function MultiwatcherView({ rest }: { rest: string }) {
  // Public page: apply the viewer's saved theme (default light) rather than staying on
  // the dark class index.html ships with.
  useAppliedTheme();
  const [noticeOpen, setNoticeOpen] = useState(true);
  const segments = rest.split('/').filter(Boolean).map(decodeURIComponent);
  const parsed = parseMultiwatcherPath(segments);
  if (!parsed) return <MultiwatcherInvalid />;

  const { mode, entries } = parsed;
  const showHashrate = mode === 'hashrate' || mode === 'both';
  const showGenerated = mode === 'generated_btc' || mode === 'both';

  return (
    <div className="dmnd-app min-h-screen bg-background">
      {noticeOpen && (
        <div className="flex items-center justify-between gap-4 bg-warning/10 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2">
            <LiDangerTriangle className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">Multiwatcher View</p>
              <p className="text-xs text-body-alt">Read-only access to {modeLabel(mode)} across {entries.length} account{entries.length === 1 ? '' : 's'}.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNoticeOpen(false)}
            aria-label="Dismiss multiwatcher notice"
            className="text-sm font-medium text-body-alt transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
        {entries.map((e) => (
          <MultiwatcherAccountCard
            key={`${e.userId}-${e.token}`}
            token={e.token}
            accountId={e.userId}
            showHashrate={showHashrate}
            showGenerated={showGenerated}
          />
        ))}
      </div>
    </div>
  );
}

function MultiwatcherInvalid() {
  return (
    <div className="dmnd-app flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <LiDangerTriangle className="h-12 w-12 text-placeholder" />
      <div>
        <h1 className="text-xl font-semibold text-foreground">This link isn't available</h1>
        <p className="mt-2 max-w-md text-sm text-body-alt">
          The multiwatcher link may be incomplete or one of its Watcher links was revoked.
        </p>
      </div>
      <Link
        href="/signin"
        className="inline-flex items-center rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Go to sign in
      </Link>
    </div>
  );
}
