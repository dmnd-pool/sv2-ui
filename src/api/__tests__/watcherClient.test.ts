import assert from 'node:assert/strict';
import test from 'node:test';

import { createWatcherClient } from '../watcherClient';
import { pplnsProjectionFixture } from './pplnsProjectionFixture';

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const call: Call = { url: String(url), init: (init ?? {}) as RequestInit };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('getWorkers passes the token in the Authorization header and sends NO cookie or account header', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ workers: [], next_cursor: null }));
  const client = createWatcherClient('SECRETTOKEN', { fetchImpl });

  await client.getWorkers();

  const call = calls[0];
  assert.ok(call.url.includes('/api/workers/all'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer SECRETTOKEN');
  // the whole point: a public page must not leak the owner's session
  assert.notEqual(call.init.credentials, 'include');
  const headers = (call.init.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-Account-ID'], undefined);
});

test('getWorkers follows pagination until the complete watcher roster is loaded', async () => {
  const first = { name: 'first', hashrate: 1, total_shares: 0, rejected_shares: 0, is_connected: true };
  const second = { name: 'second', hashrate: 2, total_shares: 0, rejected_shares: 0, is_connected: true };
  const { fetchImpl, calls } = fakeFetch(({ url }) =>
    jsonResponse(
      url.includes('cursor=page-2')
        ? { workers: [second], next_cursor: null }
        : { workers: [first], next_cursor: 'page-2' },
    ),
  );
  const client = createWatcherClient('TOK', { fetchImpl });

  const result = await client.getWorkers();

  assert.deepEqual(result, { workers: [first, second], next_cursor: null });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.includes('cursor=page-2'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer TOK');
});

test('getHashrate passes the token and sends no credentials', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ pplns_hashrate: 1, fpps_hashrate: 2, total_hashrate: 3 }),
  );
  const client = createWatcherClient('TOK', { fetchImpl });

  await client.getHashrate();

  assert.ok(calls[0].url.includes('/api/user/hashrate?'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer TOK');
  assert.notEqual(calls[0].init.credentials, 'include');
});

test('getHashrateHistory passes the token plus the RFC3339 window', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse([]));
  const client = createWatcherClient('TOK', { fetchImpl });

  await client.getHashrateHistory('2026-07-01T00:00:00Z', '2026-07-17T00:00:00Z');

  const url = calls[0].url;
  assert.ok(url.includes('/api/user/hashrate/historical?'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer TOK');
  assert.ok(url.includes('from=2026-07-01'));
  assert.ok(calls.at(-1)!.url.includes('to=2026-07-17'));
  assert.equal(calls.length, 3);
});

test('getGeneratedBtc uses bearer auth and rejects malformed earnings', async () => {
  const rows = [{ entry_day: '2026-06-21', hashrate: 100, btc_generated: 0.0001, fpps_btc_generated: 0.0001, pplns_btc_generated: 0, pplns_hashrate: 0 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createWatcherClient('TOK', { fetchImpl });

  const result = await client.getGeneratedBtc('123');
  // Exact-account reads exclude directly owned subaccounts.
  assert.ok(calls[0].url.includes('/api/user/sub_account/123/generated_btc?'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer TOK');
  assert.notEqual(calls[0].init.credentials, 'include');
  assert.deepEqual(result, rows);

  const bad = fakeFetch(() => jsonResponse({ error: 'x' }));
  const c2 = createWatcherClient('TOK', { fetchImpl: bad.fetchImpl });
  await assert.rejects(() => c2.getGeneratedBtc('123'));
});

test('getPayouts uses the same earnings-scoped watcher token and follows every page', async () => {
  const first = {
    txid: 'tx-1', output_index: 0, kind: 'fpps', address: 'bc1first', amount_sats: 10, confirmed_at: 1,
  };
  const second = {
    txid: 'tx-2', output_index: 1, kind: 'pplns', address: 'bc1second', amount_sats: 20, confirmed_at: 2,
  };
  const { fetchImpl, calls } = fakeFetch(({ url }) =>
    jsonResponse(url.includes('cursor=next')
      ? { payouts: [second], next_cursor: null }
      : { payouts: [first], next_cursor: 'next' }),
  );
  const client = createWatcherClient('TOK', { fetchImpl });

  const result = await client.getPayouts('123');

  assert.deepEqual(result, [first, second]);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes('/api/v1/user/sub_account/123/payouts?limit=100'));
  assert.ok(calls[1].url.includes('cursor=next'));
  assert.ok(calls.every((call) => new Headers(call.init.headers).get('Authorization') === 'Bearer TOK'));
  assert.ok(calls.every((call) => call.init.credentials !== 'include'));
});

test('getPayouts rejects a malformed payout page', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ payouts: null, next_cursor: null }));
  const client = createWatcherClient('TOK', { fetchImpl });

  await assert.rejects(() => client.getPayouts('123'), /Invalid payouts response/);
});

test('getFees passes the token and reads the current pool and broker fee rates', async () => {
  const fees = { pool_fee: 0.02, broker_fee: 0.005 };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(fees));
  const client = createWatcherClient('TOK', { fetchImpl });

  const result = await client.getFees();
  assert.ok(calls[0].url.includes('/api/user/fees?'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer TOK');
  assert.notEqual(calls[0].init.credentials, 'include');
  assert.deepEqual(result, fees);
});

test('a 401 (revoked or wrong token) surfaces as an unauthorized error', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 401 }));
  const client = createWatcherClient('BAD', { fetchImpl });

  await assert.rejects(() => client.getWorkers(), (e: unknown) => e instanceof Error);
});

test('a watcher server failure does not expose an HTTP status or implementation detail', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 500 }));
  const client = createWatcherClient('TOK', { fetchImpl });

  await assert.rejects(
    () => client.getWorkers(),
    (e: unknown) =>
      e instanceof Error &&
      e.message === "We couldn't load this Watcher view. Please try again in a moment." &&
      !/500|request failed/i.test(e.message),
  );
});

test('a non-array historical response is rejected', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ not: 'an array' }));
  const client = createWatcherClient('TOK', { fetchImpl });

  await assert.rejects(() => client.getHashrateHistory('2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z'));
});

test('getPplnsProjection reads the account path with the token and no session', async () => {
  const body = pplnsProjectionFixture();
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(body));
  const client = createWatcherClient('SECRETTOKEN', { fetchImpl });

  const result = await client.getPplnsProjection('00123');

  const call = calls[0];
  assert.ok(call.url.includes('/api/user/sub_account/00123/pplns_projection'));
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer SECRETTOKEN');
  assert.notEqual(call.init.credentials, 'include');
  assert.deepEqual(result, body);
});

test('getPplnsProjection rejects a projection for a different watcher account', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ ...pplnsProjectionFixture(), subaccount_id: '456' }));
  const client = createWatcherClient('TOK', { fetchImpl });

  await assert.rejects(() => client.getPplnsProjection('123'), /account does not match/);
});

test('getPplnsProjection returns null when nothing is cached yet', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 404 }));
  const client = createWatcherClient('TOK', { fetchImpl });

  assert.equal(await client.getPplnsProjection('acct-1'), null);
});

test('a token that cannot read the projection still reports the link as invalid', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 403 }));
  const client = createWatcherClient('TOK', { fetchImpl });

  await assert.rejects(
    () => client.getPplnsProjection('acct-1'),
    (e: unknown) => e instanceof Error && e.message === 'This Watcher link is no longer valid.',
  );
});
