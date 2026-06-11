import assert from 'node:assert/strict';
import test from 'node:test';

import { DmndApiError } from '@/dmnd';
import { isTwoFactorRequiredError } from './resetErrors';

test('isTwoFactorRequiredError is true for the known 2FA error shapes', () => {
  assert.equal(isTwoFactorRequiredError(new DmndApiError('Invalid 2FA token', 'unknown')), true);
  assert.equal(isTwoFactorRequiredError(new DmndApiError('invalid-token', 'unknown')), true);
  assert.equal(
    isTwoFactorRequiredError(new DmndApiError('Enter your authenticator code', 'unauthorized')),
    true,
  );
  assert.equal(isTwoFactorRequiredError(new DmndApiError('two-factor required', 'unauthorized')), true);
});

test('isTwoFactorRequiredError is false for non-2FA failures', () => {
  assert.equal(
    isTwoFactorRequiredError(new DmndApiError("This email doesn't have an account", 'unknown')),
    false,
  );
  assert.equal(isTwoFactorRequiredError(new DmndApiError('Add another word or two', 'unknown')), false);
  assert.equal(isTwoFactorRequiredError(new DmndApiError('Cannot reach DMND cloud API', 'network')), false);
  assert.equal(isTwoFactorRequiredError(new Error('plain error')), false);
  assert.equal(isTwoFactorRequiredError(null), false);
});
