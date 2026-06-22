import test from 'node:test';
import assert from 'node:assert/strict';
import type { Worker } from '@/api/types';
import {
  classifyWorker,
  workerMode,
  workerRejection,
  formatLastSeen,
  deriveWorkersPageStats,
  filterByTab,
  searchWorkers,
  sortWorkers,
  paginate,
  workersToCsv,
} from '@/lib/workersTable';

const NOW = Date.parse('2026-06-22T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();
const hrsAgo = (h: number) => new Date(NOW - h * 3600000).toISOString();

function worker(over: Partial<Worker> = {}): Worker {
  return {
    name: 'rig',
    hashrate: 1e12,
    total_shares: 1000,
    rejected_shares: 10,
    is_connected: true,
    is_fpps: false,
    ...over,
  };
}

test('classifyWorker: connected is online regardless of timestamps', () => {
  assert.equal(classifyWorker(worker({ is_connected: true, connected_at: hrsAgo(48) }), NOW), 'online');
});

test('classifyWorker: offline within a day vs over a day', () => {
  assert.equal(classifyWorker(worker({ is_connected: false, connected_at: hrsAgo(2) }), NOW), 'offline');
  assert.equal(classifyWorker(worker({ is_connected: false, connected_at: hrsAgo(25) }), NOW), 'offline_24h');
});

test('classifyWorker: offline with no timestamp cannot be escalated', () => {
  assert.equal(classifyWorker(worker({ is_connected: false, connected_at: null }), NOW), 'offline');
});

test('workerMode reflects the scheme', () => {
  assert.equal(workerMode(worker({ is_fpps: false })), 'PPLNS');
  assert.equal(workerMode(worker({ is_fpps: true })), 'FPPS');
});

test('workerRejection combines schemes and is null with no shares', () => {
  assert.equal(workerRejection(worker({ total_shares: 1000, rejected_shares: 5 })), 0.005);
  assert.equal(
    workerRejection(worker({ total_shares: 100, rejected_shares: 1, fpps_total_shares: 100, fpps_rejected_shares: 3 })),
    0.02,
  );
  assert.equal(workerRejection(worker({ total_shares: 0, rejected_shares: 0, fpps_total_shares: 0 })), null);
});

test('formatLastSeen renders the buckets the column shows', () => {
  assert.equal(formatLastSeen(worker({ is_connected: true }), NOW), 'Just now');
  assert.equal(formatLastSeen(worker({ is_connected: false, connected_at: minsAgo(42) }), NOW), '42 mins ago');
  assert.equal(formatLastSeen(worker({ is_connected: false, connected_at: minsAgo(1) }), NOW), '1 min ago');
  assert.equal(formatLastSeen(worker({ is_connected: false, connected_at: hrsAgo(3) }), NOW), '3 hrs ago');
  assert.equal(formatLastSeen(worker({ is_connected: false, connected_at: hrsAgo(42) }), NOW), '1 day 18 hrs ago');
  assert.equal(formatLastSeen(worker({ is_connected: false, connected_at: hrsAgo(48) }), NOW), '2 days ago');
  assert.equal(formatLastSeen(worker({ is_connected: false, connected_at: null }), NOW), 'Unknown');
});

test('deriveWorkersPageStats counts active, offline, and the >24h subset', () => {
  const roster = [
    worker({ is_connected: true }),
    worker({ is_connected: true }),
    worker({ is_connected: false, connected_at: hrsAgo(2) }),
    worker({ is_connected: false, connected_at: hrsAgo(30) }),
  ];
  const s = deriveWorkersPageStats(roster, NOW);
  assert.equal(s.total, 4);
  assert.equal(s.active, 2);
  assert.equal(s.offline, 2);
  assert.equal(s.offline24h, 1);
});

test('filterByTab splits on connection', () => {
  const roster = [worker({ is_connected: true }), worker({ is_connected: false, connected_at: hrsAgo(30) })];
  assert.equal(filterByTab(roster, 'all').length, 2);
  assert.equal(filterByTab(roster, 'online').length, 1);
  assert.equal(filterByTab(roster, 'offline').length, 1);
  // offline tab includes the >24h bucket
  assert.equal(filterByTab(roster, 'offline')[0]?.connected_at, hrsAgo(30));
});

test('searchWorkers is case-insensitive substring; blank passes all', () => {
  const roster = [worker({ name: 'S19-Pro-01' }), worker({ name: 'Avalon-7' })];
  assert.equal(searchWorkers(roster, 's19').length, 1);
  assert.equal(searchWorkers(roster, 'PRO').length, 1);
  assert.equal(searchWorkers(roster, '   ').length, 2);
  assert.equal(searchWorkers(roster, 'zzz').length, 0);
});

test('sortWorkers orders by key/dir with nulls last on rejection', () => {
  const roster = [
    worker({ name: 'b', hashrate: 2e12 }),
    worker({ name: 'a', hashrate: 1e12 }),
    worker({ name: 'c', hashrate: 3e12, total_shares: 0, rejected_shares: 0, fpps_total_shares: 0 }),
  ];
  assert.deepEqual(
    sortWorkers(roster, 'name', 'asc').map((w) => w.name),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    sortWorkers(roster, 'hashrate', 'desc').map((w) => w.name),
    ['c', 'b', 'a'],
  );
  // 'c' has no shares -> rejection null -> sorts first ascending (treated as -1)
  assert.equal(sortWorkers(roster, 'rejection', 'asc')[0]?.name, 'c');
});

test('paginate clamps the page and slices', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const p1 = paginate(items, 1, 10);
  assert.deepEqual(p1.items, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(p1.totalPages, 3);
  assert.equal(paginate(items, 99, 10).page, 3); // clamp high
  assert.equal(paginate(items, 0, 10).page, 1); // clamp low
  assert.equal(paginate([], 1, 10).totalPages, 1); // never zero pages
});

test('workersToCsv emits the header, formatted cells, and quotes commas', () => {
  const csv = workersToCsv(
    [
      worker({ name: 'S19-Pro-01', hashrate: 8.9e13, total_shares: 1000, rejected_shares: 2, is_connected: true }),
      worker({ name: 'rig, two', hashrate: 0, is_connected: false, connected_at: hrsAgo(2) }),
    ],
    NOW,
  );
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Worker,Hashrate (H/s),Mode,Rejection rate,Status,Last seen');
  assert.ok(lines[1]?.startsWith('S19-Pro-01,89000000000000,PPLNS,0.20%,Online,Just now'));
  assert.ok(lines[2]?.startsWith('"rig, two",')); // comma in name forces quoting
});

test('workersToCsv neutralizes spreadsheet formula injection in names', () => {
  const csv = workersToCsv([worker({ name: '=SUM(A1:A9)', is_connected: true })], NOW);
  const cell = csv.split('\n')[1]?.split(',')[0];
  assert.equal(cell, "'=SUM(A1:A9)"); // leading quote so Excel treats it as text
});
