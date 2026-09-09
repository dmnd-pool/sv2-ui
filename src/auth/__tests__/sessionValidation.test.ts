import assert from 'node:assert/strict';
import test from 'node:test';

import { DmndApiError } from '@/api';
import { actionForRejectedRequest, shouldEndSessionAfterValidation } from '../sessionValidation';

test('startup validation ends a session only for an authentication rejection', () => {
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('expired', 'unauthorized', 401)), true);
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('invalid cookie', 'unauthorized', 400)), true);
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('forbidden', 'unauthorized', 403)), false);
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('temporarily unavailable', 'server')), false);
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('offline', 'network')), false);
  assert.equal(shouldEndSessionAfterValidation(new Error('unexpected response')), false);
});

test('a runtime rejection signs out only the matching master session', () => {
  const master = { accountId: 'master' } as NonNullable<Parameters<typeof actionForRejectedRequest>[0]['session']>;

  assert.equal(actionForRejectedRequest({ session: master, viewingAccountId: null }, 'master'), 'sign-out');
  assert.equal(actionForRejectedRequest({ session: master, viewingAccountId: null }, 'old-account'), 'ignore');
  assert.equal(actionForRejectedRequest({ session: null, viewingAccountId: null }, 'master'), 'ignore');
  assert.equal(actionForRejectedRequest({ session: master, viewingAccountId: null }, null), 'ignore');
});

test('a rejected selected subaccount returns to the master without ending its session', () => {
  const master = { accountId: 'master' } as NonNullable<Parameters<typeof actionForRejectedRequest>[0]['session']>;

  assert.equal(
    actionForRejectedRequest({ session: master, viewingAccountId: 'sub-1' }, 'sub-1'),
    'leave-subaccount',
  );
});
