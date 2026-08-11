import { Link, useLocation } from 'wouter';
import { LiLogout3, LiHomeAngle, LiSettingsMinimalistic, LiSidebarMinimalistic } from 'solar-icon-react/li';
import { BdHomeAngle, BdSettingsMinimalistic } from 'solar-icon-react/bd';
import { cn } from '@/lib/utils';
import { DmndLogo } from '@/components/auth/Logo';
import { useBrokerAuth } from '@/auth';

type IconComp = React.ComponentType<{ className?: string }>;

interface BrokerNavItem {
  icon: IconComp;
  iconActive?: IconComp;
  label: string;
  href: string;
}

/**
 * A broker's whole navigation: one Overview group, then Settings and Logout. They
 * have no workers, subaccounts, payouts or watcher links to reach, so the miner
 * groups are absent rather than disabled.
 */
const OVERVIEW: BrokerNavItem[] = [
  { icon: LiHomeAngle, iconActive: BdHomeAngle, label: 'Home', href: '/broker' },
];

const SETTINGS_ITEM: BrokerNavItem = {
  icon: LiSettingsMinimalistic,
  iconActive: BdSettingsMinimalistic,
  label: 'Settings',
  href: '/broker/settings',
};

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: BrokerNavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = active && item.iconActive ? item.iconActive : item.icon;
  return (
    <Link href={item.href} onClick={onNavigate}>
      <span
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
 * The broker sidebar. Same shell as the miner's, but a broker has no account
 * switcher (they manage no subaccounts) and no aggregated mode, so those rows are
 * absent. Sign-out clears the broker session only.
 */
export function BrokerSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const { signOut } = useBrokerAuth();

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

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="mb-5">
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-placeholder">Overview</p>
          )}
          <div className="space-y-0.5">
            {OVERVIEW.map((item) => (
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
      </nav>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <NavRow
          item={SETTINGS_ITEM}
          active={location === SETTINGS_ITEM.href}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
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
