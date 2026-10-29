import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOtpAuthUri, buildResetOtpAuthUri } from '../otpauth';

test('buildOtpAuthUri encodes the issuer-prefixed label and carries the secret', () => {
  const uri = buildOtpAuthUri('JBSWY3DPEHPK3PXP', 'miner@dmnd.work');
  assert.ok(uri.startsWith('otpauth://totp/DMND%3Aminer%40dmnd.work?'));
  const query = new URLSearchParams(uri.split('?')[1]);
  assert.equal(query.get('secret'), 'JBSWY3DPEHPK3PXP');
  assert.equal(query.get('issuer'), 'DMND');
  assert.equal(query.get('digits'), '6');
  assert.equal(query.get('period'), '30');
  assert.equal(query.get('algorithm'), 'SHA1');
});

test('buildOtpAuthUri accepts a custom issuer', () => {
  const uri = buildOtpAuthUri('ABC234', 'a@b.io', 'DMND Pool');
  assert.ok(uri.startsWith('otpauth://totp/DMND%20Pool%3Aa%40b.io?'));
  assert.equal(new URLSearchParams(uri.split('?')[1]).get('issuer'), 'DMND Pool');
});

test('reset enrollment uses a readable local date and time to distinguish entries', () => {
  const original = new URL(buildOtpAuthUri('ORIGINAL', 'miner@dmnd.work'));
  const first = new URL(buildResetOtpAuthUri('FIRST', 'miner@dmnd.work', new Date(2026, 9, 29, 14, 35)));
  const second = new URL(buildResetOtpAuthUri('SECOND', 'miner@dmnd.work', new Date(2026, 9, 29, 14, 40)));
  assert.equal(new Set([original.pathname, first.pathname, second.pathname]).size, 3);
  assert.equal(first.searchParams.get('issuer'), 'DMND');
  assert.equal(first.searchParams.get('secret'), 'FIRST');
  assert.equal(second.searchParams.get('secret'), 'SECOND');
  assert.equal(decodeURIComponent(first.pathname), '/DMND:miner@dmnd.work (added 29 Oct 2026, 2.35.00.000 pm)');
});

test('reset entry times format midnight, noon, and single-digit minutes', () => {
  for (const [hours, minutes, expected] of [[0, 5, '12.05.00.000 am'], [12, 0, '12.00.00.000 pm']] as const) {
    const uri = new URL(buildResetOtpAuthUri('SECRET', 'miner@example.com', new Date(2026, 9, 29, hours, minutes)));
    assert.equal(decodeURIComponent(uri.pathname), `/DMND:miner@example.com (added 29 Oct 2026, ${expected})`);
  }
});

test('successive resets within a minute preserve separate authenticator entries', () => {
  const labels = [new Date(2026, 9, 29, 14, 35, 10, 100), new Date(2026, 9, 29, 14, 35, 10, 200), new Date(2026, 9, 29, 14, 35, 20, 100)]
    .map((date) => new URL(buildResetOtpAuthUri('SECRET', 'miner@example.com', date)).pathname);
  assert.equal(new Set(labels).size, labels.length);
});
