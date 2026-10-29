import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { LiLogout3, LiSidebarMinimalistic, LiAltArrowUp, LiAltArrowDown } from 'solar-icon-react/li';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { DmndLogo } from '@/components/auth/Logo';
import { Switch } from '@/components/ui/switch';
import { TooltipPill } from '@/components/ui/tooltip-pill';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useHasSubaccounts } from '@/hooks/useSubaccounts';
import { useAccountScope } from '@/hooks/useAccountScope';
import {
  NAV_GROUPS,
  SETTINGS_ITEM,
  PPLNS_PROJECTION_ROUTE,
  isPathActive,
  isAggregatedRestrictedRoute,
  isSubaccountRestrictedRoute,
  type NavItem,
} from './nav';
import { AccountSwitcher } from './AccountSwitcher';
import { accountInitials } from './accountInitials';

function NavDropdown({
  item,
  location,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  location: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const children = item.children ?? [];
  // Open while the reader is on one of its pages, so the trail back is always visible.
  const [open, setOpen] = useState(() => children.some((c) => isPathActive(location, c.href)));
  const Icon = item.icon;

  if (collapsed) {
    // The rail has no room for the sub-items, but the parent now has a useful
    // overview page.
    return (
      <Link href={item.href} onClick={onNavigate}>
        <span
          title={item.label}
          className="flex items-center justify-center rounded-lg px-0 py-2 text-sm text-body-alt transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
        </span>
      </Link>
    );
  }

  return (
    <div>
      <div className="flex items-center rounded-lg px-3 py-2 text-sm text-body-alt transition-colors hover:bg-muted hover:text-foreground">
        <Link href={item.href} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate text-xs font-medium uppercase tracking-wider">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
          className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-body-alt transition-colors hover:text-foreground"
        >
          {open ? <LiAltArrowUp className="h-4 w-4" /> : <LiAltArrowDown className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="space-y-0.5">
          {children.map((child) => (
            <Link key={child.href} href={child.href} onClick={onNavigate} data-tour={`nav:${child.href}`}>
              <span
                className={cn(
                  // The drawn sub-row keeps an empty 20px slot where the parent's icon
                  // sits, so the labels align in a single column.
                  'flex items-center gap-2 rounded-lg py-2 pl-[38px] pr-3 text-sm transition-colors',
                  isPathActive(location, child.href)
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-body-alt hover:bg-muted hover:text-foreground',
                )}
              >
                {child.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarNavItem({
  item,
  active,
  collapsed,
  onNavigate,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  onSelect?: () => void;
}) {
  // The active nav icon is the filled (bold-duotone) glyph; custom icons
  // without a duotone variant fall back to their single form.
  const Icon = active && item.iconActive ? item.iconActive : item.icon;
  if (item.image && !collapsed) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="-mx-2 block rounded-sm px-0 py-2 hover:bg-muted"
      >
        <img src={item.image} alt={item.label} className="h-auto w-full dark:invert dark:hue-rotate-180" />
      </a>
    );
  }
  const row = (
    <span
      className={cn(
        'flex items-center text-sm leading-5 transition-colors',
        collapsed ? 'justify-center rounded-sm px-0 py-2' : 'gap-2 p-2',
        active
          ? 'rounded-[32px] bg-muted font-semibold text-foreground'
          : 'rounded-sm text-body-alt hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1">{item.label}</span>}
    </span>
  );
  if (onSelect) {
    const button = (
      <button type="button" onClick={onSelect} aria-current={active ? 'page' : undefined} aria-label={item.label} className="block w-full text-left">
        {row}
      </button>
    );
    return collapsed ? <TooltipPill label={item.label} side="right" emphasis>{button}</TooltipPill> : button;
  }
  if (item.external) {
    const link = (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="block">
        {row}
      </a>
    );
    return collapsed ? (
      <TooltipPill label={item.label} side="right" emphasis>
        {link}
      </TooltipPill>
    ) : (
      link
    );
  }
  return (
    <Link href={item.href} onClick={onNavigate}>
      {/* Collapsed hides the label, so the design reveals it in the tooltip pill
          beside the rail rather than the browser's own title bubble. */}
      {collapsed ? (
        <TooltipPill label={item.label} side="right" emphasis>
          {row}
        </TooltipPill>
      ) : (
        row
      )}
    </Link>
  );
}

/**
 * The DMND dashboard's left navigation: brand, an account row, grouped nav
 * (Overview / Mining / Monitoring), and Settings + Logout pinned to the bottom.
 * `collapsed` renders an icon-only rail (desktop); `onToggleCollapse` shows the
 * collapse control. `onNavigate` lets the mobile drawer close itself after a tap.
 */
export function Sidebar({
  hasPplnsReport,
  collapsed = false,
  drawer = false,
  onToggleCollapse,
  onNavigate,
}: {
  hasPplnsReport: boolean;
  collapsed?: boolean;
  /** The mobile drawer is wider than the docked rail and pads tighter. */
  drawer?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const { signOut, viewingAccountId } = useAuth();
  const { hasSubaccounts } = useHasSubaccounts();
  const { aggregated, setAggregated } = useAggregatedModeContext();
  // Aggregating only makes sense while viewing the main account; a subaccount has no
  // subaccounts of its own to combine.
  const showToggle = hasSubaccounts && viewingAccountId === null;
  // A subaccount cannot reach the subaccounts page, so its nav entry is dropped rather
  // than left to lead somewhere it has no permission for.
  const { canViewSubaccounts } = useAccountScope();

  return (
    <SidebarView collapsed={collapsed} drawer={drawer} onToggleCollapse={onToggleCollapse} account={
      <>
        {/* With subaccounts the account block becomes the switcher; without them there is
          nothing to switch to, so it stays a plain identity row. */}
        {hasSubaccounts ? (
          <AccountSwitcher collapsed={collapsed} />
        ) : (
          <AccountIdentityRow name="Main account" initials="M" collapsed={collapsed} />
        )}

        {/* The design puts the aggregated toggle in the drawer on mobile; the top bar
          carries it on desktop, where there is room for the label. */}
        {showToggle && !collapsed && (
          <div data-tour="aggregated-dashboard" className="mx-3 mb-3 flex items-center justify-between gap-2 px-2.5 lg:hidden">
            <span className="text-sm text-foreground">Aggregated dashboard</span>
            <Switch
              checked={aggregated}
              onCheckedChange={setAggregated}
              aria-label="Aggregated dashboard"
              className="data-[state=checked]:bg-success"
            />
          </div>
        )}
      </>
    }>
      <SidebarNavigation
        collapsed={collapsed}
        groups={NAV_GROUPS.map((group) => ({
          ...group, items: group.items.filter((item) =>
            (canViewSubaccounts || !isSubaccountRestrictedRoute(item.href)) &&
            (hasPplnsReport || item.href !== PPLNS_PROJECTION_ROUTE) &&
            (!aggregated || !isAggregatedRestrictedRoute(item.href))
          )
        }))}
        renderItem={(item) => item.children ? (
          <NavDropdown item={item} location={location} collapsed={collapsed} onNavigate={onNavigate} />
        ) : (
          <SidebarNavItem item={item} active={location === item.href} collapsed={collapsed} onNavigate={onNavigate} />
        )}
      />

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <div data-tour={`nav:${SETTINGS_ITEM.href}`}>
          <SidebarNavItem item={SETTINGS_ITEM} active={location === SETTINGS_ITEM.href} collapsed={collapsed} onNavigate={onNavigate} />
        </div>
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

    </SidebarView>
  );
}

/** Brand, collapse control and spacing shared by all dashboard navigation. No account queries. */
export function SidebarView({ collapsed = false, drawer = false, onToggleCollapse, account, children }: {
  collapsed?: boolean;
  drawer?: boolean;
  onToggleCollapse?: () => void;
  account: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col border-r-[0.5px] border-border bg-background transition-[width] duration-200',
        drawer ? 'w-[300px]' : collapsed ? 'w-16' : 'w-[236px]',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-between gap-1 px-1' : 'justify-between px-5')}>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'DMND: expand navigation' : 'DMND: collapse navigation'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className={cn(
              'flex shrink-0 items-center justify-center rounded transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              collapsed ? 'h-8 w-7 [&_img]:h-3' : 'h-8',
            )}
          >
            <DmndLogo />
          </button>
        ) : !collapsed && <DmndLogo />}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-8 shrink-0 items-center justify-center rounded-lg text-placeholder transition-colors hover:bg-muted hover:text-foreground',
              collapsed ? 'w-6' : 'w-8',
            )}
          >
            <LiSidebarMinimalistic className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>


      {account}
      {children}
    </div>
  );
}

/** Account identity without account switching or authenticated data access. */
export function AccountIdentityRow({ name, subtitle, initials, collapsed = false, subaccount = false }: {
  name: string;
  subtitle?: string;
  initials?: string;
  collapsed?: boolean;
  subaccount?: boolean;
}) {
  return (
    <div title={subtitle ? `${name} — ${subtitle}` : name} className={cn('mx-3 mb-3 flex items-center rounded-lg text-left', collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2')}>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white', subaccount ? 'bg-[#d946ef]' : 'bg-[#2b7fff]')}>
        {initials ?? (subaccount ? name.slice(0, 1).toUpperCase() : accountInitials(name))}
      </span>
      {!collapsed && <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        {subtitle && <span className="truncate text-xs text-body-alt" title={subtitle}>{subtitle}</span>}
      </span>}
    </div>
  );
}

/** One grouped navigation layout for both sessions and restricted tokens. */
export function SidebarNavigation({ groups, collapsed, renderItem }: {
  groups: { label: string; items: NavItem[] }[];
  collapsed?: boolean;
  renderItem: (item: NavItem) => ReactNode;
}) {
  return <nav className="flex-1 overflow-y-auto px-3 pb-2">
    {groups.filter((group) => group.items.length > 0).map((group) => (
      <div key={group.label} className="mb-5">
        {!collapsed && <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-placeholder">{group.label}</p>}
        <div className="space-y-0.5">{group.items.map((item) => <div key={item.href} data-tour={`nav:${item.href}`}>{renderItem(item)}</div>)}</div>
      </div>
    ))}
  </nav>;
}
