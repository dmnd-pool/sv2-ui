import { accountPayoutQueryOptions } from '../payoutsTable';
import { accountSummaryQueryOptions, workerPresenceQueryOptions } from '@/hooks/useAccountData';
import { isAggregatedRestrictedRoute } from '@/components/dashboard/nav';
import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createUser } from '@/api/client';
import { createWatcherClient, WatcherRequestError } from '@/api/watcherClient';
import type { DmndClient } from '@/api/types';
import { loadSubaccountRows, loadSubaccountWorkerGroups, visibleSubaccountQueryOptions } from '@/hooks/useSubaccounts';
import { brokerMinersQueryOptions, clearBrokerQueries } from '../brokerQueries';
import { refreshHashrateHistory } from '../hashrateHistory';
import { watcherQueryPolicy } from '../watcherQueries';
import { aggregatedPplnsProjectionQueryOptions, pplnsProjectionQueryOptions, PplnsReportUnavailableError } from '@/hooks/usePplnsProjection';
import { pplnsProjectionFixture } from '@/api/__tests__/pplnsProjectionFixture';

test('an incomplete PPLNS refresh preserves the complete total and its update time until recovery', async (t) => {
  let now = Date.parse('2026-10-29T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  let refreshing = false;
  let missing = false;
  const client = { getPplnsProjection: async (id: string, request: { accountId: string }) => {
    assert.equal(request.accountId, 'owner');
    if (id === 'b' && missing) return null;
    const projection = pplnsProjectionFixture();
    const total = (id === 'a' ? 1000 : 2000) * (refreshing ? 2 : 1);
    return { ...projection, subaccount_id: id, daily_work: [{ ...projection.daily_work[0], total_net_sats: total }] };
  } } as unknown as DmndClient;
  const cache = new QueryClient();
  const options = { ...aggregatedPplnsProjectionQueryOptions(cache, client, 'owner', ['a', 'b']), retry: false as const };
  try {
    const original = await cache.fetchQuery(options);
    assert.equal(original[0].total_net_sats, 3000);
    const originalUpdatedAt = cache.getQueryState(options.queryKey)!.dataUpdatedAt;
    now += 5 * 60_000;
    refreshing = true;
    missing = true;
    await assert.rejects(cache.fetchQuery(options), PplnsReportUnavailableError);
    assert.deepEqual(cache.getQueryData(options.queryKey), original, 'never publish the available account alone');
    assert.equal(cache.getQueryState(options.queryKey)!.dataUpdatedAt, originalUpdatedAt);
    const otherAccounts = aggregatedPplnsProjectionQueryOptions(cache, client, 'owner', ['b']);
    assert.equal(cache.getQueryData(otherAccounts.queryKey), undefined, 'a changed account selection cannot inherit the previous total');
    assert.equal(cache.getQueryData(aggregatedPplnsProjectionQueryOptions(cache, client, 'other-owner', ['a', 'b']).queryKey), undefined);
    now += 15_000;
    missing = false;
    assert.equal((await cache.fetchQuery(options))[0].total_net_sats, 6000);
    assert.equal(cache.getQueryState(options.queryKey)!.dataUpdatedAt, now);
  } finally { cache.clear(); }
});

test('a missing single-account report retains previous data, while a confirmed empty report can replace it', async (t) => {
  let now = Date.parse('2026-10-29T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  let response: ReturnType<typeof pplnsProjectionFixture> | null = pplnsProjectionFixture();
  const client = { getPplnsProjection: async () => response } as unknown as DmndClient;
  const cache = new QueryClient();
  const options = { ...pplnsProjectionQueryOptions(client, '123'), retry: false as const };
  try {
    const original = await cache.fetchQuery(options);
    const updatedAt = cache.getQueryState(options.queryKey)!.dataUpdatedAt;
    now += 5 * 60_000;
    response = null;
    await assert.rejects(cache.fetchQuery(options), PplnsReportUnavailableError);
    assert.deepEqual(cache.getQueryData(options.queryKey), original);
    assert.equal(cache.getQueryState(options.queryKey)!.dataUpdatedAt, updatedAt);
    assert.equal(options.refetchInterval({ state: { error: new PplnsReportUnavailableError() } }), 15_000);
    const firstVisit = { ...pplnsProjectionQueryOptions(client, '456'), retry: false as const };
    await assert.rejects(cache.fetchQuery(firstVisit), PplnsReportUnavailableError);
    assert.equal(cache.getQueryData(firstVisit.queryKey), undefined, 'missing data is not a successful zero report');
    response = { ...pplnsProjectionFixture(), daily_work: [] };
    assert.deepEqual((await cache.fetchQuery(options)).daily_work, []);
  } finally { cache.clear(); }
});

test('PPLNS retries unavailable reports automatically without retrying permission failures', async () => {
  let calls = 0;
  let forbidden = false;
  const client = { getPplnsProjection: async () => {
    calls++;
    if (forbidden) throw new Error('Forbidden');
    return calls < 3 ? null : pplnsProjectionFixture();
  } } as unknown as DmndClient;
  const cache = new QueryClient();
  try {
    const options = { ...pplnsProjectionQueryOptions(client, '123'), retryDelay: 0 };
    assert.ok(await cache.fetchQuery(options));
    assert.equal(calls, 3);
    forbidden = true;
    await assert.rejects(cache.fetchQuery({ ...options, staleTime: 0 }), /Forbidden/);
    assert.equal(calls, 4);
  } finally { cache.clear(); }
});

test('aggregate refresh reloads snapshots at the next polling boundary and reuses them within that boundary', async (t) => {
  let now = Date.parse('2026-10-21T12:04:00Z');
  t.mock.method(Date, 'now', () => now);
  let summaryReads = 0;
  const client = createUser({ fetchImpl: async (url) => {
    const path = new URL(String(url)).pathname;
    const body = path.endsWith('/sub_account')
      ? [{ id: 'a', sub_account: 'A', token: 'a', fpps_token: null, hashrate: '999', bitcoin_addresses: {} }]
      : { hashrate: { total_hashrate: ++summaryReads }, share_stats: { accepted: 1, rejected: 0 }, today_generated_btc: 0 };
    return new Response(JSON.stringify(body));
  } });
  const cache = new QueryClient();
  const signal = new AbortController().signal;
  try {
    await loadSubaccountRows(cache, client, 'owner', false, signal);
    now += 30_000;
    await loadSubaccountRows(cache, client, 'owner', false, signal);
    assert.equal(summaryReads, 1, 'a second consumer reuses the current snapshot');
    now = Date.parse('2026-10-21T12:05:01Z');
    await loadSubaccountRows(cache, client, 'owner', false, signal);
    assert.equal(summaryReads, 2, 'the next shared tick must not retain the previous snapshot');
  } finally { cache.clear(); }
});

test('Subaccounts requests summaries without workers, then aggregate views reuse cached resources', async () => {
  const calls: string[] = [];
  const client = createUser({ fetchImpl: async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    const body = path.endsWith('/sub_account')
      ? ['a', 'b'].map((id) => ({ id, sub_account: id, token: id, fpps_token: null, hashrate: '0', bitcoin_addresses: {} }))
      : path.endsWith('/summary') ? { hashrate: {}, share_stats: { accepted: 1, rejected: 0 }, today_generated_btc: 1 }
        : { workers: [], next_cursor: null };
    return new Response(JSON.stringify(body));
  } });
  const cache = new QueryClient();
  const signal = new AbortController().signal;
  try {
    const rows = await loadSubaccountRows(cache, client, 'owner', false, signal);
    assert.equal(rows.length, 2);
    assert.equal(calls.length, 3, 'one list and two summaries');
    assert.ok(calls.every((path) => !path.endsWith('/workers')));
    await loadSubaccountRows(cache, client, 'owner', true, signal);
    assert.equal(calls.length, 5, 'only the missing two rosters are loaded');
    await loadSubaccountWorkerGroups(cache, client, 'owner', rows.map((row) => ({ id: row.id } as never)), signal);
    assert.equal(calls.length, 5, 'Workers reuses both rosters without earnings or summary reads');
  } finally { cache.clear(); }
});

test('broker identities cannot share rows and logout removes an in-flight response', async () => {
  const cache = new QueryClient();
  const client = { brokerMiners: async (_height: number, options: { brokerId: string }) => [{ id: options.brokerId }] } as unknown as DmndClient;
  try {
    const a = brokerMinersQueryOptions(client, 'A', 0);
    const b = brokerMinersQueryOptions(client, 'B', 0);
    assert.equal((await cache.fetchQuery(a))[0].id, 'A');
    assert.equal((await cache.fetchQuery(b))[0].id, 'B');
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const late = cache.fetchQuery({ ...a, staleTime: 0, queryFn: async () => { await waiting; return [{ id: 'late A' }]; } });
    const rejected = assert.rejects(late);
    clearBrokerQueries(cache);
    release();
    await rejected;
    assert.equal(cache.getQueryData(a.queryKey), undefined);
    assert.equal(cache.getQueryData(b.queryKey), undefined);
  } finally { cache.clear(); }
});

test('rolling history reads only the missing tail, replaces overlap, and evicts old samples', async () => {
  const point = (minute: number, total = minute) => ({ observed_at: new Date(minute * 60_000).toISOString(), total_hashrate: total, pplns_hashrate: total, fpps_hashrate: 0 });
  const window = (from: number, to: number) => ({ from: new Date(from * 60_000).toISOString(), to: new Date(to * 60_000).toISOString() });
  const first = await refreshHashrateHistory(undefined, window(0, 60), async () => [point(0), point(30), point(58), point(60)]);
  let requestedFrom = '';
  const next = await refreshHashrateHistory(first, window(5, 65), async (from) => {
    requestedFrom = from;
    return [point(58, 999), point(62), point(64)];
  });
  assert.equal(requestedFrom, new Date(56 * 60_000).toISOString());
  assert.deepEqual(next.points.map((p) => p.total_hashrate), [30, 999, 60, 62, 64]);
  let resetFrom = '';
  await refreshHashrateHistory(next, window(70, 130), async (from) => { resetFrom = from; return []; });
  assert.equal(resetFrom, new Date(70 * 60_000).toISOString(), 'a disjoint window requires bootstrap');
});

test('a denied watcher scope disables future automatic reads; a revoked token blocks all reads', async () => {
  const cache = new QueryClient();
  let calls = 0;
  const observer = new QueryObserver(cache, {
    queryKey: ['watcher', 'test', 'hashrate'],
    queryFn: async () => { calls++; throw new WatcherRequestError('denied', 403); },
    ...watcherQueryPolicy(true, false),
  });
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch();
    assert.equal(observer.getCurrentResult().isEnabled, false);
    const previousCalls = calls;
    await cache.invalidateQueries();
    assert.equal(calls, previousCalls);
    assert.equal(watcherQueryPolicy(false, false).enabled({ state: { error: null } }), false, 'hidden mode does not load');
    assert.equal(watcherQueryPolicy(true, true).enabled({ state: { error: null } }), false, 'revocation blocks other scopes');
    assert.equal(watcherQueryPolicy(true, false).enabled({ state: { error: new Error('offline') } }), true, 'transient failures remain recoverable');
  } finally { stop(); cache.clear(); }
});

test('watcher 403 keeps the token usable, while 401 prevents subsequent endpoint and cursor reads', async () => {
  let revoked = false;
  let calls = 0;
  const client = createWatcherClient('fixture', {
    onUnauthorized: () => { revoked = true; }, isRevoked: () => revoked,
    fetchImpl: async () => new Response('{}', { status: ++calls === 1 ? 403 : 401 }),
  });
  await assert.rejects(client.getFees());
  assert.equal(revoked, false);
  await assert.rejects(client.getHashrate());
  assert.equal(revoked, true);
  await assert.rejects(client.getAllWorkers());
  assert.equal(calls, 2);
});

test('aggregate navigation excludes subaccounts and permits the combined PPLNS view', () => {
  assert.equal(isAggregatedRestrictedRoute('/subaccounts'), true);
  assert.equal(isAggregatedRestrictedRoute('/pplns-projection'), false);
});

test('Home and payout history reuse records for ten minutes without crossing account scopes', async (t) => {
  let now = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const calls: string[] = [];
  const client = {
    getSubaccountPayouts: async (id: string) => { calls.push(id); return []; },
    getPayouts: async () => { calls.push('tree'); return []; },
  } as unknown as DmndClient;
  const cache = new QueryClient();
  try {
    const options = accountPayoutQueryOptions(client, 'owner', 'sub', false);
    assert.equal(options.refetchInterval({ state: { dataUpdatedAt: now } }), 10 * 60_000);
    await cache.fetchQuery(options);
    now += 9 * 60_000;
    assert.equal(options.refetchInterval({ state: { dataUpdatedAt: now - 9 * 60_000 } }), 60_000, 'navigation must retain the original refresh deadline');
    await cache.fetchQuery(accountPayoutQueryOptions(client, 'owner', 'sub', false));
    assert.deepEqual(calls, ['sub']);
    await cache.fetchQuery(accountPayoutQueryOptions(client, 'owner', 'other', false));
    await cache.fetchQuery(accountPayoutQueryOptions(client, 'owner', 'sub', true));
    assert.deepEqual(calls, ['sub', 'other', 'tree']);
    now += 60_000;
    await cache.fetchQuery(options);
    assert.deepEqual(calls, ['sub', 'other', 'tree', 'sub']);
  } finally { cache.clear(); }
});

test('rate-limited payouts wait ten minutes instead of polling every second or retrying on navigation', async (t) => {
  let now = Date.parse('2026-10-29T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  for (const hadData of [false, true]) {
    let calls = 0;
    const client = createUser({ fetchImpl: async () => {
      calls++;
      return Response.json({ message: 'Too many requests' }, { status: 429 });
    } });
    const cache = new QueryClient();
    const options = accountPayoutQueryOptions(client, 'owner', 'owner', false);
    let stop = () => {};
    try {
      assert.equal(options.refetchInterval({ state: { dataUpdatedAt: 0 } }), 10 * 60_000);
      if (hadData) cache.setQueryData(options.queryKey, []);
      now += 10 * 60_000;
      await assert.rejects(cache.fetchQuery(options));
      assert.equal(calls, 1, '429 must not be retried inside the API client');
      const state = cache.getQueryState(options.queryKey)!;
      assert.equal(options.refetchInterval({ state }), 10 * 60_000);
      assert.equal(options.refetchOnMount({ state }), false);
      assert.equal(options.refetchOnReconnect({ state }), false, 'reconnection must also respect the cooldown');
      const observer = new QueryObserver(cache, options);
      stop = observer.subscribe(() => {});
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(calls, 1, 'returning to Home or Payouts must respect the cooldown');
      cache.getQueryCache().find({ queryKey: options.queryKey })!.onOnline();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(calls, 1, 'reconnecting must not send another rate-limited request');
      now += 60_000;
      assert.equal(options.refetchInterval({ state }), 9 * 60_000);
      now += 9 * 60_000;
      assert.equal(options.refetchOnMount({ state }), true, 'normal refresh resumes after the cooldown');
      assert.equal(options.refetchOnReconnect({ state }), true);
      await assert.rejects(cache.fetchQuery(options));
      assert.equal(calls, 2);
    } finally { stop(); cache.clear(); }
  }
});

test('setup worker existence uses limit=1 and never follows a cursor', async () => {
  const urls: string[] = [];
  const client = createUser({ fetchImpl: async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ workers: [{ name: 'rig' }], next_cursor: 'more' }));
  } });
  assert.equal(await client.hasWorkers({ accountId: 'owner' }), true);
  assert.equal(urls.length, 1);
  assert.equal(new URL(urls[0]).searchParams.get('limit'), '1');
});

test('setup stops checking once a worker is found and reuses an existing roster', async (t) => {
  let now = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  let reads = 0;
  const client = { hasWorkers: async () => { reads++; return true; } } as unknown as DmndClient;
  const cache = new QueryClient();
  try {
    const options = workerPresenceQueryOptions(cache, client, 'owner');
    assert.equal(await cache.fetchQuery(options), true);
    now += 60 * 60_000;
    assert.equal(await cache.fetchQuery(options), true);
    assert.equal(reads, 1);
    assert.equal(options.refetchInterval({ state: { data: true } }), false);
    cache.setQueryData(['account', 'workers-all', 'sub'], [{ name: 'cached-rig' }]);
    assert.equal(await cache.fetchQuery(workerPresenceQueryOptions(cache, client, 'sub')), true);
    assert.equal(reads, 1);
  } finally { cache.clear(); }
});

test('an old empty roster cannot prevent setup from discovering a new worker', async (t) => {
  let now = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const cache = new QueryClient();
  try {
    cache.setQueryData(['account', 'workers-all', 'owner'], []);
    now += 6 * 60_000;
    const client = { hasWorkers: async () => true } as unknown as DmndClient;
    assert.equal(await cache.fetchQuery(workerPresenceQueryOptions(cache, client, 'owner')), true);
  } finally { cache.clear(); }
});

test('hidden watcher resources probe once and resume only for their visible section', () => {
  const pending = { state: { error: null, dataUpdatedAt: 0, errorUpdatedAt: 0 } };
  const success = { state: { error: null, dataUpdatedAt: 1, errorUpdatedAt: 0 } };
  assert.equal(watcherQueryPolicy(true, false, false).enabled(pending), true);
  assert.equal(watcherQueryPolicy(true, false, false).enabled(success), false);
  assert.equal(watcherQueryPolicy(true, false, true).enabled(success), true);
  assert.equal(watcherQueryPolicy(true, true, true).enabled(success), false);
  assert.equal(watcherQueryPolicy(true, false, true).enabled({ state: { error: new WatcherRequestError('denied', 403) } }), false);
  assert.equal(isAggregatedRestrictedRoute('/watcher-links'), true);
});


test('only the visible subaccount page refreshes, shares snapshots, and bounds summary concurrency', async (t) => {
  let now = Date.parse('2026-10-22T12:00:10Z');
  t.mock.method(Date, 'now', () => now);
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const client = createUser({ fetchImpl: async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path.endsWith('/sub_account')) return Response.json(Array.from({ length: 100 }, (_, i) => ({
      id: String(i), sub_account: `Farm ${i}`, token: `token-${i}`, fpps_token: null, hashrate: '999', bitcoin_addresses: {},
    })));
    maxInFlight = Math.max(maxInFlight, ++inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
    return Response.json({ hashrate: { total_hashrate: now, pplns_hashrate: now, fpps_hashrate: 0 },
      share_stats: { accepted: 99, rejected: 1 }, today_generated_btc: 0.001 });
  } });
  const cache = new QueryClient();
  try {
    const snapshot = await loadSubaccountRows(cache, client, 'owner', false, new AbortController().signal);
    assert.equal(calls.length, 101, 'the initial snapshot loads every summary once');
    calls.length = 0;
    const first = visibleSubaccountQueryOptions(cache, client, 'owner', snapshot.slice(0, 10));
    await cache.fetchQuery(first);
    assert.equal(calls.length, 0, 'visible rows reuse summaries from the initial snapshot');
    now = Date.parse('2026-10-22T12:05:01Z');
    const updated = await cache.fetchQuery(first);
    assert.equal(calls.length, 10, 'the next five-minute tick reads only ten visible summaries');
    assert.ok(calls.every((path) => path.endsWith('/summary')), 'no roster, history or account-list reads');
    assert.equal(snapshot[0].hashrate, Date.parse('2026-10-22T12:00:10Z'), 'the all-account overview remains a dated snapshot');
    assert.equal(updated[0].hashrate, now);
    calls.length = 0;
    const second = visibleSubaccountQueryOptions(cache, client, 'owner', snapshot.slice(10, 20));
    await cache.fetchQuery(second);
    assert.equal(calls.length, 10, 'changing pages refreshes just the next ten rows');
    assert.ok(calls.every((path) => Number(path.split('/').at(-2)) >= 10));
    calls.length = 0;
    await cache.fetchQuery(first);
    assert.equal(calls.length, 0, 'returning to a fresh page reuses the cache');
    assert.ok(maxInFlight <= 4, 'large accounts must not issue unbounded simultaneous requests');
  } finally { cache.clear(); }
});


test('Home generation shares summary caches by owner and active account without reading earnings history', async (t) => {
  let now = Date.parse('2026-10-22T12:00:10Z');
  t.mock.method(Date, 'now', () => now);
  const calls: { path: string; owner: string | null }[] = [];
  const client = createUser({ fetchImpl: async (url, options) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, owner: new Headers(options?.headers).get('X-Account-ID') });
    if (path.endsWith('/sub_account')) return Response.json([
      { id: 'farm-a', sub_account: 'Farm A', token: 'token', fpps_token: null, hashrate: '0', bitcoin_addresses: {} },
    ]);
    return Response.json({ sub_account_id: path.split('/').at(-2),
      hashrate: { total_hashrate: 10, pplns_hashrate: 0, fpps_hashrate: 10 },
      share_stats: { accepted: 99, rejected: 1 }, today_generated_btc: 0.002 });
  } });
  const cache = new QueryClient();
  try {
    await loadSubaccountRows(cache, client, 'owner', false, new AbortController().signal);
    const initialCount = calls.length;
    const farm = accountSummaryQueryOptions(client, 'owner', 'farm-a');
    assert.equal((await cache.fetchQuery(farm)).today_generated_btc, 0.002);
    assert.equal(calls.length, initialCount, 'Home reuses a fresh summary loaded on Subaccounts');
    await cache.fetchQuery(accountSummaryQueryOptions(client, 'owner', 'owner'));
    assert.deepEqual(calls.at(-1), { path: '/api/user/sub_account/owner/summary', owner: 'owner' });
    await cache.fetchQuery(accountSummaryQueryOptions(client, 'other-owner', 'farm-a'));
    assert.equal(calls.at(-1)?.owner, 'other-owner', 'summaries must never cross owner identities');
    now += 5 * 60_000;
    await cache.fetchQuery(farm);
    assert.equal(calls.at(-1)?.path, '/api/user/sub_account/farm-a/summary');
    assert.equal(calls.length, initialCount + 3);
    assert.ok(calls.every(({ path }) => !path.includes('generated_btc') && !path.includes('historical')));
  } finally { cache.clear(); }
});
