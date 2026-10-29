import { WorkerStatCardsView, TodayGeneratedBtcCard, LatestPayoutCard } from '@/components/home/WorkerStatCards';
import { TopBarView } from '@/components/dashboard/TopBar';
import { POOL_URL, POOL_USERNAME_HINT } from '../poolConnection';
import { CONNECTION_SAFETY_WARNING, connectionDetailsToText, isConnectionExportAllowed, resolveConnectionAccount } from '@/components/workers/ConnectionDetails';
import type { DmndSession, Subaccount } from '@/api/types';
import { fetchLatestBlogPost, latestBlogQueryOptions } from '@/hooks/useAccountData';
import type { Payout } from '@/lib/payoutsTable';
import { PayoutStatCards } from '@/pages/payouts/PayoutsPage';
import { GeneratedBtcTable } from '@/components/generated-btc/GeneratedBtcTable';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';
import { PplnsProjectionStatCards } from '@/components/pplns-projection/PplnsProjectionStatCards';
import { pplnsProjectionFixture } from '@/api/__tests__/pplnsProjectionFixture';
import { generatedBtcRowId } from '@/lib/generatedBtcTable';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/auth/AuthProvider';
import { createSession } from '@/auth/session';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { ToastProvider } from '@/components/ui/toast';
import { WatcherLinksTable } from '@/components/watcher-links/WatcherLinksTable';
import { TableToolbar } from '@/components/ui/TableToolbar';
import type { WatcherLink } from '@/api/types';
import { useAccountScope } from '@/hooks/useAccountScope';

function ScopeProbe() {
  const scope = useAccountScope();
  return createElement('span', null, JSON.stringify(scope));
}

test('permission controls deny access while loading, after denial, and inside a subaccount', () => {
  for (const state of ['loading', 'denied', 'main', 'subaccount']) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const viewingAccountId = state === 'subaccount' ? 'sub' : null;
    const auth: AuthContextValue = {
      session: createSession({ accountId: 'owner', email: 'owner@example.com', company_name: null, company_primary_location: null, kyb_status: 'Approved' }),
      viewingAccountId, viewingAccount: null, status: 'authenticated', signOutReason: null,
      signIn: () => {}, signOut: () => {}, setViewingAccount: () => {},
    };
    if (state !== 'loading') client.setQueryData(['account', 'permissions', viewingAccountId ?? 'owner'], {
      view_sub_accounts: state !== 'denied', edit_btc_address: state !== 'denied',
    });
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AuthContext.Provider, { value: auth }, createElement(ScopeProbe))));
      assert.ok(html.includes(`canViewSubaccounts&quot;:${state === 'main'}`));
      assert.ok(html.includes(`canEditBitcoinAddress&quot;:${state === 'main'}`));
    } finally { client.clear(); }
  }
});

test('change password is enabled for a loaded main account and disabled in a subaccount', () => {
  for (const { viewingAccountId, mainAccount } of [
    { viewingAccountId: null, mainAccount: true },
    { viewingAccountId: 'sub', mainAccount: false },
    { viewingAccountId: null, mainAccount: false },
  ]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const session = createSession({ accountId: 'owner', email: 'owner@example.com', company_name: 'Acme Mining', company_primary_location: null, kyb_status: 'Approved' });
    const auth: AuthContextValue = {
      session, viewingAccountId, viewingAccount: null, status: 'authenticated', signOutReason: null,
      signIn: () => {}, signOut: () => {}, setViewingAccount: () => {},
    };
    const id = viewingAccountId ?? session.accountId;
    client.setQueryData(['account', 'profile', id], { id, two_factor_secret: null });
    client.setQueryData(['account', 'permissions', id], { view_sub_accounts: mainAccount });
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AuthContext.Provider, { value: auth }, createElement(ToastProvider, null, createElement(SecurityTab)))));
      const button = html.match(/<button[^>]*>Change password<\/button>/)?.[0];
      assert.ok(button);
      if (!mainAccount) assert.match(button, /disabled/);
      else assert.doesNotMatch(button, /disabled=""/);
    } finally { client.clear(); }
  }
});

test('watcher-link selection reflects row and partially selected header state', () => {
  const links: WatcherLink[] = ['first', 'second'].map((id) => ({
    id, user_id: 'owner', token: null, token_prefix: 'prefix', last_used_at: null,
    owner_email: 'owner@example.com', owner_first_name: null, scopes: ['workers_read'],
    created_at: '2026-10-21T12:00:00Z', expires_at: null,
  }));
  const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement(WatcherLinksTable, {
    links, sessionAccountId: 'owner', subaccounts: [], origin: 'https://example.com', onView: () => {},
    selected: new Set(['first']), someSelected: true, onToggleAll: () => {}, onToggleOne: () => {},
  })));
  assert.match(html, /aria-checked="mixed" aria-label="Select all watcher links"/);
  assert.match(html, /aria-checked="true" aria-label="Select watcher link first"/);
  assert.match(html, /aria-checked="false" aria-label="Select watcher link second"/);
});

test('table toolbars retain their accessible label without repeating the page heading', () => {
  const html = renderToStaticMarkup(createElement(TableToolbar, {
    title: 'Workers', query: '', onQuery: () => {}, searchPlaceholder: 'Search workers',
    filterActive: false, renderFilter: () => null,
  }));
  assert.match(html, /aria-label="Workers"/);
  assert.doesNotMatch(html, /<h[1-6]/);
});

const profile: DmndSession = {
  id: 'owner', email: 'owner@example.com', company_name: 'Owner', company_primary_location: null, kyb_status: 'Approved',
  token: 'owner-pplns', fpps_token: 'owner-fpps', two_factor_secret: null, bitcoin_addresses: {},
};
const subaccounts: Subaccount[] = [
  { id: 'farm-a', sub_account: 'Farm A', token: 'farm-a-pplns', fpps_token: 'farm-a-fpps', hashrate: '0', bitcoin_addresses: {} },
  { id: 'farm-b', sub_account: 'Farm B', token: 'farm-b-pplns', fpps_token: null, hashrate: '0', bitcoin_addresses: {} },
];
const context = { currentId: 'owner', currentName: 'Main account', profile, subaccounts };

test('subaccount exports are restricted to the acting account, including stale all-account selections', () => {
  assert.equal(isConnectionExportAllowed('farm-a', 'farm-a', false), true);
  assert.equal(isConnectionExportAllowed('owner', 'farm-a', false), false);
  assert.equal(isConnectionExportAllowed('farm-b', 'farm-a', false), false);
  assert.equal(isConnectionExportAllowed('all', 'farm-a', false), false);
  assert.equal(isConnectionExportAllowed('all', 'owner', false), false);
});

test('confirmed main accounts may export an individual account or all accounts', () => {
  assert.equal(isConnectionExportAllowed('farm-a', 'owner', true), true);
  assert.equal(isConnectionExportAllowed('all', 'owner', true), true);
  assert.equal(isConnectionExportAllowed('all', null, true), false);
  assert.equal(isConnectionExportAllowed('', 'owner', true), false);
});

test('aggregate setup requires an explicit target instead of exposing main-account passwords by default', () => {
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: null }), null);
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'deleted-account' }), null);
});

test('aggregate setup uses only the chosen account credentials and label', () => {
  assert.deepEqual(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'farm-a' }), {
    id: 'farm-a', name: 'Farm A', pplnsPassword: 'farm-a-pplns', fppsPassword: 'farm-a-fpps',
  });
  assert.deepEqual(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'owner' }), {
    id: 'owner', name: 'Main account', pplnsPassword: 'owner-pplns', fppsPassword: 'owner-fpps',
  });
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'farm-b' })?.fppsPassword, null);
});

test('single-account setup ignores aggregate selections and follows the current authenticated account', () => {
  const current = resolveConnectionAccount({ ...context, aggregated: false, selectedId: 'farm-a' });
  assert.equal(current?.id, 'owner');
  assert.equal(current?.pplnsPassword, 'owner-pplns');
  const subProfile = { ...profile, id: 'farm-a', token: 'current-sub-pplns', fpps_token: 'current-sub-fpps' };
  assert.deepEqual(resolveConnectionAccount({ ...context, aggregated: false, selectedId: 'owner', currentId: 'farm-a', currentName: 'Farm A', profile: subProfile }), {
    id: 'farm-a', name: 'Farm A', pplnsPassword: 'current-sub-pplns', fppsPassword: 'current-sub-fpps',
  });
});

test('a stale or missing profile never exposes credentials under another account label', () => {
  assert.equal(resolveConnectionAccount({ ...context, aggregated: false, selectedId: null, currentId: 'farm-a', currentName: 'Farm A' }), null);
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'owner', profile: undefined }), null);
});

const main = { id: '1', name: 'Main account', pplnsPassword: 'main-pplns-secret', fppsPassword: 'main-fpps-secret' };
const sub = { id: '2', name: 'Farm A', pplnsPassword: 'sub-pplns-secret', fppsPassword: null };

test('single-account setup export includes its credentials, warning and connection instructions', () => {
  const content = connectionDetailsToText([sub]);
  assert.ok(content.includes(CONNECTION_SAFETY_WARNING));
  assert.ok(content.includes(POOL_URL));
  assert.ok(content.includes(POOL_USERNAME_HINT));
  assert.ok(content.includes('Account: "Farm A" (ID: 2)'));
  assert.ok(content.includes('PPLNS password: sub-pplns-secret'));
  assert.ok(content.includes('FPPS password: Not available'));
  assert.ok(!content.includes(main.pplnsPassword));
});

test('all-account setup export keeps each payout password with the correct account', () => {
  const content = connectionDetailsToText([main, sub]);
  assert.ok(content.includes('Account: "Main account" (ID: 1)\nPPLNS password: main-pplns-secret\nFPPS password: main-fpps-secret'));
  assert.ok(content.includes('Account: "Farm A" (ID: 2)\nPPLNS password: sub-pplns-secret\nFPPS password: Not available'));
});

test('exports fail rather than producing an empty or incomplete setup sheet', () => {
  assert.throws(() => connectionDetailsToText([]));
  assert.throws(() => connectionDetailsToText([main, { ...sub, pplnsPassword: '' }]));
});

test('fetches the newest published post and its image without dashboard credentials', async () => {
  const controller = new AbortController();
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('limit'), '1');
    assert.equal(url.searchParams.get('order'), 'published_at desc');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.signal, controller.signal);
    return Response.json({ posts: [{ title: 'Latest news', url: 'https://blog.dmnd.work/latest/', feature_image: 'https://storage.ghost.io/latest.png' }] });
  };
  assert.deepEqual(await fetchLatestBlogPost(controller.signal, fetchImpl), {
    title: 'Latest news', url: 'https://blog.dmnd.work/latest/', image: 'https://storage.ghost.io/latest.png',
  });
});

test('handles empty blogs and posts without an image', async () => {
  assert.equal(await fetchLatestBlogPost(undefined, async () => Response.json({ posts: [] })), null);
  assert.equal((await fetchLatestBlogPost(undefined, async () => Response.json({ posts: [{ title: 'News', url: 'https://blog.dmnd.work/news/', feature_image: null }] })))?.image, null);
});

test('rejects failed responses and links outside the blog', async () => {
  await assert.rejects(fetchLatestBlogPost(undefined, async () => new Response('', { status: 503 })));
  await assert.rejects(fetchLatestBlogPost(undefined, async () => Response.json({ posts: [{ title: 'News', url: 'https://unrelated.example/' }] })));
});

test('a login shares one blog request across remounts; a later login gets a fresh request', async () => {
  const client = new QueryClient();
  let requests = 0;
  const options = {
    ...latestBlogQueryOptions('owner', 1),
    queryFn: async () => { requests++; return { title: 'News', url: 'https://blog.dmnd.work/news/', image: null }; },
  };
  try {
    await client.prefetchQuery(options);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    unsubscribe();
    await client.prefetchQuery(options);
    assert.equal(requests, 1);
    await client.prefetchQuery({ ...options, queryKey: latestBlogQueryOptions('owner', 2).queryKey });
    assert.equal(requests, 2);
  } finally { client.clear(); }
});

test('a failed login prefetch is not retried when Help opens', async () => {
  const client = new QueryClient();
  let requests = 0;
  const options = {
    ...latestBlogQueryOptions('owner', 1),
    queryFn: async () => { requests++; throw new Error('Unavailable'); },
  };
  try {
    await client.prefetchQuery(options);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();
    assert.equal(requests, 1);
  } finally { client.clear(); }
});

test('payouts no longer expose row selection', () => {
  const html = renderToStaticMarkup(createElement(PayoutsTable, { payouts: [{
    date: 1, txid: 'tx', amountSats: 1, mode: 'fpps', toAddress: 'addr', outputIndex: 0, fromAddress: '',
  }] }));
  assert.doesNotMatch(html, /role="checkbox"/);
});

test('generated BTC selection identifies accounts separately when they share a date', () => {
  const entries = ['Main account', 'Farm'].map((account) => ({
    entry_day: '2026-10-21', account, hashrate: 1, pplns_hashrate: 0, fpps_btc_generated: 0.001, pplns_btc_generated: 0, btc_generated: 0.001,
  }));
  const html = renderToStaticMarkup(createElement(GeneratedBtcTable, {
    entries, showAccount: true, selected: new Set([generatedBtcRowId(entries[1])]), someSelected: true,
  }));
  assert.match(html, /aria-checked="mixed"/);
  assert.match(html, /aria-checked="false" aria-label="Select generated BTC for 2026-10-21 \(Main account\)"/);
  assert.match(html, /aria-checked="true" aria-label="Select generated BTC for 2026-10-21 \(Farm\)"/);
});

test('PPLNS projection has a persistent page heading and working selection controls', () => {
  const projection = pplnsProjectionFixture();
  const html = renderToStaticMarkup(createElement(PplnsProjectionPanel, { projection, isLoading: false, isError: false }));
  assert.match(html, /<h2[^>]*>PPLNS projection<\/h2>/);
  assert.match(html, /Track your retained mining work and projected PPLNS rewards/);
  assert.match(html, /Select all PPLNS work days/);
  assert.match(html, /Select PPLNS work for 2026-08-31/);
  const refreshing = renderToStaticMarkup(createElement(PplnsProjectionPanel, {
    projection, isLoading: false, isError: false,
    updateStatus: createElement('span', { role: 'status' }, 'Last updated 29 Oct 2026, 2.35 pm · Updating…'),
  }));
  assert.match(refreshing, /Last updated 29 Oct 2026, 2.35 pm · Updating…/);
  assert.match(refreshing, /Select PPLNS work for 2026-08-31/);
  const loading = renderToStaticMarkup(createElement(PplnsProjectionPanel, { projection: undefined, isLoading: true, isError: false }));
  assert.match(loading, /<h2[^>]*>PPLNS projection<\/h2>/);
  const readonly = renderToStaticMarkup(createElement(PplnsProjectionPanel, { projection, isLoading: false, isError: false, selectable: false }));
  assert.doesNotMatch(readonly, /role="checkbox"/);
});

test('PPLNS average hashrate averages the daily rates instead of summing them', () => {
  const base = pplnsProjectionFixture().daily_work[0];
  const dailyWork = [1000, 3000].map((rate, index) => ({
    ...base,
    work_day: `2026-08-${30 + index}`,
    retained_difficulty: rate * 86400 / 2 ** 32,
  }));
  const html = renderToStaticMarkup(createElement(PplnsProjectionStatCards, { dailyWork }));
  assert.match(html, /Average PPLNS hashrate/);
  assert.match(html, /2 KH\/s/);
  assert.doesNotMatch(html, /4 KH\/s/);
  const empty = renderToStaticMarkup(createElement(PplnsProjectionStatCards, { dailyWork: [] }));
  assert.doesNotMatch(empty, /NaN|Infinity/);
  assert.match(empty, />--<\/span>/);
});

const payouts: Payout[] = [{
  date: Date.UTC(2026, 5, 21, 10) / 1000,
  txid: 'tx',
  amountSats: 241_000,
  mode: 'fpps',
  toAddress: 'bc1quser',
  outputIndex: 0,
  fromAddress: '',
}];

test('payout cards show BTC amounts with static captions', () => {
  const html = renderToStaticMarkup(createElement(PayoutStatCards, { payouts, isLoading: false, isError: false }));
  assert.match(html, /Total paid out/);
  assert.match(html, /Total payout count/);
  assert.match(html, /0\.00241/);
  assert.match(html, /Most recent confirmed payout/);
  assert.match(html, /Last 30 days \(UTC\)/);
  assert.doesNotMatch(html, /All-time/);
});

test('payout cards distinguish empty history from loading and failed data', () => {
  const empty = renderToStaticMarkup(createElement(PayoutStatCards, { payouts: [], isLoading: false, isError: false }));
  assert.match(empty, /Most recent confirmed payout/);
  assert.equal((empty.match(/>0<\/span>/g) ?? []).length, 2);

  for (const state of [{ isLoading: true, isError: false }, { isLoading: false, isError: true }]) {
    // Cached rows must not look current when a refresh fails.
    const html = renderToStaticMarkup(createElement(PayoutStatCards, { payouts, ...state }));
    assert.equal((html.match(/>--<\/span>/g) ?? []).length, 3);
    assert.doesNotMatch(html, /0\.00241/);
    assert.match(html, /Last 30 days \(UTC\)/);
    assert.match(html, /Confirmed outputs over 30 days/);
    assert.match(html, /Most recent confirmed payout/);
    assert.doesNotMatch(html, /Loading payouts|Payout statistics unavailable/);
  }
});


test('Home puts confirmed payouts and generated FPPS BTC before mining health without mixing their values', () => {
  const aggregated = { totalWorkers: 2, activeWorkers: 1, offlineWorkers: 1, combinedHashrate: 10,
    todayEarnings: 0.002, rejectionRate: 0.01 };
  const html = renderToStaticMarkup(createElement(WorkerStatCardsView, {
    aggregated, payout: { amountSats: 1_000_000, date: Date.UTC(2026, 9, 20) / 1000 }, generatedBtc: aggregated.todayEarnings, showGenerated: true,
  }));
  assert.ok(html.indexOf("Today&#x27;s Generated BTC") < html.indexOf('Latest payout'));
  assert.ok(html.indexOf('Latest payout') < html.indexOf('Active workers'));
  assert.match(html, /Latest payout[\s\S]*>0\.01<\/span>/);
  assert.match(html, /Today&#x27;s Generated BTC[\s\S]*>0\.002<\/span>/);
  assert.match(html, /Generated across all accounts today./);
  assert.doesNotMatch(html, /Today's earnings/);
  const watcher = renderToStaticMarkup(createElement(WorkerStatCardsView, { payout: { amountSats: 1_000_000, date: 1_700_000_000 } }));
  assert.doesNotMatch(watcher, /Today&#x27;s Generated BTC/, 'public views must explicitly grant generation visibility');
});

test('rejection captions describe the account scope even before mining starts', () => {
  const aggregated = { totalWorkers: 0, activeWorkers: 0, offlineWorkers: 0, combinedHashrate: 0,
    todayEarnings: 0, rejectionRate: null };
  const single = renderToStaticMarkup(createElement(WorkerStatCardsView));
  const combined = renderToStaticMarkup(createElement(WorkerStatCardsView, { aggregated }));
  assert.match(single, /Rejected shares over the last 24 hours for this account\./);
  assert.match(combined, /Rejected shares over the last 24 hours across all accounts\./);
  assert.doesNotMatch(single + combined, /Rejected share rate will appear after mining starts/);
});

test('the generated BTC card distinguishes unavailable figures from genuine zero generation', () => {
  const unknown = renderToStaticMarkup(createElement(TodayGeneratedBtcCard));
  assert.match(unknown, />--<\/span>/);
  const zero = renderToStaticMarkup(createElement(TodayGeneratedBtcCard, { generatedBtc: 0 }));
  assert.match(zero, />0<\/span>/);
  assert.match(zero, /Generated by this account today./);
  assert.doesNotMatch(zero, />--<\/span>/);
});

test('the shared header displays the viewing account separately from the page title at every viewport', () => {
  for (const scope of ['Main account', 'Subaccount: Farm A', 'All accounts']) {
    const html = renderToStaticMarkup(createElement(TopBarView, { scope, onMenuClick: () => {} }));
    assert.match(html, /aria-label="Viewing account"/);
    const label = html.match(/<p aria-label="Viewing account"[^>]*>.*?<\/p>/)?.[0];
    assert.ok(label?.includes(scope));
    assert.doesNotMatch(label!, /hidden/);
    if (scope === 'All accounts') assert.match(label!, /Main account and all subaccounts/);
  }
});


test('latest payout retains the payment date and distinguishes no history from unavailable data', () => {
  const html = renderToStaticMarkup(createElement(LatestPayoutCard, {
    payout: { date: Date.UTC(2026, 9, 20) / 1000, amountSats: 12345678 },
  }));
  assert.match(html, /Latest payout/);
  assert.match(html, />0\.12345678<\/span>/);
  assert.match(html, /Paid .*20.*2026.*\(UTC\)/);
  const empty = renderToStaticMarkup(createElement(LatestPayoutCard, { payout: null }));
  assert.match(empty, /No confirmed payouts in the last 30 days/);
  const unknown = renderToStaticMarkup(createElement(LatestPayoutCard));
  assert.match(unknown, />--<\/span>/);
});

test('refresh notice occupies its own top-bar element outside the account identity block', () => {
  const html = renderToStaticMarkup(createElement(TopBarView, { scope: 'Main account', onMenuClick: () => {} }));
  assert.match(html, /Main account<\/p><\/div><p aria-label="Refresh interval"/);
  assert.match(html, /Live data/);
  assert.match(html, /refreshes every 5 min/i);
  const payouts = renderToStaticMarkup(createElement(TopBarView, { refreshIntervalMinutes: 10, refreshSubject: 'Payouts', onMenuClick: () => {} }));
  assert.match(payouts, /refreshes every 10 min/i);
});
