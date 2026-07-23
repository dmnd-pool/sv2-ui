import assert from 'node:assert/strict';
import test from 'node:test';

import { createDmndClient, setDmndAccountId } from '../client';
import { DmndApiError } from '../types';

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('login posts email and password to log_user and returns the session', async () => {
  const session = { token: 'abc', id: '42', email: 'm@x.io', two_factor_secret: null, bitcoin_addresses: {} };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.login('m@x.io', 'pw');

  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/log_user'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    email: 'm@x.io',
    password: 'pw',
    language: 'En',
  });
  assert.deepEqual(result, session);
});

test('a 401 surfaces as an unauthorized error without retrying', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 401 }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

  await assert.rejects(
    () => client.login('m@x.io', 'wrong'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'unauthorized',
  );
  assert.equal(calls.length, 1);
});

test('a network failure retries up to the limit then throws a network error', async () => {
  const { fetchImpl, calls } = fakeFetch(() => {
    throw new Error('connection refused');
  });
  const client = createDmndClient({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

  await assert.rejects(
    () => client.login('m@x.io', 'pw'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'network',
  );
  assert.equal(calls.length, 3);
});

test('resetPassword posts email, code, two_fa_token and new_password (snake_case)', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await client.resetPassword('m@x.io', '123456', '654321', 'river-tunnel-9');

  assert.ok(calls[0].url.endsWith('/api/reset_password'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    email: 'm@x.io',
    code: '123456',
    two_fa_token: '654321',
    new_password: 'river-tunnel-9',
  });
});

test('signup posts the full account body, defaulting company fields and referral', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await client.signup({ email: 'm@x.io', password: 'longenough', firstName: 'Ada', lastName: 'Lovelace' });

  assert.ok(calls[0].url.endsWith('/api/users'));
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    register: {
      email: 'm@x.io',
      password: 'longenough',
      firstName: 'Ada',
      lastName: 'Lovelace',
      companyName: '',
      companyPrimaryLocation: '',
      referral: null,
      language: 'En',
    },
  });
});

test('checkAuth GETs check_auth and returns the session', async () => {
  const session = { token: 'x', id: '42', email: 'm@x.io', two_factor_secret: null };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.checkAuth();

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/check_auth'));
  assert.deepEqual(result, session);
});

test('signup forwards company fields and referral when provided', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await client.signup({
    email: 'm@x.io',
    password: 'longenough',
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Demand',
    companyLocation: 'Lisbon, PT',
    referralCode: 'FRIEND',
  });

  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    register: {
      email: 'm@x.io',
      password: 'longenough',
      firstName: 'Ada',
      lastName: 'Lovelace',
      companyName: 'Demand',
      companyPrimaryLocation: 'Lisbon, PT',
      referral: 'FRIEND',
      language: 'En',
    },
  });
});

test('getSubaccounts GETs user/sub_account, sends X-Account-ID, and returns the list', async () => {
  const rows = [{ sub_account_id: 1, sub_account: 'Main Farm', today_generated_btc: 0.00042 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    const result = await client.getSubaccounts();
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(calls[0].url.endsWith('/api/user/sub_account'));
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
    assert.deepEqual(result, rows);
  } finally {
    setDmndAccountId(null);
  }
});

test('getPermissions GETs user/permissions and returns the flags', async () => {
  const perms = { view_sub_accounts: true, create_sub_account: true, edit_btc_address: false };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(perms));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.getPermissions();

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/user/permissions'));
  assert.deepEqual(result, perms);
});

test('createSubaccount POSTs sub_account and bitcoin_address', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await client.createSubaccount({ name: 'Warehouse 01', bitcoinAddress: 'bc1qexample' });

  assert.ok(calls[0].url.endsWith('/api/user/sub_account'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    sub_account: 'Warehouse 01',
    bitcoin_address: 'bc1qexample',
  });
});

test('logSubaccount POSTs owner_token and subaccount_token and returns the new session', async () => {
  const session = { token: 'sub-tok', id: '7', email: 'm@x.io', two_factor_secret: null };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.logSubaccount('owner-tok', 'subacct-tok');

  assert.ok(calls[0].url.endsWith('/api/log_subaccount'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    owner_token: 'owner-tok',
    subaccount_token: 'subacct-tok',
  });
  assert.deepEqual(result, session);
});

test('getSubaccountSummary GETs the per-subaccount summary with a token and the X-Account-ID header', async () => {
  const body = { sub_account_id: -77, hashrate: null, share_stats: null, fees: null, today_generated_btc: null };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(body));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    await client.getSubaccountSummary('-77', 'sub-tok', {});
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(calls[0].url.includes('/api/user/sub_account/-77/summary'));
    assert.ok(calls[0].url.includes('token=sub-tok'));
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
  } finally {
    setDmndAccountId(null);
  }
});

test('getSubaccountWorkers GETs the per-subaccount workers with a token', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ workers: [], next_cursor: null }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await client.getSubaccountWorkers('-77', 'sub-tok');

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.includes('/api/user/sub_account/-77/workers'));
  assert.ok(calls[0].url.includes('token=sub-tok'));
});

test('getGeneratedBtc GETs the generated_btc list with the X-Account-ID header', async () => {
  const rows = [{ entry_day: '2026-06-21', hashrate: 100, btc_generated: 0.0001 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    const result = await client.getGeneratedBtc();
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(calls[0].url.endsWith('/api/generated_btc'));
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
    assert.deepEqual(result, rows);
  } finally {
    setDmndAccountId(null);
  }
});

test('getGeneratedBtc collapses a non-array response to an empty list', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'nope' }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  assert.deepEqual(await client.getGeneratedBtc(), []);
});

test('getWatcherLinks GETs the api-tokens list with the X-Account-ID header', async () => {
  const rows = [
    {
      id: '199',
      user_id: '-739',
      token: 'TOK',
      owner_email: 'm@x.io',
      owner_first_name: 'Ada',
      scopes: ['hashrate_read', 'workers_read'],
      created_at: '2026-06-29T08:24:00Z',
      expires_at: null,
    },
  ];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    const result = await client.getWatcherLinks();
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(calls[0].url.endsWith('/api/api-tokens'));
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
    assert.deepEqual(result, rows);
  } finally {
    setDmndAccountId(null);
  }
});

test('getWatcherLinks collapses a non-array response to an empty list', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'nope' }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  assert.deepEqual(await client.getWatcherLinks(), []);
});

test('createWatcherLink POSTs the target account and scopes in snake_case', async () => {
  const created = { id: '200', user_id: '-739', token: 'NEW', scopes: ['hashrate_read'] };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(created));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.createWatcherLink({ targetUserId: '-739', scopes: ['hashrate_read'] });

  assert.ok(calls[0].url.endsWith('/api/api-tokens'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    target_user_id: '-739',
    scopes: ['hashrate_read'],
  });
  assert.deepEqual(result, created);
});

test('revokeWatcherLink DELETEs the link by id', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await client.revokeWatcherLink('531');

  assert.equal(calls[0].init.method, 'DELETE');
  assert.ok(calls[0].url.endsWith('/api/api-tokens/531'));
});

test('getSubaccountGeneratedBtc GETs the per-subaccount generated-BTC list with a token', async () => {
  const rows = [{ entry_day: '2026-07-08', hashrate: 98, btc_generated: 0.00001274 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.getSubaccountGeneratedBtc('-77', 'sub-tok');

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.includes('/api/user/sub_account/-77/generated_btc'));
  assert.ok(calls[0].url.includes('token=sub-tok'));
  assert.deepEqual(result, rows);
});

test('getSubaccountGeneratedBtc collapses a non-array response to an empty list', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'nope' }));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  assert.deepEqual(await client.getSubaccountGeneratedBtc('-77', 'sub-tok'), []);
});

test('a 4xx with a server message surfaces it as an unknown error', async () => {
  const { fetchImpl } = fakeFetch(
    () =>
      new Response(JSON.stringify({ code: 'low-password-entropy', message: 'Add another word or two' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  await assert.rejects(
    () => client.login('a@b.co', 'pw'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'unknown' && e.message === 'Add another word or two',
  );
});

test('brokerLogin posts to broker/log and maps referenceCode', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ id: 7, email: 'b@x.io', referenceCode: 'RC-1' }),
  );
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.brokerLogin('b@x.io', 'pw');

  assert.ok(calls[0].url.endsWith('/api/broker/log'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { email: 'b@x.io', password: 'pw' });
  assert.deepEqual(result, { id: 7, email: 'b@x.io', referenceCode: 'RC-1' });
});

test('brokerSignup posts a flat body to /api/brokers and normalizes reference_code', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ id: '9', email: 'b@x.io', reference_code: 'RC-9' }),
  );
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.brokerSignup({
    email: 'b@x.io',
    password: 'longenough',
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Demand',
    companyLocation: 'Lisbon, PT',
  });

  assert.ok(calls[0].url.endsWith('/api/brokers'));
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    email: 'b@x.io',
    password: 'longenough',
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Demand',
    companyLocation: 'Lisbon, PT',
  });
  // snake_case reference_code from signup normalizes to referenceCode
  assert.deepEqual(result, { id: '9', email: 'b@x.io', referenceCode: 'RC-9' });
});

test('miner requests send the X-Account-ID header when an account id is set', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ token: 'x', id: '42', email: 'm@x.io', two_factor_secret: null }),
  );
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    await client.checkAuth();
  } finally {
    setDmndAccountId(null);
  }
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
});

test('broker requests never send the miner X-Account-ID header', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ id: 7, email: 'b@x.io', referenceCode: 'RC-1' }),
  );
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  // A miner account id can linger in the same tab; broker calls must ignore it.
  setDmndAccountId('42');
  try {
    await client.brokerLogin('b@x.io', 'pw');
    await client.brokerSignup({
      email: 'b@x.io',
      password: 'longenough',
      firstName: 'Ada',
      lastName: 'Lovelace',
      companyName: 'Demand',
      companyLocation: 'Lisbon, PT',
    });
  } finally {
    setDmndAccountId(null);
  }
  for (const call of calls) {
    assert.equal((call.init.headers as Record<string, string>)['X-Account-ID'], undefined);
  }
});

test('getHashrateHistory GETs the historical endpoint with from/to and returns the points', async () => {
  const points = [{ observed_at: '2026-06-30T00:00:00Z', pplns_hashrate: 1, fpps_hashrate: 2, total_hashrate: 3 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(points));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.getHashrateHistory('2026-06-23T00:00:00.000Z', '2026-06-30T00:00:00.000Z');

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.includes('/api/user/hashrate/historical?'));
  assert.ok(calls[0].url.includes('from=2026-06-23T00%3A00%3A00.000Z'));
  assert.ok(calls[0].url.includes('to=2026-06-30T00%3A00%3A00.000Z'));
  assert.deepEqual(result, points);
});

test('getHashrateHistory collapses a non-array response to an empty series', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse(0));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });
  assert.deepEqual(await client.getHashrateHistory('a', 'b'), []);
});

test('getAllWorkers follows next_cursor across pages and concatenates the roster', async () => {
  const pages = [
    { workers: [{ name: 'w1' }], next_cursor: 'c1' },
    { workers: [{ name: 'w2' }], next_cursor: null },
  ];
  let i = 0;
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(pages[i++]));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const workers = await client.getAllWorkers();

  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes('/api/workers/all?'));
  assert.ok(!calls[0].url.includes('cursor='));
  assert.ok(calls[1].url.includes('cursor=c1'));
  assert.deepEqual(workers.map((w) => w.name), ['w1', 'w2']);
});

test('getPayoutAddresses GETs the payout addresses', async () => {
  const addrs = { fpps_payout_address: 'bc1qfpps', pplns_payout_address: 'bc1qpplns' };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(addrs));
  const client = createDmndClient({ fetchImpl, backoffMs: 0 });

  const result = await client.getPayoutAddresses();

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/payouts/addresses'));
  assert.deepEqual(result, addrs);
});
