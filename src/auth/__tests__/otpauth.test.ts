import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOtpAuthUri } from '../otpauth';

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
