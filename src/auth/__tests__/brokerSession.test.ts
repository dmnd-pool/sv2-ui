import assert from 'node:assert/strict';
import test from 'node:test';

import { FIXED_TTL_MS, IDLE_TTL_MS } from '../session';
import {
  BROKER_STORAGE_KEY,
  createBrokerSession,
  isBrokerSessionExpired,
  readBrokerSession,
  writeBrokerSession,
  clearBrokerSession,
} from '../brokerSession';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

test('createBrokerSession sets the fixed and idle deadlines from now', () => {
  const s = createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1', now: 1_000 });
  assert.equal(s.expiresAt, 1_000 + FIXED_TTL_MS);
  assert.equal(s.idleExpiresAt, 1_000 + IDLE_TTL_MS);
});

test('isBrokerSessionExpired trips on either deadline', () => {
  const s = createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1', now: 0 });
  assert.equal(isBrokerSessionExpired(s, IDLE_TTL_MS - 1), false);
  assert.equal(isBrokerSessionExpired(s, IDLE_TTL_MS), true);
});

test('readBrokerSession round-trips a written session', () => {
  const storage = memoryStorage();
  const s = createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1' });
  writeBrokerSession(s, storage);
  assert.deepEqual(readBrokerSession(storage), s);
});

test('readBrokerSession returns null for missing, malformed, or wrong-shaped data', () => {
  const storage = memoryStorage();
  assert.equal(readBrokerSession(storage), null);

  storage.setItem(BROKER_STORAGE_KEY, 'not json');
  assert.equal(readBrokerSession(storage), null);

  // no referenceCode
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify({ brokerId: '7', email: 'b@x.io', expiresAt: 1, idleExpiresAt: 1 }));
  assert.equal(readBrokerSession(storage), null);

  // no brokerId
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify({ email: 'b@x.io', referenceCode: 'RC', expiresAt: 1, idleExpiresAt: 1 }));
  assert.equal(readBrokerSession(storage), null);
});

test('readBrokerSession discards and clears an expired session', () => {
  const storage = memoryStorage();
  const expired = { brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1', expiresAt: 1, idleExpiresAt: 1 };
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify(expired));
  assert.equal(readBrokerSession(storage), null);
  assert.equal(storage.getItem(BROKER_STORAGE_KEY), null);
});

test('clearBrokerSession removes the stored session', () => {
  const storage = memoryStorage();
  writeBrokerSession(createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1' }), storage);
  clearBrokerSession(storage);
  assert.equal(storage.getItem(BROKER_STORAGE_KEY), null);
});
