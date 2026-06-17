import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthStore } from '../authStore';
import { createSession } from '../session';

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

/**
 * An in-process stand-in for BroadcastChannel: every channel built from the
 * same bus delivers postMessage to the others, like tabs of one browser.
 */
function channelBus() {
  const channels: Array<{ onmessage: ((ev: MessageEvent) => void) | null }> = [];
  const make = (): BroadcastChannel => {
    const ch = {
      onmessage: null as ((ev: MessageEvent) => void) | null,
      postMessage(data: unknown) {
        for (const c of channels) {
          if (c !== ch && c.onmessage) c.onmessage({ data } as MessageEvent);
        }
      },
      close() {
        const i = channels.indexOf(ch);
        if (i >= 0) channels.splice(i, 1);
      },
    };
    channels.push(ch);
    return ch as unknown as BroadcastChannel;
  };
  return { make };
}

test('a second tab claiming the same account signs the first tab out', () => {
  const bus = channelBus();
  const session = createSession({ accountId: '1', email: 'm@x.io' });

  const tabA = createAuthStore({ tabId: 'A', storage: memoryStorage(), channelFactory: bus.make });
  tabA.signIn(session);
  assert.equal(tabA.getSnapshot().session?.accountId, '1');

  const tabB = createAuthStore({ tabId: 'B', storage: memoryStorage(), channelFactory: bus.make });
  tabB.signIn(session);

  assert.equal(tabA.getSnapshot().session, null);
  assert.equal(tabA.getSnapshot().signOutReason, 'duplicate_tab');
  assert.equal(tabB.getSnapshot().session?.accountId, '1');
});

test('a tab with a different account is left alone', () => {
  const bus = channelBus();

  const tabA = createAuthStore({ tabId: 'A', storage: memoryStorage(), channelFactory: bus.make });
  tabA.signIn(createSession({ accountId: '1', email: 'a@x.io' }));

  const tabB = createAuthStore({ tabId: 'B', storage: memoryStorage(), channelFactory: bus.make });
  tabB.signIn(createSession({ accountId: '2', email: 'b@x.io' }));

  assert.equal(tabA.getSnapshot().session?.accountId, '1');
});
