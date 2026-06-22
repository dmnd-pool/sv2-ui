import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LiHamburgerMenu, LiQuestionCircle, LiBell, LiAltArrowDown, LiSettingsMinimalistic, LiLogout3 } from 'solar-icon-react/li';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { useAuth } from '@/auth';
import { titleForPath } from './nav';
import { accountInitials } from './accountInitials';

/**
 * The dashboard top bar: a hamburger (mobile drawer), the page title, and the
 * right-side actions: help, notifications, the theme toggle, and an account
 * avatar menu. Help and notifications are chrome until
 * their backends land; the avatar menu wires the existing Settings and Logout.
 */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [location] = useLocation();
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <button
          type="button"
          aria-label="Help"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
        >
          <LiQuestionCircle className="h-4 w-4" />
        </button>
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
              <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
                {session?.email && (
                  <p className="truncate px-3 py-2 text-xs text-body-alt">{session.email}</p>
                )}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <LiSettingsMinimalistic className="h-4 w-4 shrink-0" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <LiLogout3 className="h-4 w-4 shrink-0" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
