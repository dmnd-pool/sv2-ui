import assert from 'node:assert/strict';
import test from 'node:test';

import { type BlockstreamTx, fetchConfirmedTxsSince, startOfUtcDaySec, sumOutputsTo } from '../blockstream';

const USER = 'bc1quser0000000000000000000000000000';

function txOf(txid: string, blockTime: number, vout: Array<[string, number]> = []): BlockstreamTx {
  return {
    txid,
    status: { confirmed: true, block_time: blockTime },
    vout: vout.map(([scriptpubkey_address, value]) => ({ scriptpubkey_address, value })),
  };
}

function fakeFetch(pages: BlockstreamTx[][]) {
  const calls: string[] = [];
  let i = 0;
  const fetchImpl = (async (url: unknown) => {
    calls.push(String(url));
    const body = pages[i++] ?? [];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test('startOfUtcDaySec returns UTC midnight in unix seconds', () => {
  const now = Date.UTC(2026, 6, 1, 15, 30, 0); // 2026-07-01T15:30:00Z
  assert.equal(startOfUtcDaySec(now), Math.floor(Date.UTC(2026, 6, 1, 0, 0, 0) / 1000));
});

test('sumOutputsTo sums only outputs paying an address in the set', () => {
  const txs = [
    txOf('t1', 3000, [[USER, 50000], ['bc1qother', 999]]),
    txOf('t2', 3000, [[USER, 25000]]),
  ];
  assert.equal(sumOutputsTo(txs, new Set([USER])), 75000);
  assert.equal(sumOutputsTo(txs, new Set(['bc1qnope'])), 0);
  assert.equal(sumOutputsTo([], new Set([USER])), 0);
});

test('fetchConfirmedTxsSince pages with last_seen_txid and stops at the first older tx', async () => {
  const since = 2000;
  const page1 = Array.from({ length: 25 }, (_, i) => txOf(`p1_${i}`, 3000)); // all today, full page
  const page2 = [txOf('p2_new', 2500), txOf('p2_old', 1000)]; // one today, then yesterday
  const { fetchImpl, calls } = fakeFetch([page1, page2]);

  const txs = await fetchConfirmedTxsSince('bc1qwallet', since, { fetchImpl });

  assert.equal(calls.length, 2);
  assert.ok(!calls[0].includes('/txs/chain/')); // first page has no last_seen suffix
  assert.ok(calls[1].endsWith('/txs/chain/p1_24')); // second page keyed by page 1's last txid
  assert.equal(txs.length, 26); // 25 + p2_new; p2_old (older) ends the walk
  assert.equal(txs[txs.length - 1].txid, 'p2_new');
});

test('fetchConfirmedTxsSince stops after a short final page (no extra request)', async () => {
  const { fetchImpl, calls } = fakeFetch([[txOf('a', 3000), txOf('b', 3000)]]);
  const txs = await fetchConfirmedTxsSince('bc1qwallet', 2000, { fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(txs.length, 2);
});

test('fetchConfirmedTxsSince throws on a non-OK response so callers can fall back', async () => {
  const fetchImpl = (async () => new Response('', { status: 502 })) as unknown as typeof fetch;
  await assert.rejects(() => fetchConfirmedTxsSince('bc1qwallet', 2000, { fetchImpl }));
});
