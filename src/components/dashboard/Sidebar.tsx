import { Link, useLocation } from 'wouter';
import { LiLogout3, LiAltArrowDown } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { DmndLogo } from '@/components/auth/Logo';
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from './nav';
import { accountInitials } from './accountInitials';

function NavRow({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  // The active nav icon is the filled (bold-duotone) glyph; custom icons
  // without a duotone variant fall back to their single form.
  const Icon = active && item.iconActive ? item.iconActive : item.icon;
  return (
    <Link href={item.href} onClick={onNavigate}>
      <span
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
          active ? 'bg-muted font-medium text-foreground' : 'text-body-alt hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1">{item.label}</span>
      </span>
    </Link>
  );
}

/**
 * The DMND dashboard's left navigation: brand, an account row, grouped nav
 * (Overview / Mining / Developer), and Settings + Logout pinned to the bottom.
 * `onNavigate` lets the mobile drawer close itself after a tap.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { session, signOut } = useAuth();

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center px-5">
        <DmndLogo />
      </div>

      <button
        type="button"
        className="mx-3 mb-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b7fff] text-[11px] font-semibold text-white">
          {accountInitials(session?.email)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{session?.email ?? 'Account'}</span>
        <LiAltArrowDown className="h-4 w-4 shrink-0 text-placeholder" />
      </button>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-placeholder">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} active={location === item.href} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <NavRow item={SETTINGS_ITEM} active={location === SETTINGS_ITEM.href} onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-body-alt transition-colors hover:bg-muted hover:text-foreground"
        >
          <LiLogout3 className="h-[18px] w-[18px] shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}
