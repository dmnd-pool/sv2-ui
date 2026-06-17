import assert from 'node:assert/strict';
import test from 'node:test';

import { createDmndClient } from '../client';
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
