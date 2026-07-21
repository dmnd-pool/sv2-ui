import type { ComponentType } from 'react';
import { LiHomeAngle, LiSidebarMinimalistic, LiGasStation } from 'solar-icon-react/li';
import { BdHomeAngle } from 'solar-icon-react/bd';
import { cn } from '@/lib/utils';
import { DmndLogo } from '@/components/auth/Logo';
import { MiningIcon } from '@/components/dashboard/icons/MiningIcon';
import { BitcoinCircleIcon } from '@/components/dashboard/icons/BitcoinCircleIcon';

/** The sections a watcher link can expose, in the order the sidebar lists them. */
export type WatcherSection = 'home' | 'workers' | 'generated' | 'fees';

type IconComp = ComponentType<{ className?: string }>;

interface SectionMeta {
  group: string;
  label: string;
  icon: IconComp;
  iconActive?: IconComp;
}

/** Labels, grouping, and glyphs mirror the signed-in navigation so a watcher sees the
 * same names for the same data. */
export const WATCHER_SECTIONS: Record<WatcherSection, SectionMeta> = {
  home: { group: 'Overview', label: 'Home', icon: LiHomeAngle, iconActive: BdHomeAngle },
  workers: { group: 'Mining', label: 'Workers', icon: MiningIcon },
  generated: { group: 'Mining', label: 'Generated BTC', icon: BitcoinCircleIcon },
  fees: { group: 'Mining', label: 'Fees', icon: LiGasStation },
};

function NavRow({
  section,
  active,
  collapsed,
  onSelect,
}: {
  section: WatcherSection;
  active: boolean;
  collapsed: boolean;
  onSelect: (s: WatcherSection) => void;
}) {
  const meta = WATCHER_SECTIONS[section];
  const Icon = active && meta.iconActive ? meta.iconActive : meta.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      title={collapsed ? meta.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center rounded-lg text-sm transition-colors',
        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
        active ? 'bg-muted font-medium text-foreground' : 'text-body-alt hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 text-left">{meta.label}</span>}
    </button>
  );
}

/**
 * The Watcher View's left navigation. It carries only what the link actually grants,
 * so a workers-only link shows a single Mining entry. There is no account row, no
 * settings and no logout: a watcher has no session to act on, only data to read.
 */
export function WatcherSidebar({
  sections,
  active,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  sections: WatcherSection[];
  active: WatcherSection;
  onSelect: (s: WatcherSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  // Preserve the signed-in group order (Overview before Mining) and drop any group
  // whose entries the token cannot read.
  const groups = ['Overview', 'Mining']
    .map((group) => ({ group, items: sections.filter((s) => WATCHER_SECTIONS[s].group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        {!collapsed && <DmndLogo />}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-placeholder transition-colors hover:bg-muted hover:text-foreground"
        >
          <LiSidebarMinimalistic className="h-[18px] w-[18px]" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2 pt-2">
        {groups.map((group) => (
          <div key={group.group} className="mb-5">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-placeholder">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((section) => (
                <NavRow
                  key={section}
                  section={section}
                  active={section === active}
                  collapsed={collapsed}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
