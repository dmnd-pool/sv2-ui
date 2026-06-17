import assert from 'node:assert/strict';
import test from 'node:test';

import { DmndApiError } from '@/api';
import { isTwoFactorRequiredError } from '../resetErrors';

test('isTwoFactorRequiredError is true only for the exact backend 2FA message', () => {
  assert.equal(isTwoFactorRequiredError(new DmndApiError('Invalid 2FA token', 'unknown')), true);
});

test('isTwoFactorRequiredError is false for near-misses and other failures', () => {
  // Strings the old regex matched are now correctly rejected (exact match only).
  assert.equal(isTwoFactorRequiredError(new DmndApiError('invalid-token', 'unknown')), false);
  assert.equal(isTwoFactorRequiredError(new DmndApiError('two-factor required', 'unauthorized')), false);
  assert.equal(isTwoFactorRequiredError(new DmndApiError('invalid 2fa token', 'unknown')), false); // case differs
  assert.equal(
    isTwoFactorRequiredError(new DmndApiError("This email doesn't have an account", 'unknown')),
    false,
  );
  assert.equal(isTwoFactorRequiredError(new DmndApiError('Cannot reach DMND cloud API', 'network')), false);
  assert.equal(isTwoFactorRequiredError(new Error('Invalid 2FA token')), false); // not a DmndApiError
  assert.equal(isTwoFactorRequiredError(null), false);
});
