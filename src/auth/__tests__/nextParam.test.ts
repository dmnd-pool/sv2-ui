import assert from 'node:assert/strict';
import test from 'node:test';

import { readNextParam } from '../nextParam';

test('readNextParam returns a same-origin path unchanged', () => {
  assert.equal(readNextParam('?next=%2Fworkers'), '/workers');
  assert.equal(readNextParam('?next=%2Fworkers%3Ffrom%3D2026'), '/workers?from=2026');
});

test('readNextParam falls back to / when next is absent or empty', () => {
  assert.equal(readNextParam(''), '/');
  assert.equal(readNextParam('?next='), '/');
  assert.equal(readNextParam('?other=1'), '/');
});

test('readNextParam rejects protocol-relative and backslash redirects', () => {
  // // and /\ both resolve cross-origin in browsers
  assert.equal(readNextParam('?next=%2F%2Fevil.com'), '/');
  assert.equal(readNextParam('?next=%2F%5Cevil.com'), '/');
  // double-encoded slash collapses to // after one decode
  assert.equal(readNextParam('?next=%2F%252Fevil.com'), '/');
});

test('readNextParam rejects absolute urls and non-path values', () => {
  assert.equal(readNextParam('?next=https%3A%2F%2Fevil.com'), '/');
  assert.equal(readNextParam('?next=evil.com'), '/');
});

test('readNextParam falls back to / on malformed encoding', () => {
  assert.equal(readNextParam('?next=%2Fworkers%ZZ'), '/');
});
