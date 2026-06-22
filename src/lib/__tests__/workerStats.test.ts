import assert from 'node:assert/strict';
import test from 'node:test';

import type { Worker } from '@/api/types';
import { deriveWorkerStats } from '../workerStats';

function worker(over: Partial<Worker> = {}): Worker {
  return { name: 'w', hashrate: 0, total_shares: 0, rejected_shares: 0, is_connected: true, ...over };
}

test('deriveWorkerStats returns zeros and null rejection for an empty roster', () => {
  assert.deepEqual(deriveWorkerStats([]), {
    activeCount: 0,
    offlineCount: 0,
    totalCount: 0,
    rejectionRate: null,
  });
});

test('deriveWorkerStats counts active vs offline by is_connected', () => {
  const stats = deriveWorkerStats([
    worker({ is_connected: true }),
    worker({ is_connected: false }),
    worker({ is_connected: false }),
  ]);
  assert.equal(stats.activeCount, 1);
  assert.equal(stats.offlineCount, 2);
  assert.equal(stats.totalCount, 3);
});

test('deriveWorkerStats combines pplns and fpps shares for the rejection rate', () => {
  const stats = deriveWorkerStats([
    worker({ total_shares: 90, rejected_shares: 10, fpps_total_shares: 100, fpps_rejected_shares: 0 }),
  ]);
  // 10 rejected of 190 total submitted across both schemes.
  assert.ok(stats.rejectionRate !== null);
  assert.ok(Math.abs((stats.rejectionRate as number) - 10 / 190) < 1e-9);
});

test('deriveWorkerStats reports null rejection when there are no shares yet', () => {
  const stats = deriveWorkerStats([worker({ is_connected: true, total_shares: 0, rejected_shares: 0 })]);
  assert.equal(stats.rejectionRate, null);
});
