import type { ComponentType } from 'react';
import { LiHomeAngle, LiLayersMinimalistic, LiWallet, LiKeyMinimalistic, LiSettingsMinimalistic } from 'solar-icon-react/li';
import { BdHomeAngle, BdLayersMinimalistic, BdWallet, BdKeyMinimalistic, BdSettingsMinimalistic } from 'solar-icon-react/bd';
import { MiningIcon } from './icons/MiningIcon';
import { CoinsIcon } from './icons/CoinsIcon';

type IconComp = ComponentType<{ className?: string }>;

export interface NavItem {
  /** Resting glyph: a solar outline icon, or a custom DMND glyph. */
  icon: IconComp;
  /** Bold-duotone glyph for the active state; falls back to `icon` when absent. */
  iconActive?: IconComp;
  label: string;
  href: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ icon: LiHomeAngle, iconActive: BdHomeAngle, label: 'Home', href: '/home' }] },
  {
    label: 'Mining',
    items: [
      { icon: MiningIcon, label: 'Workers', href: '/workers' },
      { icon: LiLayersMinimalistic, iconActive: BdLayersMinimalistic, label: 'Subaccounts', href: '/subaccounts' },
      { icon: CoinsIcon, label: 'Rewards', href: '/rewards' },
      { icon: LiWallet, iconActive: BdWallet, label: 'Payouts', href: '/payouts' },
    ],
  },
  {
    label: 'Developer',
    items: [{ icon: LiKeyMinimalistic, iconActive: BdKeyMinimalistic, label: 'API keys', href: '/api-keys' }],
  },
];

// Pinned to the bottom of the sidebar, above Logout.
export const SETTINGS_ITEM: NavItem = {
  icon: LiSettingsMinimalistic,
  iconActive: BdSettingsMinimalistic,
  label: 'Settings',
  href: '/account',
};

const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];

/** The page title shown in the top bar for a given route. */
export function titleForPath(path: string): string {
  return ALL_ITEMS.find((item) => item.href === path)?.label ?? 'Home';
}
