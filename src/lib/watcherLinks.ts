import type { Subaccount, WatcherLink, WatcherScope } from '@/api/types';
import { truncateMiddle } from '@/lib/payoutsTable';

/** Every scope the API accepts, in the order the permission picker lists them. */
export const ALL_WATCHER_SCOPES: WatcherScope[] = [
  'hashrate_read',
  'workers_read',
  'earnings_read',
  'rejects_read',
  'fees_read',
];

const SCOPE_LABELS: Record<WatcherScope, string> = {
  hashrate_read: 'Hashrate',
  workers_read: 'Workers',
  earnings_read: 'Earnings',
  rejects_read: 'Rejects',
  fees_read: 'Fees',
};

/** What each scope lets the link read; shown under the scope in the permission picker. */
export const SCOPE_DESCRIPTIONS: Record<WatcherScope, string> = {
  hashrate_read: 'Current and historical hashrate data.',
  workers_read: 'Live worker roster, miner count and share counts per worker.',
  earnings_read: 'Daily generated BTC for FPPS earnings.',
  rejects_read: 'Aggregate accepted and rejected share counts.',
  fees_read: 'Pool fee and broker fee percentages.',
};

/** Display label for one scope. */
export function scopeLabel(scope: WatcherScope): string {
  return SCOPE_LABELS[scope];
}

/** Display labels for a list of scopes, keeping their order. */
export function scopeLabels(scopes: WatcherScope[]): string[] {
  return scopes.map(scopeLabel);
}

export type WatcherPreset = 'limited' | 'full' | 'custom';

/** The preset options offered when creating a link, in the order they are listed. */
export const WATCHER_PRESETS: { value: WatcherPreset; label: string; hint: string }[] = [
  { value: 'limited', label: 'Limited watcher', hint: 'Scopes: Hashrate, Workers' },
  { value: 'full', label: 'Full watcher', hint: 'Scopes: Hashrate, Workers, Earnings, Rejection ratio, Fees' },
  { value: 'custom', label: 'Use custom scopes', hint: 'Manually choose which data this Watcher link can access.' },
];

/** The scopes a preset selects; "custom" selects nothing until the user picks. */
export function presetScopes(preset: WatcherPreset): WatcherScope[] {
  if (preset === 'limited') return ['hashrate_read', 'workers_read'];
  if (preset === 'full') return [...ALL_WATCHER_SCOPES];
  return [];
}

/**
 * The name of the account a link can read. The link row only carries `user_id`, so it
 * is resolved against the signed-in account and its subaccounts; an id we cannot name
 * (a deleted subaccount, or the roster not loaded) returns null rather than a guess.
 */
export function accountLabel(
  userId: string,
  sessionAccountId: string | null,
  subaccounts: Subaccount[],
): string | null {
  if (sessionAccountId !== null && userId === sessionAccountId) return 'Main account';
  const match = subaccounts.find((s) => s.id === userId);
  return match ? match.sub_account : null;
}

/** The shareable link: the watcher opens this and reads only what the token allows. */
export function watcherLinkUrl(origin: string, userId: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/login/watcher/${userId}/${token}`;
}

/** The route params from `/login/watcher/:userId/:token`; null when either is blank. */
export function parseWatcherPath(userId: string, token: string): { userId: string; token: string } | null {
  const u = userId.trim();
  const t = token.trim();
  if (!u || !t) return null;
  return { userId: u, token: t };
}

/** The token shortened for a table cell; the full value is only copied, never shown. */
export function truncateToken(token: string): string {
  return truncateMiddle(token, 8, 4);
}

/** The link shortened for a table cell: the host plus the end of the token. */
export function watcherUrlLabel(origin: string, token: string): string {
  const host = origin.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `${host}/...${token.slice(-4)}`;
}

/** Scope chips for a table cell: up to three fit, beyond that two plus a "+N" count. */
export function visibleScopeChips(scopes: WatcherScope[]): { chips: string[]; overflow: number } {
  if (scopes.length <= 3) return { chips: scopeLabels(scopes), overflow: 0 };
  return { chips: scopeLabels(scopes.slice(0, 2)), overflow: scopes.length - 2 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jun 29, 2026" (UTC); an unparseable value passes through unchanged. */
export function formatWatcherDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Jun 29, 2026, 08:24 UTC"; an unparseable value passes through unchanged. */
export function formatWatcherDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatWatcherDate(iso)}, ${hh}:${mm} UTC`;
}

/**
 * "Last updated" phrasing for the live-hashrate card: "Just now", "5 minutes ago",
 * "3 hours ago", "2 days ago". `observed` is the snapshot's `observed_at`; a missing or
 * unparseable value returns null so the caller can omit the label rather than guess.
 */
export function formatLastUpdated(observed: string | undefined, now: number): string | null {
  if (!observed) return null;
  const ms = Date.parse(observed);
  if (Number.isNaN(ms)) return null;
  const mins = Math.floor((now - ms) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * A fee rate for display, to two decimals (the "%" is drawn separately). The API sends
 * the rate already in percent (2 = 2%), so it is shown verbatim, not multiplied. A
 * non-finite value (a malformed response) reads as "0.00" rather than "NaN".
 */
export function formatFeePercent(rate: number): string {
  return (Number.isFinite(rate) ? rate : 0).toFixed(2);
}

/** Everything shown for a link, lowercased, so search covers every displayed column. */
export function watcherSearchText(link: WatcherLink, account: string | null, origin: string): string {
  return [
    account ?? '',
    scopeLabels(link.scopes).join(' '),
    link.token,
    watcherLinkUrl(origin, link.user_id, link.token),
    formatWatcherDate(link.created_at),
  ]
    .join(' ')
    .toLowerCase();
}

/** Case-insensitive match across every displayed column; a blank query passes all. */
export function searchWatcherLinks(
  links: WatcherLink[],
  query: string,
  sessionAccountId: string | null,
  subaccounts: Subaccount[],
  origin: string,
): WatcherLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return links;
  return links.filter((l) =>
    watcherSearchText(l, accountLabel(l.user_id, sessionAccountId, subaccounts), origin).includes(q),
  );
}

/** Created-at as ms; an unparseable timestamp sorts last in either direction. */
function createdMs(l: WatcherLink): number {
  const ms = Date.parse(l.created_at);
  return Number.isNaN(ms) ? -Infinity : ms;
}

/** Newest link first; an unparseable timestamp sorts last. */
export function sortWatcherLinksByCreatedDesc(links: WatcherLink[]): WatcherLink[] {
  return [...links].sort((a, b) => createdMs(b) - createdMs(a));
}

/** The order the Sort-by facet offers; "newest" is the default the list already uses. */
export type WatcherSort = 'newest' | 'oldest';

/** The date presets the Date facet offers (Custom picks a range instead). */
export type WatcherDatePreset = '24h' | '7d' | '30d';
const PRESET_DAYS: Record<WatcherDatePreset, number> = { '24h': 1, '7d': 7, '30d': 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** The cutoff for a date preset, relative to `nowMs`. */
export function watcherSinceForPreset(preset: WatcherDatePreset, nowMs: number): number {
  return nowMs - PRESET_DAYS[preset] * DAY_MS;
}

/** The applied filter: a scope, an account, a created-at window, and an order. */
export interface WatcherFilter {
  scope: WatcherScope | null;
  accountId: string | null;
  sinceMs: number | null;
  untilMs: number | null;
  sort: WatcherSort;
}

export const EMPTY_WATCHER_FILTER: WatcherFilter = {
  scope: null,
  accountId: null,
  sinceMs: null,
  untilMs: null,
  sort: 'newest',
};

/** True when any facet narrows the list; the default "newest" order does not count. */
export function isWatcherFilterActive(f: WatcherFilter): boolean {
  return f.scope !== null || f.accountId !== null || f.sinceMs !== null || f.untilMs !== null || f.sort !== 'newest';
}

/**
 * Filter by scope, account, and created-at window (all AND-combined), then order by
 * the chosen sort. A link matches a scope when it grants that scope, not only when it
 * is the link's only scope.
 */
export function applyWatcherFilter(links: WatcherLink[], filter: WatcherFilter): WatcherLink[] {
  const kept = links.filter((l) => {
    if (filter.scope !== null && !l.scopes.includes(filter.scope)) return false;
    if (filter.accountId !== null && l.user_id !== filter.accountId) return false;
    if (filter.sinceMs !== null || filter.untilMs !== null) {
      const ms = createdMs(l);
      if (!Number.isFinite(ms)) return false;
      if (filter.sinceMs !== null && ms < filter.sinceMs) return false;
      if (filter.untilMs !== null && ms > filter.untilMs) return false;
    }
    return true;
  });
  const factor = filter.sort === 'oldest' ? -1 : 1;
  return [...kept].sort((a, b) => (createdMs(b) - createdMs(a)) * factor);
}
