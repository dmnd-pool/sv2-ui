import type { ComponentType } from 'react';
import {
  LiHomeAngle,
  LiLayersMinimalistic,
  LiWallet,
  LiKeyMinimalistic,
  LiSettingsMinimalistic,
  LiShieldCheck,
  LiChart,
} from 'solar-icon-react/li';
import {
  BdHomeAngle,
  BdLayersMinimalistic,
  BdWallet,
  BdKeyMinimalistic,
  BdSettingsMinimalistic,
  BdShieldCheck,
  BdChart,
} from 'solar-icon-react/bd';
import { MiningIcon } from './icons/MiningIcon';
import { NodeHardwareIcon } from './icons/NodeHardwareIcon';
import { BitcoinCircleIcon } from './icons/BitcoinCircleIcon';

type IconComp = ComponentType<{ className?: string }>;

const TRUST_CENTER_URL = 'https://app.eu.vanta.com/dmnd.work/trust/4u48n4nf8yiwi9swpqjsf';

export const PPLNS_PROJECTION_ROUTE = '/pplns-projection';

export interface NavItem {
  /** Resting glyph: a solar outline icon, or a custom DMND glyph. */
  icon: IconComp;
  /** Bold-duotone glyph for the active state; falls back to `icon` when absent. */
  iconActive?: IconComp;
  label: string;
  href: string;
  /**
   * A dropdown entry: the row expands to reveal these instead of navigating. The
   * parent has no page of its own, so `href` is only used as a stable key.
   */
  children?: NavItem[];
   /* Renders the row as this image instead of icon + label.
   */
  image?: string;
  /** Opens in a new tab; wouter's Link routes in-app and cannot leave it. */
  external?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { icon: LiHomeAngle, iconActive: BdHomeAngle, label: 'Home', href: '/home' },
      {
        icon: NodeHardwareIcon,
        label: 'BUILD YOUR BLOCK',
        href: '/build-your-block',
        children: [
          { icon: LiHomeAngle, label: 'Job declaration', href: '/build-your-block/job-declaration' },
          { icon: LiHomeAngle, label: 'Merge mining', href: '/build-your-block/merge-mining' },
          { icon: LiHomeAngle, label: 'Prioritize transactions', href: '/build-your-block/prioritize-transactions' },
        ],
      },
    ],
  },
  {
    label: 'Mining',
    items: [
      { icon: MiningIcon, label: 'Workers', href: '/workers' },
      { icon: LiLayersMinimalistic, iconActive: BdLayersMinimalistic, label: 'Subaccounts', href: '/subaccounts' },
      { icon: BitcoinCircleIcon, label: 'Generated BTC', href: '/generated-bitcoin' },
      { icon: LiWallet, iconActive: BdWallet, label: 'Payouts', href: '/payouts' },
      { icon: LiChart, iconActive: BdChart, label: 'PPLNS Projection', href: PPLNS_PROJECTION_ROUTE },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { icon: LiKeyMinimalistic, iconActive: BdKeyMinimalistic, label: 'Watcher links', href: '/watcher-links' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        icon: LiShieldCheck,
        iconActive: BdShieldCheck,
        label: "We're a SOC 2 Type II compliant organization. Learn more at our Trust Center.",
        image: '/soc2-badge.png',
        href: TRUST_CENTER_URL,
        external: true,
      },
    ],
  },
];

// Pinned to the bottom of the sidebar, above Logout.
export const SETTINGS_ITEM: NavItem = {
  icon: LiSettingsMinimalistic,
  iconActive: BdSettingsMinimalistic,
  label: 'Settings',
  href: '/account',
};

/**
 * Routes a subaccount has no access to. A subaccount owns no subaccounts of its own
 * (`/api/user/permissions` returns `view_sub_accounts: false` for one), so the route is
 * both hidden from its sidebar and redirected away from when an account switch lands on
 * it. Kept here so the nav filter and the switch redirect can never disagree.
 */
export const SUBACCOUNT_RESTRICTED_ROUTES = ['/subaccounts'];

/** Whether the given route is off-limits while viewing a subaccount. */
export function isSubaccountRestrictedRoute(path: string): boolean {
  return SUBACCOUNT_RESTRICTED_ROUTES.includes(path);
}

export const AGGREGATED_RESTRICTED_ROUTES = [PPLNS_PROJECTION_ROUTE];

export function isAggregatedRestrictedRoute(path: string): boolean {
  return AGGREGATED_RESTRICTED_ROUTES.includes(path);
}

// Dropdown children are real routes, so they must be flattened too or their pages
// fall back to the default title.
const ALL_ITEMS = [
  ...NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])])),
  SETTINGS_ITEM,
];

// Routes reachable outside the sidebar (top-bar actions) still need a title.
const EXTRA_TITLES: Record<string, string> = { '/help': 'Help & Support' };

export function isPathActive(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

/** The page title shown in the top bar for a given route. */
export function titleForPath(path: string): string {
  const owner = ALL_ITEMS.filter((item) => isPathActive(path, item.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return owner?.label ?? EXTRA_TITLES[path] ?? 'Home';
}
