import { Link, useLocation } from 'wouter';
import { LiLogout3, LiAltArrowDown, LiSidebarMinimalistic } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { DmndLogo } from '@/components/auth/Logo';
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from './nav';
import { accountInitials } from './accountInitials';

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  // The active nav icon is the filled (bold-duotone) glyph; custom icons
  // without a duotone variant fall back to their single form.
  const Icon = active && item.iconActive ? item.iconActive : item.icon;
  return (
    <Link href={item.href} onClick={onNavigate}>
      <span
        // When collapsed the label is hidden, so the title gives a hover tooltip.
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center rounded-lg text-sm transition-colors',
          collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          active ? 'bg-muted font-medium text-foreground' : 'text-body-alt hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="flex-1">{item.label}</span>}
      </span>
    </Link>
  );
}

/**
 * The DMND dashboard's left navigation: brand, an account row, grouped nav
 * (Overview / Mining / Developer), and Settings + Logout pinned to the bottom.
 * `collapsed` renders an icon-only rail (desktop); `onToggleCollapse` shows the
 * collapse control. `onNavigate` lets the mobile drawer close itself after a tap.
 */
export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const { session, signOut } = useAuth();

  return (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        {!collapsed && <DmndLogo />}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-placeholder transition-colors hover:bg-muted hover:text-foreground"
          >
            <LiSidebarMinimalistic className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <button
        type="button"
        title={collapsed ? (session?.email ?? 'Account') : undefined}
        className={cn(
          'mx-3 mb-3 flex items-center rounded-lg text-left transition-colors hover:bg-muted',
          collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b7fff] text-[11px] font-semibold text-white">
          {accountInitials(session?.email)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{session?.email ?? 'Account'}</span>
            <LiAltArrowDown className="h-4 w-4 shrink-0 text-placeholder" />
          </>
        )}
      </button>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-placeholder">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={location === item.href}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <NavRow item={SETTINGS_ITEM} active={location === SETTINGS_ITEM.href} collapsed={collapsed} onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => signOut()}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg text-sm text-body-alt transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <LiLogout3 className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </div>
  );
}
