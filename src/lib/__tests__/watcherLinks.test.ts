import assert from 'node:assert/strict';
import test from 'node:test';

import type { Subaccount, WatcherLink, WatcherScope } from '@/api/types';
import {
  ALL_WATCHER_SCOPES,
  scopeLabel,
  scopeLabels,
  WATCHER_PRESETS,
  presetScopes,
  accountLabel,
  parseWatcherPath,
  watcherLinkUrl,
  watcherUrlLabel,
  truncateToken,
  visibleScopeChips,
  formatWatcherDate,
  formatWatcherDateTime,
  formatLastUpdated,
  formatFeePercent,
  watcherSearchText,
  searchWatcherLinks,
  sortWatcherLinksByCreatedDesc,
  EMPTY_WATCHER_FILTER,
  isWatcherFilterActive,
  applyWatcherFilter,
} from '@/lib/watcherLinks';

const FULL_TOKEN = 'KNWXZXKY5ZL7HZM22RFGOPRMOVUGJ2XZ';

function link(over: Partial<WatcherLink> = {}): WatcherLink {
  return {
    id: '199',
    user_id: '-7397273660421850316',
    token: FULL_TOKEN,
    owner_email: 'm@x.io',
    owner_first_name: 'Ada',
    scopes: ['hashrate_read', 'workers_read'],
    created_at: '2026-06-29T08:24:00.426396Z',
    expires_at: null,
    ...over,
  };
}
function sub(over: Partial<Subaccount> = {}): Subaccount {
  return {
    id: '-3713290779221491336',
    sub_account: 'Warehouse 01',
    token: 't',
    api_token: 'a',
    fpps_token: null,
    hashrate: '0',
    bitcoin_addresses: {},
    ...over,
  };
}

test('scopeLabel maps every API scope to its display label', () => {
  assert.equal(scopeLabel('hashrate_read'), 'Hashrate');
  assert.equal(scopeLabel('workers_read'), 'Workers');
  assert.equal(scopeLabel('earnings_read'), 'Earnings');
  assert.equal(scopeLabel('rejects_read'), 'Rejects');
  assert.equal(scopeLabel('fees_read'), 'Fees');
  // every scope in the enum has a label (no silent gaps if the API adds one)
  assert.equal(ALL_WATCHER_SCOPES.length, 5);
  for (const s of ALL_WATCHER_SCOPES) assert.ok(scopeLabel(s).length > 0);
  assert.deepEqual(scopeLabels(['hashrate_read', 'fees_read']), ['Hashrate', 'Fees']);
});

test('presets map to the documented scope sets', () => {
  assert.deepEqual(presetScopes('limited'), ['hashrate_read', 'workers_read']);
  assert.deepEqual(presetScopes('full'), ALL_WATCHER_SCOPES);
  assert.deepEqual(presetScopes('custom'), []);
  // the picker lists limited, full, custom in that order
  assert.deepEqual(WATCHER_PRESETS.map((p) => p.value), ['limited', 'full', 'custom']);
});

test('accountLabel resolves the master account, a subaccount, or null when unknown', () => {
  const subs = [sub(), sub({ id: '999', sub_account: 'Shed 2' })];
  assert.equal(accountLabel('-7397273660421850316', '-7397273660421850316', subs), 'Main account');
  assert.equal(accountLabel('-3713290779221491336', '-7397273660421850316', subs), 'Warehouse 01');
  assert.equal(accountLabel('999', '-7397273660421850316', subs), 'Shed 2');
  // a link for an account we cannot name (deleted sub, or subs not loaded) is not guessed
  assert.equal(accountLabel('12345', '-7397273660421850316', subs), null);
  assert.equal(accountLabel('12345', null, []), null);
});

test('parseWatcherPath reads the user id and token out of the route, rejecting anything else', () => {
  assert.deepEqual(parseWatcherPath('-739', 'ABC123'), { userId: '-739', token: 'ABC123' });
  // a blank segment is not a valid link
  assert.equal(parseWatcherPath('', 'ABC'), null);
  assert.equal(parseWatcherPath('-739', ''), null);
  // wouter gives decoded params, but a stray slash or whitespace-only is rejected
  assert.equal(parseWatcherPath('-739', '   '), null);
});

test('watcherLinkUrl builds the real /login/watcher/{user_id}/{token} link on the given origin', () => {
  assert.equal(
    watcherLinkUrl('https://dash.example.com', '-739', FULL_TOKEN),
    `https://dash.example.com/login/watcher/-739/${FULL_TOKEN}`,
  );
  // a trailing slash on the origin does not double up
  assert.equal(
    watcherLinkUrl('https://dash.example.com/', '-739', FULL_TOKEN),
    `https://dash.example.com/login/watcher/-739/${FULL_TOKEN}`,
  );
});

test('truncateToken shows the head and tail of the token', () => {
  assert.equal(truncateToken(FULL_TOKEN), 'KNWXZXKY...J2XZ');
  // a token shorter than the window is left alone
  assert.equal(truncateToken('SHORT'), 'SHORT');
});

test('watcherUrlLabel shows the host and the end of the token', () => {
  assert.equal(watcherUrlLabel('https://platform.dmnd.work', FULL_TOKEN), 'platform.dmnd.work/...J2XZ');
  assert.equal(watcherUrlLabel('http://localhost:5173', FULL_TOKEN), 'localhost:5173/...J2XZ');
});

test('visibleScopeChips shows up to three chips, then two plus an overflow count', () => {
  assert.deepEqual(visibleScopeChips(['hashrate_read', 'workers_read']), {
    chips: ['Hashrate', 'Workers'],
    overflow: 0,
  });
  assert.deepEqual(visibleScopeChips(['hashrate_read', 'workers_read', 'earnings_read']), {
    chips: ['Hashrate', 'Workers', 'Earnings'],
    overflow: 0,
  });
  assert.deepEqual(visibleScopeChips(ALL_WATCHER_SCOPES), {
    chips: ['Hashrate', 'Workers'],
    overflow: 3,
  });
  assert.deepEqual(visibleScopeChips([]), { chips: [], overflow: 0 });
});

test('created timestamps render as the table date and the details date-time in UTC', () => {
  assert.equal(formatWatcherDate('2026-06-29T08:24:00.426396Z'), 'Jun 29, 2026');
  assert.equal(formatWatcherDateTime('2026-06-29T08:24:00.426396Z'), 'Jun 29, 2026, 08:24 UTC');
  // an unparseable timestamp passes through rather than rendering "Invalid Date"
  assert.equal(formatWatcherDate('nonsense'), 'nonsense');
  assert.equal(formatWatcherDateTime('nonsense'), 'nonsense');
});

test('search covers every displayed column, not just one', () => {
  const subs = [sub()];
  const l = link({ user_id: '-3713290779221491336', scopes: ['earnings_read'] });
  const text = watcherSearchText(l, 'Warehouse 01', 'https://platform.dmnd.work');
  assert.match(text, /warehouse 01/); // account
  assert.match(text, /earnings/); // scope label
  assert.match(text, /knwxzxky/); // token
  assert.match(text, /platform\.dmnd\.work/); // url
  assert.match(text, /jun 29, 2026/); // created

  const rows = [l, link({ id: '2', user_id: '-7397273660421850316', token: 'ZZZZQQQQ1111WWWW' })];
  const find = (q: string) => searchWatcherLinks(rows, q, '-7397273660421850316', subs, 'https://platform.dmnd.work');
  assert.equal(find('warehouse').length, 1);
  assert.equal(find('main account').length, 1);
  assert.equal(find('earnings').length, 1);
  assert.equal(find('ZZZZQQQQ').length, 1);
  assert.equal(find('   ').length, 2); // blank query passes all
});

test('sortWatcherLinksByCreatedDesc puts the newest link first', () => {
  const older = link({ id: 'old', created_at: '2026-06-01T00:00:00Z' });
  const newer = link({ id: 'new', created_at: '2026-06-29T00:00:00Z' });
  assert.deepEqual(sortWatcherLinksByCreatedDesc([older, newer]).map((l) => l.id), ['new', 'old']);
});

test('isWatcherFilterActive is true only when a facet is set', () => {
  assert.equal(isWatcherFilterActive(EMPTY_WATCHER_FILTER), false);
  assert.equal(isWatcherFilterActive({ ...EMPTY_WATCHER_FILTER, scope: 'fees_read' }), true);
  assert.equal(isWatcherFilterActive({ ...EMPTY_WATCHER_FILTER, sinceMs: 1 }), true);
  assert.equal(isWatcherFilterActive({ ...EMPTY_WATCHER_FILTER, accountId: '-739' }), true);
  // "newest" is the default order, so it alone is not an active filter
  assert.equal(isWatcherFilterActive({ ...EMPTY_WATCHER_FILTER, sort: 'newest' }), false);
  assert.equal(isWatcherFilterActive({ ...EMPTY_WATCHER_FILTER, sort: 'oldest' }), true);
});

test('applyWatcherFilter filters by scope, account and date, then orders by the sort', () => {
  const a = link({ id: 'a', user_id: 'main', scopes: ['hashrate_read'], created_at: '2026-06-01T00:00:00Z' });
  const b = link({ id: 'b', user_id: 'sub1', scopes: ['fees_read', 'workers_read'], created_at: '2026-06-20T00:00:00Z' });
  const c = link({ id: 'c', user_id: 'main', scopes: ['fees_read'], created_at: '2026-06-29T00:00:00Z' });
  const rows = [a, b, c];

  // no facets: newest first
  assert.deepEqual(applyWatcherFilter(rows, EMPTY_WATCHER_FILTER).map((l) => l.id), ['c', 'b', 'a']);
  // scope: a link matches when it HAS the scope (not only when it is its sole scope)
  assert.deepEqual(applyWatcherFilter(rows, { ...EMPTY_WATCHER_FILTER, scope: 'fees_read' }).map((l) => l.id), ['c', 'b']);
  // account
  assert.deepEqual(applyWatcherFilter(rows, { ...EMPTY_WATCHER_FILTER, accountId: 'main' }).map((l) => l.id), ['c', 'a']);
  // date: only links created at or after the cutoff
  assert.deepEqual(
    applyWatcherFilter(rows, { ...EMPTY_WATCHER_FILTER, sinceMs: Date.UTC(2026, 5, 15) }).map((l) => l.id),
    ['c', 'b'],
  );
  // date window with an upper bound (the custom range), inclusive of the end
  assert.deepEqual(
    applyWatcherFilter(rows, { ...EMPTY_WATCHER_FILTER, sinceMs: Date.UTC(2026, 5, 1), untilMs: Date.UTC(2026, 5, 20, 23, 59, 59) }).map((l) => l.id),
    ['b', 'a'],
  );
  // oldest first
  assert.deepEqual(applyWatcherFilter(rows, { ...EMPTY_WATCHER_FILTER, sort: 'oldest' }).map((l) => l.id), ['a', 'b', 'c']);
  // facets combine with AND
  assert.deepEqual(
    applyWatcherFilter(rows, { ...EMPTY_WATCHER_FILTER, scope: 'fees_read', accountId: 'main' }).map((l) => l.id),
    ['c'],
  );
});

test('formatLastUpdated buckets the observed time, or returns null when unknown', () => {
  const NOW = Date.parse('2026-06-30T12:00:00Z');
  const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
  assert.equal(formatLastUpdated(at(30 * 1000), NOW), 'Just now'); // under a minute
  assert.equal(formatLastUpdated(at(60 * 1000), NOW), '1 minute ago');
  assert.equal(formatLastUpdated(at(5 * 60 * 1000), NOW), '5 minutes ago');
  assert.equal(formatLastUpdated(at(60 * 60 * 1000), NOW), '1 hour ago');
  assert.equal(formatLastUpdated(at(3 * 60 * 60 * 1000), NOW), '3 hours ago');
  assert.equal(formatLastUpdated(at(2 * 24 * 60 * 60 * 1000), NOW), '2 days ago');
  assert.equal(formatLastUpdated(undefined, NOW), null); // no observed_at -> caller omits the label
  assert.equal(formatLastUpdated('nonsense', NOW), null); // unparseable
});

test('formatFeePercent renders the rate verbatim to two decimals (the API sends percent)', () => {
  assert.equal(formatFeePercent(2), '2.00'); // 2 = 2%, not 200%
  assert.equal(formatFeePercent(0.5), '0.50');
  assert.equal(formatFeePercent(0), '0.00');
  assert.equal(formatFeePercent(1.2), '1.20'); // always two decimals
  assert.equal(formatFeePercent(Number.NaN), '0.00'); // a malformed response can't show "NaN%"
});

// exercises the exported scope type through a value
const _scope: WatcherScope = 'hashrate_read';
void _scope;
