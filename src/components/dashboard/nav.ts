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

const TRUST_CENTER_URL = 'https://www.dmnd.work/trust-center/index.html';

export const PPLNS_PROJECTION_ROUTE = '/pplns-projection';

export interface NavItem {
  /** Resting glyph: a solar outline icon, or a custom DMND glyph. */
  icon: IconComp;
  /** Bold-duotone glyph for the active state; falls back to `icon` when absent. */
  iconActive?: IconComp;
  label: string;
  href: string;
  /** Plain-language page explanation used by the guided tour. */
  tourDescription: string;
  /**
   * A dropdown entry: the row expands to reveal these instead of navigating. The
   * parent also links to its overview page.
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
      {
        icon: LiHomeAngle,
        iconActive: BdHomeAngle,
        label: 'Home',
        href: '/home',
        tourDescription: 'See your mining power, active miners, earnings, and recent performance in one place.',
      },
      {
        icon: NodeHardwareIcon,
        label: 'BUILD YOUR BLOCK',
        href: '/build-your-block',
        tourDescription: 'Get started with Job Declaration, transaction selection, and merge mining. Follow setup guides to use your own Bitcoin node, choose which transactions go into your blocks, and earn additional rewards through merge mining.',

      },
    ],
  },
  {
    label: 'Mining',
    items: [
      {
        icon: MiningIcon,
        label: 'Workers',
        href: '/workers',
        tourDescription: 'Find a miner by name and check whether it is online, its hashrate and rejection rate.',
      },
      {
        icon: LiLayersMinimalistic,
        iconActive: BdLayersMinimalistic,
        label: 'Subaccounts',
        href: '/subaccounts',
        tourDescription: 'Organize your mining sites, teams, or setups into subaccounts. Compare their workers, hashrate, and earnings, then select a subaccount to view its mining activity in detail.',
      },
      {
        icon: BitcoinCircleIcon,
        label: 'Generated BTC',
        href: '/generated-bitcoin',
        tourDescription: 'Track your daily FPPS Bitcoin earnings. Visit Payouts to see payments sent to your wallet',
      },
      {
        icon: LiChart,
        iconActive: BdChart,
        label: 'PPLNS Projection',
        href: PPLNS_PROJECTION_ROUTE,
        tourDescription: 'PPLNS rewards depend on your recent mining work and the blocks the pool finds. See the work that still counts toward rewards, what it has earned, and an estimate for the next block. The estimate can change; it is not a payment to your wallet.',
      },
      {
        icon: LiWallet,
        iconActive: BdWallet,
        label: 'Payouts',
        href: '/payouts',
        tourDescription: 'Track payments sent to your Bitcoin wallet. View each payment’s amount, date, and transaction details, along with the total you’ve been paid.',
      },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      {
        icon: LiKeyMinimalistic,
        iconActive: BdKeyMinimalistic,
        label: 'Watcher links',
        href: '/watcher-links',
        tourDescription: 'Create an observer/read-only link to share your mining activity without sharing your login. Choose what each link shows, so viewers can see selected information without changing anything in your account. You can revoke a link at any time.',
      },
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
        tourDescription: 'Learn how DMND protects your information and read about its security checks, including the independent SOC 2 Type II audit.',
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
  tourDescription: 'View your profile and update your Bitcoin payout address. Manage your password and two-factor authentication in Security, or choose your dashboard theme in Preferences. To change your payout address, password, or two-factor authentication, switch to your main account.',
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

export const AGGREGATED_RESTRICTED_ROUTES = ['/subaccounts', '/watcher-links'];

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
