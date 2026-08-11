import { useState, type ReactNode } from 'react';
import { LiHamburgerMenu } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { BrokerSidebar } from './BrokerSidebar';

/**
 * The broker dashboard shell: sidebar, top bar and the page column.
 *
 * At mobile widths the sidebar becomes a drawer behind the hamburger. The frames
 * draw the hamburger but no drawer, and a broker's only route to Logout is the
 * sidebar, so without one they could not sign out on a phone at all; the drawer
 * reuses the same sidebar rather than inventing a second navigation surface.
 */
export function BrokerShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="dmnd-app flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <aside className="hidden lg:block">
          <BrokerSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
        </aside>

        {/* Kept mounted so it slides rather than pops. */}
        <div className={cn('fixed inset-0 z-50 lg:hidden', drawerOpen ? '' : 'pointer-events-none')}>
          <div
            className={cn(
              'absolute inset-0 bg-black/40 transition-opacity duration-200',
              drawerOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 shadow-xl transition-transform duration-200 ease-out',
              drawerOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <BrokerSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="flex h-8 w-8 items-center justify-center rounded-[32px] bg-btn-secondary text-body-alt transition-opacity hover:opacity-80 lg:hidden"
            >
              <LiHamburgerMenu className="h-4 w-4" />
            </button>
            <span className="hidden text-sm leading-5 text-body-alt lg:block">Home</span>
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
