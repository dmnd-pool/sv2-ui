import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { LiHamburgerMenu, LiCloseCircle } from 'solar-icon-react/li';
import { BdEye } from 'solar-icon-react/bd';
import type { HashrateRange } from '@/api/types';
import { parseWatcherPath } from '@/lib/watcherLinks';
import { useAppliedTheme } from '@/hooks/useTheme';
import {
  useWatcherHashrate,
  useWatcherHashrateHistory,
  useWatcherWorkers,
  useWatcherGeneratedBtc,
  useWatcherFees,
  useWatcherPplnsProjection,
  type CustomWindow,
} from '@/hooks/useWatcherView';
import { hasPayablePplnsWork } from '@/lib/pplnsProjection';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';
import { WatcherHashratePanel } from '@/components/watcher-links/view/WatcherHashratePanel';
import { WatcherPerformanceChart } from '@/components/watcher-links/view/WatcherPerformanceChart';
import { WatcherWorkersSection } from '@/components/watcher-links/view/WatcherWorkersSection';
import { WatcherGeneratedBtcSection } from '@/components/watcher-links/view/WatcherGeneratedBtcSection';
import { WatcherFeesSection } from '@/components/watcher-links/view/WatcherFeesSection';
import {
  WatcherSidebar,
  WATCHER_SECTIONS,
  type WatcherSection,
} from '@/components/watcher-links/view/WatcherSidebar';

/** True when a query failed because the token does not grant that scope (or is invalid). */
function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && /no longer valid|401/.test(error.message);
}

/** The data names for the banner subtitle, e.g. "hashrate, workers and earnings". */
const SECTION_NOUNS: Record<WatcherSection, string> = {
  home: 'hashrate',
  workers: 'workers',
  generated: 'earnings',
  fees: 'fees',
  pplns: 'PPLNS projection',
};

function joinNouns(sections: WatcherSection[]): string {
  const nouns = sections.map((s) => SECTION_NOUNS[s]);
  if (nouns.length <= 1) return nouns[0] ?? '';
  return `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
}

/**
 * The public Watcher View. The token in the URL is the only credential; the page runs
 * for an anonymous visitor via the token-only client, so it can never touch the owner's
 * session. Which sections exist is driven by what the token can read: a section whose
 * fetch is rejected for lack of scope is dropped from the navigation entirely.
 */
export function WatcherView({ userId, token }: { userId: string; token: string }) {
  // Public page: apply the viewer's saved theme (default light) so the link does not
  // stay on the dark class index.html ships with.
  useAppliedTheme();
  const parsed = parseWatcherPath(userId, token);
  if (!parsed) return <WatcherInvalid />;
  return <WatcherViewInner accountId={parsed.userId} token={parsed.token} />;
}

function WatcherViewInner({ accountId, token }: { accountId: string; token: string }) {
  const [range, setRange] = useState<HashrateRange>('24H');
  const [custom, setCustom] = useState<CustomWindow | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chosen, setChosen] = useState<WatcherSection | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(true);

  const hashrate = useWatcherHashrate(token);
  const history = useWatcherHashrateHistory(token, range, custom);
  const workers = useWatcherWorkers(token);
  // Each section is attempted (not gated on a scope flag) so a link that only grants one
  // scope still renders that section instead of looking like a dead link.
  const generated = useWatcherGeneratedBtc(token, true);
  const fees = useWatcherFees(token, true);
  const pplns = useWatcherPplnsProjection(accountId, token, true);

  // A scope is granted unless its probe came back unauthorised; while a probe is still
  // loading we cannot yet tell, so navigation waits for it to settle before deciding
  // the link is dead.
  const granted = (q: { isError: boolean; error: unknown }) => !(q.isError && isUnauthorized(q.error));
  const settled =
    !hashrate.isLoading && !workers.isLoading && !generated.isLoading && !fees.isLoading && !pplns.isLoading;
  const sections: WatcherSection[] = [
    granted(hashrate) ? 'home' : null,
    granted(workers) ? 'workers' : null,
    granted(generated) ? 'generated' : null,
    granted(fees) ? 'fees' : null,
    granted(pplns) && hasPayablePplnsWork(pplns.data) ? 'pplns' : null,
  ].filter((s): s is WatcherSection => s !== null);

  const active: WatcherSection = chosen && sections.includes(chosen) ? chosen : sections[0] ?? 'home';

  // Escape closes the mobile navigation drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Only once every probe has settled can we conclude the link grants nothing readable.
  if (settled && sections.length === 0) return <WatcherInvalid />;

  const select = (s: WatcherSection) => {
    setChosen(s);
    setDrawerOpen(false);
  };

  return (
    <div className="dmnd-app flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* The Info Prompt banner (warning variant), matching the design's top strip.
          Mobile is a separate drawn variant: the copy drops a size and the Close
          control moves below the text, indented to line up with it. */}
      {noticeOpen && (
        <div className="flex shrink-0 flex-col bg-toast-warning px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-1">
            {/* The icon sits 2px low so it lines up with the title's cap height. */}
            <BdEye className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="flex min-w-0 flex-col">
              <p className="text-sm font-bold leading-5 text-foreground">Watcher View</p>
              <p className="text-xs leading-4 text-foreground sm:text-sm sm:leading-5">
                {sections.length > 0 ? `Read-only access to ${joinNouns(sections)} data` : 'Read-only access'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNoticeOpen(false)}
            aria-label="Dismiss watcher notice"
            className="ml-6 mt-1 self-start text-xs font-semibold leading-5 text-foreground transition-opacity hover:opacity-70 sm:ml-0 sm:mt-0 sm:self-auto"
          >
            Close
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden lg:block">
          <WatcherSidebar
            sections={sections}
            active={active}
            onSelect={select}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
            <div className="relative h-full w-60">
              <WatcherSidebar
                sections={sections}
                active={active}
                onSelect={select}
                collapsed={false}
                onToggleCollapse={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar: the current section name (the design's breadcrumb), plus the
              mobile trigger for the navigation drawer. */}
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-body-alt transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <LiHamburgerMenu className="h-5 w-5" />
            </button>
            <span className="text-sm text-body-alt">{WATCHER_SECTIONS[active].label}</span>
          </div>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
              {active === 'home' && (
                <section className="space-y-6">
                  <div>
                    <h1 className="text-xl font-semibold text-heading">Hashrate</h1>
                    <p className="mt-1 text-sm text-body-alt">Mining data overview.</p>
                  </div>
                  <WatcherHashratePanel
                    snapshot={hashrate.data ?? null}
                    isLoading={hashrate.isLoading}
                    isError={hashrate.isError && !isUnauthorized(hashrate.error)}
                  />
                  <WatcherPerformanceChart
                    points={history.data ?? []}
                    isLoading={history.isLoading}
                    range={range}
                    onRange={(r) => {
                      setRange(r);
                      setCustom(null); // choosing a preset clears any custom window
                    }}
                    custom={custom}
                    onCustom={setCustom}
                  />
                </section>
              )}

              {active === 'workers' && (
                <section className="space-y-6">
                  <div>
                    <h1 className="text-xl font-semibold text-heading">Workers</h1>
                    <p className="mt-1 text-sm text-body-alt">
                      Monitor connected machines, share activity, and worker health.
                    </p>
                  </div>
                  <WatcherWorkersSection
                    workers={workers.data ?? []}
                    isLoading={workers.isLoading}
                    isError={workers.isError && !isUnauthorized(workers.error)}
                  />
                </section>
              )}

              {active === 'generated' && (
                <section className="space-y-6">
                  <div>
                    <h1 className="text-xl font-semibold text-heading">Generated BTC</h1>
                    <p className="mt-1 text-sm text-body-alt">Daily Bitcoin generated from accepted shares.</p>
                  </div>
                  <WatcherGeneratedBtcSection
                    entries={generated.data ?? []}
                    isLoading={generated.isLoading}
                    isError={generated.isError && !isUnauthorized(generated.error)}
                  />
                </section>
              )}

              {active === 'fees' && (
                <section className="space-y-6">
                  <div>
                    <h1 className="text-xl font-semibold text-heading">Fees</h1>
                    <p className="mt-1 text-sm text-body-alt">View the current pool fee for this account.</p>
                  </div>
                  <WatcherFeesSection
                    fees={fees.data ?? null}
                    isLoading={fees.isLoading}
                    isError={fees.isError && !isUnauthorized(fees.error)}
                  />
                </section>
              )}

              {active === 'pplns' && (
                <section>
                  <PplnsProjectionPanel
                    projection={pplns.data}
                    isLoading={pplns.isLoading}
                    isError={pplns.isError && !isUnauthorized(pplns.error)}
                  />
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/** Shown when the link is malformed, revoked, or grants nothing readable. */
function WatcherInvalid() {
  return (
    <div className="dmnd-app flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <LiCloseCircle className="h-12 w-12 text-placeholder" />
      <div>
        <h1 className="text-xl font-semibold text-foreground">This Watcher link isn&apos;t available</h1>
        <p className="mt-2 max-w-md text-sm text-body-alt">
          The link may have been revoked or is no longer valid. Ask whoever shared it for a new one.
        </p>
      </div>
      <Link
        href="/watcher/signin"
        className="inline-flex items-center rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Enter a Watcher link
      </Link>
      <Link href="/signin" className="text-xs text-link underline underline-offset-4 hover:opacity-80">
        Sign in as a miner
      </Link>
    </div>
  );
}
