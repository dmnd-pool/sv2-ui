import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { AggregatedModeProvider, useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useHasSubaccounts } from '@/hooks/useSubaccounts';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AggregatedBanner } from './AggregatedBanner';

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
  return (
    <AggregatedModeProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AggregatedModeProvider>
  );
}

function DashboardShellInner({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [location] = useLocation();
  const { aggregated, setAggregated } = useAggregatedModeContext();
  // The banner only shows when the mode is genuinely available: on it is stored, but
  // a miner with no subaccounts (or one who has none anymore) should never see it.
  const { hasSubaccounts } = useHasSubaccounts();
  const showBanner = aggregated && hasSubaccounts;

  useEffect(() => writeCollapsed(collapsed), [collapsed]);

  // Close the drawer when navigating or pressing Escape.
  useEffect(() => setDrawerOpen(false), [location]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dmnd-app flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {showBanner && <AggregatedBanner onExit={() => setAggregated(false)} />}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
      <aside className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      </aside>

      {/* Mobile drawer: kept mounted so it can slide rather than pop. */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', drawerOpen ? '' : 'pointer-events-none')}>
        <div
          className={cn('absolute inset-0 bg-black/40 transition-opacity duration-200', drawerOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 shadow-xl transition-transform duration-200 ease-out',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
      </div>
    </div>
  );
}
