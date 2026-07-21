import assert from 'node:assert/strict';
import test from 'node:test';

import { createWatcherClient } from '../watcherClient';

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

test('getWorkers passes the token in the query and sends NO cookie or account header', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ workers: [], next_cursor: null }));
  const client = createWatcherClient('SECRETTOKEN', { fetchImpl });

  await client.getWorkers();

  const call = calls[0];
  assert.ok(call.url.includes('/api/workers/all'));
  assert.ok(call.url.includes('token=SECRETTOKEN'));
  // the whole point: a public page must not leak the owner's session
  assert.notEqual(call.init.credentials, 'include');
  const headers = (call.init.headers ?? {}) as Record<string, string>;
  assert.equal(headers['X-Account-ID'], undefined);
});

test('getHashrate passes the token and sends no credentials', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ pplns_hashrate: 1, fpps_hashrate: 2, total_hashrate: 3 }),
  );
  const client = createWatcherClient('TOK', { fetchImpl });

  await client.getHashrate();

  assert.ok(calls[0].url.includes('/api/user/hashrate?'));
  assert.ok(calls[0].url.includes('token=TOK'));
  assert.notEqual(calls[0].init.credentials, 'include');
});

test('getHashrateHistory passes the token plus the RFC3339 window', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse([]));
  const client = createWatcherClient('TOK', { fetchImpl });

  await client.getHashrateHistory('2026-07-01T00:00:00Z', '2026-07-17T00:00:00Z');

  const url = calls[0].url;
  assert.ok(url.includes('/api/user/hashrate/historical?'));
  assert.ok(url.includes('token=TOK'));
  assert.ok(url.includes('from=2026-07-01'));
  assert.ok(url.includes('to=2026-07-17'));
});

test('getGeneratedBtc passes the token and collapses a non-array to an empty list', async () => {
  const rows = [{ entry_day: '2026-06-21', hashrate: 100, btc_generated: 0.0001 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createWatcherClient('TOK', { fetchImpl });

  const result = await client.getGeneratedBtc();
  // The token-authenticated path: /api/generated_btc is session-only and rejects a
  // watcher token, so an earnings-only link must read /api/user/generated_btc.
  assert.ok(calls[0].url.includes('/api/user/generated_btc?'));
  assert.ok(calls[0].url.includes('token=TOK'));
  assert.notEqual(calls[0].init.credentials, 'include');
  assert.deepEqual(result, rows);

  const bad = fakeFetch(() => jsonResponse({ error: 'x' }));
  const c2 = createWatcherClient('TOK', { fetchImpl: bad.fetchImpl });
  assert.deepEqual(await c2.getGeneratedBtc(), []);
});

test('getFees passes the token and reads the current pool and broker fee rates', async () => {
  const fees = { pool_fee: 2, broker_fee: 0.5 };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(fees));
  const client = createWatcherClient('TOK', { fetchImpl });

  const result = await client.getFees();
  assert.ok(calls[0].url.includes('/api/user/fees?'));
  assert.ok(calls[0].url.includes('token=TOK'));
  assert.notEqual(calls[0].init.credentials, 'include');
  assert.deepEqual(result, fees);
});

test('a 401 (revoked or wrong token) surfaces as an unauthorized error', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 401 }));
  const client = createWatcherClient('BAD', { fetchImpl });

  await assert.rejects(() => client.getWorkers(), (e: unknown) => e instanceof Error);
});

test('a non-array historical response collapses to an empty series', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ not: 'an array' }));
  const client = createWatcherClient('TOK', { fetchImpl });

  assert.deepEqual(await client.getHashrateHistory('2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z'), []);
});
