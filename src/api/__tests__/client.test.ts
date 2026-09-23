import assert from 'node:assert/strict';
import test from 'node:test';

import { createUser, setDmndAccountId, subscribeToDmndAuthRejections } from '../client';
import { DmndApiError } from '../types';
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('login posts email and password to log_user and returns the session', async () => {
  const session = { token: 'abc', id: '42', email: 'm@x.io', two_factor_secret: null, bitcoin_addresses: {} };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createUser({ fetchImpl, backoffMs: 0 });

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

test('login includes the authenticator code only when completing a 2FA challenge', async () => {
  const session = { token: 'abc', id: '42', email: 'm@x.io', two_factor_secret: null, bitcoin_addresses: {} };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await client.login('m@x.io', 'pw', '123456');

  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    email: 'm@x.io',
    password: 'pw',
    language: 'En',
    totp_token: '123456',
  });
});

test('a 401 surfaces as an unauthorized error without retrying', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 401 }));
  const client = createUser({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

  await assert.rejects(
    () => client.login('m@x.io', 'wrong'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'unauthorized',
  );
  assert.equal(calls.length, 1);
});

test('an authenticated 401 reports the rejected account to the auth layer', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 401 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });
  const rejectedAccounts: Array<string | null> = [];
  const unsubscribe = subscribeToDmndAuthRejections(({ accountId }) => rejectedAccounts.push(accountId));

  try {
    await assert.rejects(() => client.getHashrate({ accountId: 'master' }), DmndApiError);
    assert.deepEqual(rejectedAccounts, ['master']);
  } finally {
    unsubscribe();
  }
});

test('a broker 401 does not reject the miner session', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 401 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });
  const rejectedAccounts: Array<string | null> = [];
  const unsubscribe = subscribeToDmndAuthRejections(({ accountId }) => rejectedAccounts.push(accountId));

  try {
    await assert.rejects(() => client.brokerMiners(0), DmndApiError);
    assert.deepEqual(rejectedAccounts, []);
  } finally {
    unsubscribe();
  }
});

test('an idempotent auth check retries up to the limit then throws a network error', async () => {
  const { fetchImpl, calls } = fakeFetch(() => {
    throw new Error('connection refused');
  });
  const client = createUser({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

  await assert.rejects(
    () => client.checkAuth(),
    (e: unknown) =>
      e instanceof DmndApiError &&
      e.code === 'network' &&
      e.message === "We couldn't connect. Check your internet connection and try again.",
  );
  assert.equal(calls.length, 3);
});

test('login uses one attempt because replaying it can rotate a successful session cookie', async () => {
  const { fetchImpl, calls } = fakeFetch(() => {
    throw new Error('connection closed before the response');
  });
  const client = createUser({ fetchImpl, backoffMs: 0, maxAttempts: 3 });

  await assert.rejects(
    () => client.login('m@x.io', 'pw', '123456'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'network',
  );
  assert.equal(calls.length, 1);
});

test('a rejected referral code reported as a 500 keeps its own message and does not retry', async () => {
  const body = JSON.stringify({ code: 'internal-error', message: 'Invalid referral code' });
  const { fetchImpl, calls } = fakeFetch(() => new Response(body, { status: 500 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(
    () => client.signup({ email: 'm@x.io', password: 'pw', firstName: 'Ada', lastName: 'Lovelace', referralCode: 'NOPE' }),
    (e: unknown) =>
      e instanceof DmndApiError && e.code === 'other' && e.message === 'Invalid referral code',
  );
  assert.equal(calls.length, 1, 'the code cannot become valid on a retry');
});

test('a 5xx retries and surfaces a user-friendly message without implementation details', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 500 }));
  const client = createUser({ fetchImpl, backoffMs: 0, maxAttempts: 2 });

  await assert.rejects(
    () => client.checkAuth(),
    (e: unknown) =>
      e instanceof DmndApiError &&
      e.code === 'server' &&
      e.message === "We couldn't complete your request right now. Please try again in a moment." &&
      !/DMND|500|server error/i.test(e.message),
  );
  assert.equal(calls.length, 2);
});

test('resetPassword posts email, code, two_fa_token and new_password (snake_case)', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

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
  const client = createUser({ fetchImpl, backoffMs: 0 });

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
  const session = {
    token: 'x',
    id: '42',
    email: 'm@x.io',
    company_name: 'DMND Mining',
    company_primary_location: 'Lagos, NG',
    kyb_status: 'Approved',
    two_factor_secret: null,
  };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.checkAuth();

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/check_auth'));
  assert.deepEqual(result, session);
  assert.equal(result.company_name, 'DMND Mining');
  assert.equal(result.company_primary_location, 'Lagos, NG');
});

test('signup forwards company fields and referral when provided', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

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
  const rows = [{ id: '1', sub_account: 'Main Farm', token: 'mining-token', fpps_token: null, api_token: null, hashrate: '0', bitcoin_addresses: {} }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createUser({ fetchImpl, backoffMs: 0 });
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
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getPermissions();

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/user/permissions'));
  assert.deepEqual(result, perms);
});

test('createSubaccount POSTs sub_account and bitcoin_address', async () => {
  const { fetchImpl, calls } = fakeFetch(() => new Response('', { status: 200 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await client.createSubaccount({ name: 'Warehouse 01', bitcoinAddress: 'bc1qexample' });

  assert.ok(calls[0].url.endsWith('/api/user/sub_account'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    sub_account: 'Warehouse 01',
    bitcoin_address: 'bc1qexample',
  });
});

test('logSubaccount POSTs owner_token and subaccount_token and returns the new session', async () => {
  const session = {
    token: 'sub-tok',
    id: 'returned-sub-id',
    email: 'm@x.io',
    company_name: 'DMND Mining',
    company_primary_location: 'Lagos, NG',
    kyb_status: 'Approved',
    two_factor_secret: null,
  };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(session));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  setDmndAccountId('unrelated-active-account');
  const result = await (async () => {
    try {
      return await client.logSubaccount('owner-tok', 'subacct-tok', { accountId: 'master' });
    } finally {
      setDmndAccountId(null);
    }
  })();

  assert.ok(calls[0].url.endsWith('/api/log_subaccount'));
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], 'master');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    owner_token: 'owner-tok',
    subaccount_token: 'subacct-tok',
  });
  assert.deepEqual(result, session);
  assert.equal(result.id, 'returned-sub-id');
});

test('getSubaccountSummary uses the master session without a query token', async () => {
  const body = {
    sub_account_id: '-77',
    hashrate: { account_id: '-77', observed_at: null, pplns_hashrate: 0, fpps_hashrate: 0, total_hashrate: 0 },
    share_stats: { window_hours: 24, pplns_accepted: 0, pplns_rejected: 0, fpps_accepted: 0, fpps_rejected: 0, accepted: 0, rejected: 0 },
    fees: { pool_fee: 0.02, broker_fee: 0.005 },
    today_generated_btc: null,
  };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(body));
  const client = createUser({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    await client.getSubaccountSummary('-77', {});
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(calls[0].url.endsWith('/api/user/sub_account/-77/summary'));
    assert.equal(calls[0].url.includes('token='), false);
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
  } finally {
    setDmndAccountId(null);
  }
});

test('getSubaccountWorkers uses the master session without a query token', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ workers: [], next_cursor: null }));
  const client = createUser({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('currently-viewed-subaccount');
  try {
    await client.getSubaccountWorkers('-77', { accountId: 'master' });
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(calls[0].url.includes('/api/user/sub_account/-77/workers'));
    assert.equal(calls[0].url.includes('token='), false);
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], 'master');
  } finally {
    setDmndAccountId(null);
  }
});

test('getSubaccountWorkers follows pagination on the live per-subaccount endpoint', async () => {
  const first = { name: 'first', hashrate: 1, total_shares: 0, rejected_shares: 0, is_connected: true };
  const second = { name: 'second', hashrate: 2, total_shares: 0, rejected_shares: 0, is_connected: true };
  const { fetchImpl, calls } = fakeFetch(({ url }) =>
    jsonResponse(
      url.includes('cursor=page-2')
        ? { workers: [second], next_cursor: null }
        : { workers: [first], next_cursor: 'page-2' },
    ),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getSubaccountWorkers('-77');

  assert.deepEqual(result, { workers: [first, second], next_cursor: null });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url.includes('/api/user/sub_account/-77/workers')));
  assert.ok(calls[1].url.includes('cursor=page-2'));
});

test('getGeneratedBtc GETs the generated_btc list with the X-Account-ID header', async () => {
  const rows = [{ entry_day: '2026-06-21', hashrate: 100, btc_generated: 0.0001, fpps_btc_generated: 0.0001, pplns_btc_generated: 0, pplns_hashrate: 0 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createUser({ fetchImpl, backoffMs: 0 });
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

test('getGeneratedBtc rejects a non-array response', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'nope' }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(() => client.getGeneratedBtc());
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
  const client = createUser({ fetchImpl, backoffMs: 0 });
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

test('getWatcherLinks rejects a non-array response', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'nope' }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(() => client.getWatcherLinks());
});

test('createWatcherLink POSTs the target account and scopes in snake_case', async () => {
  const created = { id: '200', user_id: '-739', token: 'NEW', scopes: ['hashrate_read'] };
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(created));
  const client = createUser({ fetchImpl, backoffMs: 0 });

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
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await client.revokeWatcherLink('531');

  assert.equal(calls[0].init.method, 'DELETE');
  assert.ok(calls[0].url.endsWith('/api/api-tokens/531'));
});

test('getSubaccountGeneratedBtc uses the master session without a query token', async () => {
  const rows = [{ entry_day: '2026-07-08', hashrate: 98, btc_generated: 0.00001274, fpps_btc_generated: 0.00001274, pplns_btc_generated: 0, pplns_hashrate: 0 }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(rows));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getSubaccountGeneratedBtc('-77', { accountId: 'master' });

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/user/sub_account/-77/generated_btc'));
  assert.equal(calls[0].url.includes('token='), false);
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], 'master');
  assert.deepEqual(result, rows);
});

test('getSubaccountGeneratedBtc rejects a non-array response', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'nope' }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(() => client.getSubaccountGeneratedBtc('-77'));
});

test('a 4xx with a server message surfaces it as an unknown error', async () => {
  const { fetchImpl } = fakeFetch(
    () =>
      new Response(JSON.stringify({ code: 'low-password-entropy', message: 'Add another word or two' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(
    () => client.login('a@b.co', 'pw'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'other' && e.message === 'Add another word or two',
  );
});

test('brokerLogin posts to broker/log and maps referenceCode', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ id: '7', email: 'b@x.io', referenceCode: 'RC-1' }),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.brokerLogin('b@x.io', 'pw');

  assert.ok(calls[0].url.endsWith('/api/broker/log'));
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { email: 'b@x.io', password: 'pw' });
  assert.deepEqual(result, { id: '7', email: 'b@x.io', referenceCode: 'RC-1' });
});

test('brokerSignup posts a flat body to /api/brokers and reads referenceCode', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ id: '9', email: 'b@x.io', referenceCode: 'RC-9' }),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });

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
  assert.deepEqual(result, { id: '9', email: 'b@x.io', referenceCode: 'RC-9' });
});

test('miner requests send the X-Account-ID header when an account id is set', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ token: 'x', id: '42', email: 'm@x.io', two_factor_secret: null }),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('42');
  try {
    await client.checkAuth();
  } finally {
    setDmndAccountId(null);
  }
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
});

test('a request-scoped account id cannot be changed by a later dashboard switch', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ token: 't' }));
  const client = createUser({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('sub-2');
  try {
    await client.checkAuth({ accountId: 'master' });
    assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], 'master');
  } finally {
    setDmndAccountId(null);
  }
});

test('broker requests never send the miner X-Account-ID header', async () => {
  const { fetchImpl, calls } = fakeFetch(() =>
    jsonResponse({ id: '7', email: 'b@x.io', referenceCode: 'RC-1' }),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });
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
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getHashrateHistory('2026-06-23T00:00:00.000Z', '2026-06-30T00:00:00.000Z');

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.includes('/api/v1/user/hashrate/historical?'));
  assert.ok(calls[0].url.includes('from=2026-06-23T00%3A00%3A00.000Z'));
  assert.ok(calls[0].url.includes('to=2026-06-30T00%3A00%3A00.000Z'));
  assert.deepEqual(result, points);
});

test('getHashrateHistory rejects a non-array response', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse(0));
  const client = createUser({ fetchImpl, backoffMs: 0 });
  await assert.rejects(() => client.getHashrateHistory('2026-09-01', '2026-09-02'));
});

test('getSubaccountHashrateHistory reuses an existing subaccount session for raw H/s', async () => {
  const points = [{
    account_id: '-77',
    observed_at: '2026-06-30T00:00:00Z',
    pplns_hashrate: 12_500_000_000_123,
    fpps_hashrate: 2_000_000_000_000_456,
    total_hashrate: 2_012_500_000_000_579,
  }];
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(points));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getSubaccountHashrateHistory(
    '-77',
    '2026-06-29T00:00:00.000Z',
    '2026-06-30T00:00:00.000Z',
    'owner-token',
    'subaccount-token',
    { accountId: 'master' },
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/api/v1/user/hashrate/historical?'));
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '-77');
  assert.deepEqual(result, points);
});

test('getSubaccountHashrateHistory issues a missing subaccount session and retries raw H/s', async () => {
  const points = [{
    account_id: '-88',
    observed_at: '2026-06-30T00:00:00Z',
    pplns_hashrate: 12_500_000_000_123,
    fpps_hashrate: 2_000_000_000_000_456,
    total_hashrate: 2_012_500_000_000_579,
  }];
  let responseIndex = 0;
  const { fetchImpl, calls } = fakeFetch(() => {
    responseIndex += 1;
    if (responseIndex === 1) return new Response('', { status: 401 });
    if (responseIndex === 2) {
      return jsonResponse({ id: '-88', token: 'subaccount-token', email: 'sub@example.com' });
    }
    return jsonResponse(points);
  });
  const client = createUser({ fetchImpl, backoffMs: 0 });
  const rejectedAccounts: Array<string | null> = [];
  const unsubscribe = subscribeToDmndAuthRejections(({ accountId }) => rejectedAccounts.push(accountId));

  try {
    const result = await client.getSubaccountHashrateHistory(
      '-77',
      '2026-06-29T00:00:00.000Z',
      '2026-06-30T00:00:00.000Z',
      'owner-token',
      'subaccount-token',
      { accountId: 'master' },
    );

    assert.deepEqual(result, points);
    assert.deepEqual(rejectedAccounts, []);
  } finally {
    unsubscribe();
  }

  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.includes('/api/v1/user/hashrate/historical?'));
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '-77');
  assert.ok(calls[1].url.endsWith('/api/log_subaccount'));
  assert.equal((calls[1].init.headers as Record<string, string>)['X-Account-ID'], 'master');
  assert.deepEqual(JSON.parse(calls[1].init.body as string), {
    owner_token: 'owner-token',
    subaccount_token: 'subaccount-token',
  });
  assert.ok(calls[2].url.includes('/api/v1/user/hashrate/historical?'));
  assert.equal((calls[2].init.headers as Record<string, string>)['X-Account-ID'], '-88');
});

test('getAllWorkers follows next_cursor across pages and concatenates the roster', async () => {
  const pages = [
    { workers: [{ name: 'w1' }], next_cursor: 'c1' },
    { workers: [{ name: 'w2' }], next_cursor: null },
  ];
  let i = 0;
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(pages[i++]));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const workers = await client.getAllWorkers();

  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes('/api/workers/all?'));
  assert.ok(!calls[0].url.includes('cursor='));
  assert.ok(calls[1].url.includes('cursor=c1'));
  assert.deepEqual(workers.map((w) => w.name), ['w1', 'w2']);
});

test('getAllWorkers keeps every page pinned to the requested account', async () => {
  let page = 0;
  const { fetchImpl, calls } = fakeFetch(() => {
    page += 1;
    // Simulate the account switcher changing the ambient account while pagination is
    // in progress. The roster request must remain on the account it started for.
    if (page === 1) setDmndAccountId('subaccount');
    return jsonResponse({ workers: [{ name: `w${page}` }], next_cursor: page === 1 ? 'next' : null });
  });
  const client = createUser({ fetchImpl, backoffMs: 0 });
  setDmndAccountId('master');
  try {
    await client.getAllWorkers({ accountId: 'master' });
  } finally {
    setDmndAccountId(null);
  }

  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => (call.init.headers as Record<string, string>)['X-Account-ID']),
    ['master', 'master'],
  );
});

test('getAllWorkers keeps paging past 50 pages, stopping only when next_cursor is null', async () => {
  const TOTAL = 60;
  let i = 0;
  const { fetchImpl, calls } = fakeFetch(() => {
    i += 1;
    return jsonResponse({ workers: [{ name: `w${i}` }], next_cursor: i < TOTAL ? `c${i}` : null });
  });
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const workers = await client.getAllWorkers();

  assert.equal(calls.length, TOTAL);
  assert.equal(workers.length, TOTAL);
});

test('getAllWorkers stops when the server re-serves a cursor it already gave', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ workers: [{ name: 'w' }], next_cursor: 'stuck' }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const workers = await client.getAllWorkers();

  assert.equal(calls.length, 2);
  assert.equal(workers.length, 2);
});

test('getPayouts follows the v1 cursor pages and preserves the UTC date window', async () => {
  const first = { txid: 'a', output_index: 0, kind: 'fpps', address: 'bc1qa', amount_sats: 10, confirmed_at: 1 };
  const second = { txid: 'b', output_index: 2, kind: 'pplns', address: 'bc1qb', amount_sats: 20, confirmed_at: 2 };
  const { fetchImpl, calls } = fakeFetch(({ url }) =>
    jsonResponse(url.includes('cursor=next')
      ? { payouts: [second], next_cursor: null }
      : { payouts: [first], next_cursor: 'next' }),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getPayouts({ from: '2026-09-01', to: '2026-09-23' }, { accountId: '42' });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls.every((call) => call.url.includes('/api/v1/user/payouts?')));
  assert.ok(calls.every((call) => call.url.includes('from=2026-09-01')));
  assert.ok(calls.every((call) => call.url.includes('to=2026-09-23')));
  assert.ok(calls[1].url.includes('cursor=next'));
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], '42');
  assert.deepEqual(result, [first, second]);
});

test('getSubaccountPayouts uses the exact v1 subaccount route', async () => {
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse({ payouts: [], next_cursor: null }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  assert.deepEqual(await client.getSubaccountPayouts('-77', {}, { accountId: 'master' }), []);

  assert.ok(calls[0].url.includes('/api/v1/user/sub_account/-77/payouts?limit=100'));
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Account-ID'], 'master');
});

test('getPplnsProjection GETs the sub_account projection and returns it', async () => {
  const body = pplnsProjectionFixture();
  const { fetchImpl, calls } = fakeFetch(() => jsonResponse(body));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  const result = await client.getPplnsProjection('123');

  assert.equal(calls[0].init.method, 'GET');
  assert.ok(calls[0].url.endsWith('/api/user/sub_account/123/pplns_projection'));
  assert.deepEqual(result, body);
});

test('getPplnsProjection rejects a projection for a different account', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ ...pplnsProjectionFixture(), subaccount_id: '456' }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(() => client.getPplnsProjection('123'), /account does not match/);
});

test('a 404 means nothing is cached yet, so getPplnsProjection returns null', async () => {
  const { fetchImpl } = fakeFetch(() => new Response('', { status: 404 }));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  assert.equal(await client.getPplnsProjection('acct-1'), null);
});

test('a 400 remains an error regardless of missing-projection message text', async () => {
  const { fetchImpl } = fakeFetch(() =>
    jsonResponse({ message: 'PPLNS projection is not available for this boundary' }, 400),
  );
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(() => client.getPplnsProjection('acct-1'));
});

test('any other 4xx stays an error rather than reading as an empty cache', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ message: 'Bad subaccount id' }, 400));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(
    () => client.getPplnsProjection('acct-1'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'other' && e.status === 400,
  );
});

test('an auth failure is an error even when its body names the missing projection', async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ message: 'projection-not-found' }, 403));
  const client = createUser({ fetchImpl, backoffMs: 0 });

  await assert.rejects(
    () => client.getPplnsProjection('acct-1'),
    (e: unknown) => e instanceof DmndApiError && e.code === 'unauthorized',
  );
});
