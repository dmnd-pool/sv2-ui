import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LiHamburgerMenu, LiQuestionCircle, LiBell, LiAltArrowDown, LiSettingsMinimalistic, LiLogout3 } from 'solar-icon-react/li';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/auth';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useHasSubaccounts } from '@/hooks/useSubaccounts';
import { titleForPath } from './nav';
import { accountInitials } from './accountInitials';

/**
 * The dashboard top bar: a hamburger (mobile drawer), the page title, and the
 * right-side actions: help, notifications, the theme toggle, and an account
 * avatar menu. Help links to the support page; notifications stay chrome until
 * their backend lands; the avatar menu wires the existing Settings and Logout.
 */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [location] = useLocation();
  const { session, signOut, viewingAccountId } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { aggregated, setAggregated } = useAggregatedModeContext();
  // The aggregated toggle only makes sense with more than one account to combine, so
  // it appears once the miner has subaccounts, and hides while viewing a single
  // switched-in subaccount (a subaccount has no subaccounts of its own to aggregate).
  const { hasSubaccounts } = useHasSubaccounts();
  const showToggle = hasSubaccounts && viewingAccountId === null;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-body-alt transition-colors hover:bg-muted hover:text-foreground lg:hidden"
      >
        <LiHamburgerMenu className="h-5 w-5" />
      </button>

      <h1 className="text-base font-semibold text-heading">{titleForPath(location)}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Desktop places the toggle in the top bar; on mobile it lives in the sidebar
            drawer (below the account block), where the design puts it since the mobile
            top bar has no room. */}
        {showToggle && (
          <div className="mr-1 hidden items-center gap-1.5 lg:flex">
            <span className="flex items-center gap-1 text-xs text-body-alt">
              Aggregated Dashboard
              <LiQuestionCircle className="h-4 w-4 text-placeholder" aria-hidden />
            </span>
            <Switch
              checked={aggregated}
              onCheckedChange={setAggregated}
              aria-label="Aggregated dashboard"
              className="data-[state=checked]:bg-success"
            />
          </div>
        )}
        <Link
          href="/help"
          aria-label="Help"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
        >
          <LiQuestionCircle className="h-4 w-4" />
        </Link>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
        >
          <LiBell className="h-4 w-4" />
        </button>
        <ThemeToggle />

        <div className="relative">
          <button
            type="button"
            aria-label="Account menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b7fff] text-[11px] font-semibold text-white">
              {accountInitials(session?.email)}
            </span>
            <LiAltArrowDown className="h-4 w-4 shrink-0 text-placeholder" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 z-50 mt-2 flex w-[212px] flex-col gap-1 rounded-[12px] bg-background p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                {session?.email && (
                  <>
                    <div className="flex items-center gap-1 rounded-lg px-2 py-1">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#93C5FD] bg-[#3B82F6] text-xs font-semibold leading-5 text-white">
                        {accountInitials(session.email)}
                      </span>
                      <span className="ml-1 flex min-w-0 flex-col">
                        <span className="truncate text-sm leading-5 text-foreground">{session.email.split('@')[0]}</span>
                        <span className="truncate text-xs leading-4 text-body-alt">{session.email}</span>
                      </span>
                    </div>
                    <div aria-hidden className="h-[0.5px] bg-border" />
                  </>
                )}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm leading-5 text-body-alt transition-colors hover:bg-muted"
                >
                  <LiSettingsMinimalistic className="h-4 w-4 shrink-0 text-[#525252]" />
                  <span className="ml-1">Settings</span>
                </Link>
                <div aria-hidden className="h-[0.5px] bg-border" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-xs leading-4 text-body-alt transition-colors hover:bg-muted"
                >
                  <LiLogout3 className="h-4 w-4 shrink-0 text-[#525252]" />
                  <span className="ml-1">Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
