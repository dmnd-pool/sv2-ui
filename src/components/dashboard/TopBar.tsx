import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { LiHamburgerMenu, LiQuestionCircle, LiAltArrowDown, LiSettingsMinimalistic, LiLogout3 } from 'solar-icon-react/li';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/auth';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { subaccountName } from '@/lib/subaccountsTable';
import { accountInitials, mainAccountName } from './accountInitials';

/**
 * The dashboard top bar: a hamburger (mobile drawer) and the
 * right-side actions: help, notifications, the theme toggle, and an account
 * avatar menu. Help links to the support page; notifications stay chrome until
 * their backend lands; the avatar menu wires the existing Settings and Logout.
 */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [location] = useLocation();
  const { session, signOut, viewingAccountId } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const { aggregated, setAggregated } = useAggregatedModeContext();
  // The aggregated toggle only makes sense with more than one account to combine, so
  // it appears once the miner has subaccounts, and hides while viewing a single
  // switched-in subaccount (a subaccount has no subaccounts of its own to aggregate).
  const { data: subaccounts } = useSubaccountList();
  const hasSubaccounts = (subaccounts?.length ?? 0) > 0;
  const selected = subaccounts?.find((account) => account.id === viewingAccountId);
  const scope = viewingAccountId ? `Subaccount: ${selected ? subaccountName(selected) : viewingAccountId}`
    : aggregated ? 'All accounts' : 'Main account';
  const showToggle = hasSubaccounts && viewingAccountId === null;
  const payoutsPage = location === '/payouts';
  const refreshSubject = payoutsPage ? 'Payouts' : location === '/subaccounts' ? 'Visible rows' : 'Live data';

  return (
    <TopBarView scope={scope} refreshIntervalMinutes={payoutsPage ? 10 : 5} refreshSubject={refreshSubject} onMenuClick={onMenuClick} actions={<>
      {/* Desktop places the toggle in the top bar; on mobile it lives in the sidebar
            drawer (below the account block), where the design puts it since the mobile
            top bar has no room. */}
      {showToggle && (
        <div data-tour="aggregated-dashboard" className="mr-1 hidden items-center gap-1.5 lg:flex">
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
        data-tour="nav:/help"
        aria-label="Help"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
      >
        <LiQuestionCircle className="h-4 w-4" />
      </Link>
      {/* <button
          type="button"
          aria-label="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-body-alt transition-colors hover:text-foreground"
        >
          <LiBell className="h-4 w-4" />
        </button> */}

    </>}>
      <div ref={accountMenuRef} className="relative">
        <button
          type="button"
          aria-label="Account menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#af1010ff] text-[11px] font-semibold text-white">
            {accountInitials(mainAccountName(session?.company_name))}
          </span>
          <LiAltArrowDown className="h-4 w-4 shrink-0 text-placeholder" />
        </button>
        {menuOpen && (
          <>
            <div className="absolute right-0 z-50 mt-2 flex w-[212px] flex-col gap-1 rounded-[12px] bg-background p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
              {session?.email && (
                <>
                  <div className="flex items-center gap-1 rounded-lg px-2 py-1">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#93C5FD] bg-[#3B82F6] text-xs font-semibold leading-5 text-white">
                      {accountInitials(mainAccountName(session.company_name))}
                    </span>
                    <span className="ml-1 flex min-w-0 flex-col">
                      <span className="truncate text-sm leading-5 text-foreground">{mainAccountName(session.company_name)}</span>
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

    </TopBarView>
  );
}

/** Shared dashboard header. Session controls are supplied only by authenticated callers. */
export function TopBarView({ title, subtitle, scope, refreshIntervalMinutes = 5, refreshSubject = 'Live data', onMenuClick, actions, children }: {
  title?: string;
  subtitle?: string;
  scope?: string;
  refreshIntervalMinutes?: number;
  refreshSubject?: string;
  onMenuClick: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-4 lg:px-6">
      <button type="button" onClick={onMenuClick} data-tour="navigation-menu" aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center rounded-lg text-body-alt transition-colors hover:bg-muted hover:text-foreground lg:hidden">
        <LiHamburgerMenu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        {scope && <p aria-label="Viewing account" title={scope === 'All accounts' ? 'Main account and all subaccounts' : scope}
          className="truncate text-xs font-medium text-foreground sm:text-sm">{scope}</p>}
        {title && <h1 className="truncate text-base font-semibold text-heading">{title}</h1>}
        {subtitle && <p className="truncate text-xs text-body-alt lg:hidden" title={subtitle}>{subtitle}</p>}
      </div>
        <p aria-label="Refresh interval" className="min-w-0 shrink truncate text-[10px] text-body-alt sm:text-xs"
          title="Live mining data refreshes every 5 minutes; payouts every 10 minutes. Account settings update when changed. Subaccounts refreshes the visible rows only.">
          <span className="hidden sm:inline">{refreshSubject} </span>refreshes every {refreshIntervalMinutes} min
        </p>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
