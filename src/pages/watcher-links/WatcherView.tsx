import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'wouter';
import { LiCloseCircle } from 'solar-icon-react/li';
import { BdEye } from 'solar-icon-react/bd';
import type { HashrateRange } from '@/api/types';
import { parseWatcherPath, readWatcherAccountIdentity } from '@/lib/watcherLinks';
import { useAppliedTheme } from '@/hooks/useTheme';
import {
  useWatcherHashrate,
  useWatcherTokenRevoked,
  useWatcherHashrateHistory,
  useWatcherWorkers,
  useWatcherGeneratedBtc,
  useWatcherPayouts,
  useWatcherFees,
  useWatcherShareStats,
  useWatcherPplnsProjection,
  type CustomWindow,
} from '@/hooks/useWatcherView';
import { isWatcherAccessDenied } from '@/lib/watcherQueries';
import { hasPayablePplnsWork } from '@/lib/pplnsProjection';
import { hashrateChangeFrom24HoursAgo, hashrateComparisonWindow } from '@/lib/hashrateHistory';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';
import { DashboardFrame } from '@/components/dashboard/DashboardShell';
import { SidebarView, SidebarNavItem, SidebarNavigation, AccountIdentityRow } from '@/components/dashboard/Sidebar';
import { TopBarView } from '@/components/dashboard/TopBar';
import { NAV_GROUPS } from '@/components/dashboard/nav';
import { DashboardHomeView } from '@/components/home/DashboardHomeView';
import { LiveHashrateCardView } from '@/components/home/LiveHashrateCard';
import { MiningPerformanceChartView } from '@/components/home/MiningPerformanceChart';
import { WorkerStatCardsView, WatcherDataCard, LatestPayoutCard, PoolFeeCard } from '@/components/home/WorkerStatCards';
import { WorkersContent } from '@/pages/workers/WorkersPage';
import { GeneratedBtcContent } from '@/pages/generated-btc/GeneratedBtcPage';
import { latestPayout } from '@/lib/payoutsTable';
import { PayoutsContent } from '@/pages/payouts/PayoutsPage';

const SECTION_PATHS = {
  home: '/home',
  workers: '/workers',
  generated: '/generated-bitcoin',
  payouts: '/payouts',
  pplns: '/pplns-projection',
} as const;
type WatcherSection = keyof typeof SECTION_PATHS;

/** True when a query failed because the token does not grant that scope (or is invalid). */
function isUnauthorized(error: unknown): boolean {
  return isWatcherAccessDenied(error);
}

/** Human-readable list of the data this token can read. */
function joinNouns(nouns: string[]): string {
  if (nouns.length <= 1) return nouns[0] ?? '';
  return `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
}

function subscribeToAccountLabel(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
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
  return <WatcherViewInner key={`${parsed.userId}:${parsed.token}`} accountId={parsed.userId} token={parsed.token} />;
}

function WatcherViewInner({ accountId, token }: { accountId: string; token: string }) {
  const hash = useSyncExternalStore(subscribeToAccountLabel, () => window.location.hash, () => '');
  const accountIdentity = readWatcherAccountIdentity(hash, accountId);
  const [range, setRange] = useState<HashrateRange>('24H');
  const [custom, setCustom] = useState<CustomWindow | null>(null);
  const [chosen, setChosen] = useState<WatcherSection | null>(null);

  const section = chosen ?? 'home';
  const homeVisible = section === 'home';
  const revoked = useWatcherTokenRevoked(token);
  const hashrate = useWatcherHashrate(token, !revoked, homeVisible || section === 'generated');
  const history = useWatcherHashrateHistory(token, range, custom, !revoked && hashrate.isSuccess && homeVisible);
  const now = Date.now();
  const comparisonWindow = hashrateComparisonWindow(hashrate.data?.observed_at, now);
  const comparisonHistory = useWatcherHashrateHistory(token, '24H', comparisonWindow ? {
    fromMs: Date.parse(comparisonWindow.from), toMs: Date.parse(comparisonWindow.to),
  } : null, homeVisible && hashrate.isSuccess && comparisonWindow !== null);
  const change = hashrateChangeFrom24HoursAgo(hashrate.data?.total_hashrate ?? 0, hashrate.data?.observed_at, comparisonHistory.data ?? [], now);
  const workers = useWatcherWorkers(token, true, homeVisible || section === 'workers');
  // Each section is attempted (not gated on a scope flag) so a link that only grants one
  // scope still renders that section instead of looking like a dead link.
  const generated = useWatcherGeneratedBtc(token, true, accountId, section === 'generated');
  const payouts = useWatcherPayouts(token, generated.isSuccess && !revoked, accountId, homeVisible || section === 'generated' || section === 'payouts');
  const fees = useWatcherFees(token, true, homeVisible);
  const shareStats = useWatcherShareStats(token, true, homeVisible);
  const pplns = useWatcherPplnsProjection(accountId, token, true, section === 'pplns' || section === 'generated');

  // A scope is granted unless its probe came back unauthorised; while a probe is still
  // loading we cannot yet tell, so navigation waits for it to settle before deciding
  // the link is dead.
  const granted = (q: { isError: boolean; error: unknown }) => !(q.isError && isUnauthorized(q.error));
  const canViewPayouts = generated.data !== undefined && granted(generated) && granted(payouts);
  const canViewHashrate = granted(hashrate);
  const canViewRejects = granted(shareStats);
  const canViewFees = granted(fees);
  const canViewProjection = granted(pplns) && hasPayablePplnsWork(pplns.data);
  const settled =
    !hashrate.isLoading &&
    !workers.isLoading &&
    !generated.isLoading &&
    !payouts.isLoading &&
    !fees.isLoading &&
    !shareStats.isLoading &&
    !pplns.isLoading;
  const sections: WatcherSection[] = [
    canViewHashrate || canViewRejects || canViewFees || granted(workers) || canViewPayouts ? 'home' : null,
    granted(workers) ? 'workers' : null,
    granted(generated) ? 'generated' : null,
    canViewPayouts ? 'payouts' : null,
    canViewProjection ? 'pplns' : null,
  ].filter((s): s is WatcherSection => s !== null);
  const readableData = [
    canViewHashrate ? 'hashrate' : null,
    canViewRejects ? 'rejection statistics' : null,
    canViewFees ? 'fees' : null,
    granted(workers) ? 'workers' : null,
    granted(generated) ? 'earnings' : null,
    canViewPayouts ? 'payouts' : null,
    canViewProjection ? 'PPLNS projection' : null,
  ].filter((name): name is string => name !== null);

  useEffect(() => {
    if (settled && chosen && !sections.includes(chosen)) setChosen(null);
  }, [settled, chosen, sections]);

  const active: WatcherSection = chosen && sections.includes(chosen) ? chosen : sections[0] ?? 'home';

  // Probes must settle before showing content: loading must not imply permission.
  if (revoked || (settled && sections.length === 0)) return <WatcherInvalid />;

  const payout = payouts.isSuccess ? latestPayout(payouts.data) : undefined;
  const name = accountIdentity?.kind === 'main' ? 'Main account' : accountIdentity?.name ?? 'Watcher access';
  const subtitle = accountIdentity ? (accountIdentity.kind === 'subaccount' ? 'Subaccount' : undefined) : 'Read only';
  const activePath = SECTION_PATHS[active];
  const hasWatcherData = canViewRejects;
  const inlineEarnings = !granted(workers) && canViewPayouts;
  const inlineFee = !granted(workers) && canViewFees;
  const neighboringCards = Number(hasWatcherData) + Number(inlineEarnings) + Number(inlineFee);
  const overviewCount = Number(canViewHashrate) + neighboringCards;
  // Keep live hashrate wider while distributing the remaining space evenly.
  const overviewColumns = canViewHashrate && neighboringCards > 0
    ? neighboringCards === 1 ? 'lg:grid-cols-[3fr_2fr]'
      : neighboringCards === 2 ? 'lg:grid-cols-[18fr_11fr_11fr]'
        : 'lg:grid-cols-[27fr_11fr_11fr_11fr]'
    : overviewCount === 3 ? 'lg:grid-cols-3' : overviewCount === 2 ? 'lg:grid-cols-2' : '';
  const feeCard = canViewFees ? <PoolFeeCard data={fees.data} isLoading={fees.isLoading} isError={fees.isError} /> : undefined;

  return (
    <DashboardFrame
      navigationKey={active}
      sidebar={({ collapsed, ...controls }) => (
        <SidebarView {...controls} collapsed={collapsed} account={<AccountIdentityRow name={name} subtitle={subtitle} collapsed={collapsed} subaccount={accountIdentity?.kind === 'subaccount'} />}>
          <SidebarNavigation
            collapsed={collapsed}
            groups={settled ? NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => sections.some((section) => SECTION_PATHS[section] === item.href)) })) : []}
            renderItem={(item) => (
              <SidebarNavItem item={item} active={item.href === activePath} collapsed={collapsed} onSelect={() => {
                const section = sections.find((s) => SECTION_PATHS[s] === item.href);
                if (section) setChosen(section);
                controls.onNavigate();
              }} />
            )}
          />
        </SidebarView>
      )}
      topBar={(onMenuClick) => <TopBarView refreshIntervalMinutes={active === 'payouts' ? 10 : 5} refreshSubject={active === 'payouts' ? 'Payouts' : 'Live data'} subtitle={accountIdentity?.kind === 'subaccount' ? name : undefined} onMenuClick={onMenuClick} actions={
        <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-body-alt sm:inline-flex"><BdEye className="h-4 w-4 text-warning" />Read-only watcher</span>
      } />}
    >
      {!settled ? <div aria-label="Loading watcher permissions" className="h-80 animate-pulse rounded-xl border border-border bg-muted" /> : <>
        {active === 'home' && (
          <DashboardHomeView title="Welcome" subtitle={`Read-only access to ${joinNouns(readableData)} data.`}>
            {overviewCount > 0 && (
              <div className={`grid grid-cols-1 gap-3 ${overviewColumns}`}>
                {canViewHashrate && (
                  <div className="min-w-0">
                    <LiveHashrateCardView data={hashrate.data} isLoading={hashrate.isLoading} isError={hashrate.isError} change={change} />
                  </div>
                )}
                {hasWatcherData && (
                  <div className="grid min-w-0">
                    <WatcherDataCard
                      shares={canViewRejects ? { data: shareStats.data, isLoading: shareStats.isLoading, isError: shareStats.isError } : undefined}
                    />
                  </div>
                )}
                {inlineEarnings && <div className="grid min-w-0">
                  <LatestPayoutCard payout={payout} />
                </div>}
                {inlineFee && <div className="grid min-w-0">{feeCard}</div>}
              </div>
            )}
            {granted(workers) && <WorkerStatCardsView
              workers={workers.isSuccess ? workers.data : undefined}
              hashrate={hashrate.isSuccess ? hashrate.data : undefined}
              payout={payout}
              showWorkers={granted(workers)}
              showHashrate={canViewHashrate}
              showRejection={false}
              showEarnings={canViewPayouts}
            >
              {feeCard}
            </WorkerStatCardsView>}
            {canViewHashrate && <MiningPerformanceChartView
              points={history.data ?? []}
              isLoading={history.isLoading}
              isError={history.isError}
              range={range}
              onRange={setRange}
              custom={custom ? { startSec: custom.fromMs / 1000, endSec: custom.toMs / 1000 } : null}
              onCustom={(window) => setCustom(window ? { fromMs: window.startSec * 1000, toMs: window.endSec * 1000 } : null)}
            />}
          </DashboardHomeView>
        )}
        {active === 'workers' && <WorkersContent workers={workers.data ?? []} isLoading={workers.isLoading} isError={workers.isError} onRetry={workers.refetch} />}
        {active === 'generated' && <GeneratedBtcContent projection={pplns.data} activelyMining={hashrate.data ? hashrate.data.pplns_hashrate > 0 : true} earningsUpdatedAt={generated.dataUpdatedAt} entries={generated.data ?? []} isLoading={generated.isLoading} isError={generated.isError} onRetry={generated.refetch}
          payoutProgress={canViewPayouts ? { payouts: payouts.data, isLoading: payouts.isLoading, isError: payouts.isError } : undefined} />}
        {active === 'payouts' && <PayoutsContent payouts={payouts.data ?? []} isLoading={payouts.isLoading} isError={payouts.isError} onRetry={payouts.refetch} />}
        {active === 'pplns' && <PplnsProjectionPanel projection={pplns.data} isLoading={pplns.isLoading} isError={pplns.isError} showStats selectable={false} />}
      </>}
    </DashboardFrame>
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
