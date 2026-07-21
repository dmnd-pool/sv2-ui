import assert from 'node:assert/strict';
import test from 'node:test';

import type { WatcherLink } from '@/api/types';
import {
  MULTIWATCHER_MODES,
  modeLabel,
  eligibleScopes,
  isLinkEligible,
  eligibleLinks,
  highestPerAccount,
  multiwatcherUrl,
  parseMultiwatcherPath,
} from '@/lib/multiwatcher';

function link(over: Partial<WatcherLink> = {}): WatcherLink {
  return {
    id: '1',
    user_id: 'acct-1',
    token: 'TOK1',
    owner_email: 'm@x.io',
    owner_first_name: 'A',
    scopes: ['hashrate_read'],
    created_at: '2026-06-29T00:00:00Z',
    expires_at: null,
    ...over,
  };
}

test('the three enforcement modes are hashrate, generated_btc, and both, in that order', () => {
  assert.deepEqual(MULTIWATCHER_MODES, ['hashrate', 'generated_btc', 'both']);
  assert.equal(modeLabel('hashrate'), 'Hashrate');
  assert.equal(modeLabel('generated_btc'), 'Generated BTC');
  assert.equal(modeLabel('both'), 'Generated BTC and Hashrate');
});

test('each mode requires the scopes it enforces', () => {
  assert.deepEqual(eligibleScopes('hashrate'), ['hashrate_read']);
  assert.deepEqual(eligibleScopes('generated_btc'), ['earnings_read']);
  assert.deepEqual(eligibleScopes('both'), ['hashrate_read', 'earnings_read']);
});

test('a link is eligible only when it grants every scope the mode enforces', () => {
  assert.equal(isLinkEligible(link({ scopes: ['hashrate_read'] }), 'hashrate'), true);
  assert.equal(isLinkEligible(link({ scopes: ['earnings_read'] }), 'hashrate'), false);
  assert.equal(isLinkEligible(link({ scopes: ['hashrate_read', 'earnings_read'] }), 'both'), true);
  // "both" needs both scopes; a link with only one does not qualify
  assert.equal(isLinkEligible(link({ scopes: ['hashrate_read'] }), 'both'), false);
});

test('eligibleLinks keeps only the links usable for the mode', () => {
  const rows = [
    link({ id: 'a', scopes: ['hashrate_read'] }),
    link({ id: 'b', scopes: ['earnings_read'] }),
    link({ id: 'c', scopes: ['hashrate_read', 'earnings_read'] }),
  ];
  assert.deepEqual(eligibleLinks(rows, 'hashrate').map((l) => l.id), ['a', 'c']);
  assert.deepEqual(eligibleLinks(rows, 'generated_btc').map((l) => l.id), ['b', 'c']);
  assert.deepEqual(eligibleLinks(rows, 'both').map((l) => l.id), ['c']);
});

test('highestPerAccount keeps one link per account: the one granting the most scopes', () => {
  const rows = [
    link({ id: 'a1', user_id: 'acct-1', scopes: ['hashrate_read'] }),
    link({ id: 'a2', user_id: 'acct-1', scopes: ['hashrate_read', 'earnings_read', 'workers_read'] }),
    link({ id: 'b1', user_id: 'acct-2', scopes: ['hashrate_read'] }),
  ];
  const out = highestPerAccount(rows);
  assert.deepEqual(out.map((l) => l.id).sort(), ['a2', 'b1']);
});

test('multiwatcherUrl encodes the numeric mode then flattened user/token pairs', () => {
  const links = [link({ user_id: 'acct-1', token: 'TOK1' }), link({ user_id: 'acct-2', token: 'TOK2' })];
  assert.equal(
    multiwatcherUrl('https://dash.example.com', 'both', links),
    'https://dash.example.com/login/multiwatcher/2/acct-1/TOK1/acct-2/TOK2',
  );
  assert.equal(
    multiwatcherUrl('https://dash.example.com/', 'hashrate', [link({ user_id: 'x', token: 'y' })]),
    'https://dash.example.com/login/multiwatcher/0/x/y',
  );
});

test('parseMultiwatcherPath reads back the mode and the user/token pairs', () => {
  assert.deepEqual(parseMultiwatcherPath(['2', 'acct-1', 'TOK1', 'acct-2', 'TOK2']), {
    mode: 'both',
    entries: [
      { userId: 'acct-1', token: 'TOK1' },
      { userId: 'acct-2', token: 'TOK2' },
    ],
  });
  assert.deepEqual(parseMultiwatcherPath(['0', 'x', 'y']), {
    mode: 'hashrate',
    entries: [{ userId: 'x', token: 'y' }],
  });
  // an odd number of pair segments, an unknown mode, or no entries is not a valid link
  assert.equal(parseMultiwatcherPath(['2', 'acct-1']), null);
  assert.equal(parseMultiwatcherPath(['9', 'x', 'y']), null);
  assert.equal(parseMultiwatcherPath(['2']), null);
  assert.equal(parseMultiwatcherPath([]), null);
});
