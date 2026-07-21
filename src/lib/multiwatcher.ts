import type { WatcherLink, WatcherScope } from '@/api/types';

/**
 * A multiwatcher link bundles several existing watcher links under one enforcement
 * mode. It is composed entirely client-side (no server endpoint): the shareable URL
 * carries the mode plus the (account, token) pairs, and it works until one of those
 * underlying links is revoked.
 */
export type MultiwatcherMode = 'hashrate' | 'generated_btc' | 'both';

/** The modes in the order the Permissions picker lists them. */
export const MULTIWATCHER_MODES: MultiwatcherMode[] = ['hashrate', 'generated_btc', 'both'];

const MODE_LABELS: Record<MultiwatcherMode, string> = {
  hashrate: 'Hashrate',
  generated_btc: 'Generated BTC',
  both: 'Generated BTC and Hashrate',
};

/** The numeric mode encoded in the URL (matches the production route). */
const MODE_TO_NUM: Record<MultiwatcherMode, string> = { hashrate: '0', generated_btc: '1', both: '2' };
const NUM_TO_MODE: Record<string, MultiwatcherMode> = { '0': 'hashrate', '1': 'generated_btc', '2': 'both' };

/** Display label for one enforcement mode. */
export function modeLabel(mode: MultiwatcherMode): string {
  return MODE_LABELS[mode];
}

/** The scopes a link must grant to be usable under a mode (generated_btc = earnings). */
export function eligibleScopes(mode: MultiwatcherMode): WatcherScope[] {
  if (mode === 'hashrate') return ['hashrate_read'];
  if (mode === 'generated_btc') return ['earnings_read'];
  return ['hashrate_read', 'earnings_read'];
}

/** A link qualifies for a mode when it grants every scope that mode enforces. */
export function isLinkEligible(link: WatcherLink, mode: MultiwatcherMode): boolean {
  return eligibleScopes(mode).every((s) => link.scopes.includes(s));
}

/** The links usable under a mode. */
export function eligibleLinks(links: WatcherLink[], mode: MultiwatcherMode): WatcherLink[] {
  return links.filter((l) => isLinkEligible(l, mode));
}

/**
 * One link per account: when several links cover the same account, keep the one
 * granting the most scopes (the "highest permissions" the design refers to), so an
 * account is never represented twice in a multiwatcher link.
 */
export function highestPerAccount(links: WatcherLink[]): WatcherLink[] {
  const best = new Map<string, WatcherLink>();
  for (const l of links) {
    const cur = best.get(l.user_id);
    if (!cur || l.scopes.length > cur.scopes.length) best.set(l.user_id, l);
  }
  return [...best.values()];
}

/** The shareable multiwatcher URL: /login/multiwatcher/{mode}/{userId}/{token}/... */
export function multiwatcherUrl(origin: string, mode: MultiwatcherMode, links: WatcherLink[]): string {
  const base = origin.replace(/\/+$/, '');
  const pairs = links.flatMap((l) => [l.user_id, l.token]);
  return `${base}/login/multiwatcher/${MODE_TO_NUM[mode]}/${pairs.join('/')}`;
}

/**
 * Read a multiwatcher URL's path segments back into a mode and its (account, token)
 * entries. Returns null for an unknown mode, an incomplete pair, or no entries.
 */
export function parseMultiwatcherPath(
  segments: string[],
): { mode: MultiwatcherMode; entries: { userId: string; token: string }[] } | null {
  const [modeSeg, ...rest] = segments;
  const mode = NUM_TO_MODE[modeSeg];
  if (!mode) return null;
  if (rest.length === 0 || rest.length % 2 !== 0) return null;
  const entries: { userId: string; token: string }[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const userId = rest[i]?.trim();
    const token = rest[i + 1]?.trim();
    if (!userId || !token) return null;
    entries.push({ userId, token });
  }
  return { mode, entries };
}
