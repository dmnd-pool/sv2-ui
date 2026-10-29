import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { AggregatedModeProvider, useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useHasSubaccounts, usePermissions } from '@/hooks/useSubaccounts';
import { isAggregatedRestrictedRoute, isSubaccountRestrictedRoute, PPLNS_PROJECTION_ROUTE } from './nav';
import { usePplnsReportAvailability } from '@/hooks/usePplnsProjection';
import { useAccountScope } from '@/hooks/useAccountScope';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AggregatedBanner } from './AggregatedBanner';
import { ConnectionAccountProvider } from '@/components/workers/ConnectionDetails';
import { useAuth } from '@/auth';

export const NavigationTourContext = createContext({
  navigationTourOpen: false,
  setNavigationTourOpen: (_open: boolean) => {},
});

// Persist the desktop sidebar's collapsed state so it survives reloads. Wrapped
// because storage access can throw (private mode / disabled cookies).
const COLLAPSE_KEY = 'dmnd.sidebar.collapsed';
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    // storage unavailable; collapse just won't persist
  }
}

/**
 * The frame for every DMND dashboard page: a fixed sidebar on large screens, an
 * off-canvas drawer on small ones, and a scrolling content column under the top
 * bar. The `.dmnd-app` class scopes the DMND design tokens to this subtree so
 * the dashboard matches the auth screens without touching the local views.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const { session, viewingAccountId } = useAuth();
  return (
    <AggregatedModeProvider>
      <ConnectionAccountProvider key={`${session?.accountId}:${viewingAccountId}`}>
        <DashboardShellInner>{children}</DashboardShellInner>
      </ConnectionAccountProvider>
    </AggregatedModeProvider>
  );
}

function DashboardShellInner({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { aggregated } = useAggregatedModeContext();
  const { hasSubaccounts } = useHasSubaccounts();
  const { canViewSubaccounts } = useAccountScope();
  const permissions = usePermissions();
  const pplns = usePplnsReportAvailability();
  const checkingPplnsRoute = location === PPLNS_PROJECTION_ROUTE && !pplns.hasReport;
  const restricted = (aggregated && isAggregatedRestrictedRoute(location)) ||
    (!canViewSubaccounts && isSubaccountRestrictedRoute(location));

  useEffect(() => {
    if (restricted && permissions.isSuccess) navigate('/home', { replace: true });
  }, [restricted, permissions.isSuccess, navigate]);

  useEffect(() => {
    if (checkingPplnsRoute && !pplns.isLoading && !pplns.isError) {
      navigate('/home', { replace: true });
    }
  }, [checkingPplnsRoute, pplns.isLoading, pplns.isError, navigate]);

  return (
    <DashboardFrame
      navigationKey={location}
      banner={aggregated && hasSubaccounts ? <AggregatedBanner /> : undefined}
      sidebar={(props) => <Sidebar {...props} hasPplnsReport={pplns.hasReport} />}
      topBar={(onMenuClick) => <TopBar onMenuClick={onMenuClick} />}
    >
      {restricted ? <p role="status" className="p-6 text-sm text-body-alt">{permissions.isError ? 'Unable to verify account permissions. Please reload to try again.' : 'Checking account permissions…'}</p>
        : checkingPplnsRoute ? <p role="status" className="p-6 text-sm text-body-alt">
          {pplns.isError ? <>Failed to retrieve PPLNS reports. <button type="button" className="underline" onClick={() => void pplns.refetch()}>Retry</button></> : 'Fetching PPLNS report'}
        </p> : children}
    </DashboardFrame>
  );
}

export interface SidebarFrameControls {
  collapsed: boolean;
  drawer: boolean;
  onToggleCollapse: () => void;
  onNavigate: () => void;
}

/** Shared responsive frame; credential-specific entry points supply navigation and content. */
export function DashboardFrame({ children, navigationKey, banner, sidebar, topBar }: {
  children: ReactNode;
  navigationKey: string;
  banner?: ReactNode;
  sidebar: (controls: SidebarFrameControls) => ReactNode;
  topBar: (onMenuClick: () => void) => ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navigationTourOpen, setNavigationTourOpen] = useState(false);
  const navigationTour = useMemo(() => ({ navigationTourOpen, setNavigationTourOpen }), [navigationTourOpen]);
  const showDrawer = drawerOpen || navigationTourOpen;
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => writeCollapsed(collapsed), [collapsed]);

  // Close the drawer when navigating or pressing Escape.
  useEffect(() => setDrawerOpen(false), [navigationKey]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dmnd-app flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {banner}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <aside className="hidden lg:block">
          {sidebar({ collapsed, drawer: false, onToggleCollapse: () => setCollapsed((c) => !c), onNavigate: () => setDrawerOpen(false) })}
        </aside>

        {/* Mobile drawer: kept mounted so it can slide rather than pop. */}
        <div className={cn('fixed inset-0 z-50 lg:hidden', showDrawer ? '' : 'pointer-events-none')}>
          <div
            className={cn('absolute inset-0 bg-black/40 backdrop-blur-[8px] transition-opacity duration-200', showDrawer ? 'opacity-100' : 'opacity-0')}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 shadow-xl transition-transform duration-200 ease-out',
              showDrawer ? 'translate-x-0' : '-translate-x-full',
              navigationTourOpen && 'transition-none',
            )}
          >
            {sidebar({ collapsed: false, drawer: true, onToggleCollapse: () => setDrawerOpen(false), onNavigate: () => setDrawerOpen(false) })}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {topBar(() => setDrawerOpen(true))}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-2 py-4 sm:px-3 lg:px-4 lg:py-5">
              <NavigationTourContext.Provider value={navigationTour}>
                {children}
              </NavigationTourContext.Provider>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
