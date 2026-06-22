import assert from 'node:assert/strict';
import test from 'node:test';

import { accountInitials } from '../accountInitials';

test('accountInitials joins the first letters of two name parts', () => {
  assert.equal(accountInitials('ada.lovelace@x.io'), 'AL');
  assert.equal(accountInitials('grace_hopper@navy.mil'), 'GH');
  assert.equal(accountInitials('john-von-neumann@x.io'), 'JV');
});

test('accountInitials uses the first two letters of a single-part local', () => {
  assert.equal(accountInitials('satoshi@dmnd.work'), 'SA');
  assert.equal(accountInitials('a@x.io'), 'A');
});

test('accountInitials falls back to ? when there is nothing to use', () => {
  assert.equal(accountInitials(undefined), '?');
  assert.equal(accountInitials(''), '?');
});
