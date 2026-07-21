import test from 'node:test';
import assert from 'node:assert/strict';
import type { Worker } from '@/api/types';
import {
  classifyWorker,
  workerMode,
  workerRejection,
  workerTotalShares,
  workerRejectedShares,
  formatLastSeen,
  formatConnectedSince,
  formatOfflineDuration,
  deriveWorkersPageStats,
  filterByTab,
  searchWorkers,
  sortWorkers,
  paginate,
  workersToCsv,
  EMPTY_WORKER_FILTER,
  isWorkerFilterActive,
  applyWorkerFilter,
  filterWorkersByRange,
} from '@/lib/workersTable';

const NOW = Date.parse('2026-06-22T12:00:00Z'); // ms, passed as the `now` argument
// connected_at is a unix timestamp in SECONDS.
const minsAgo = (m: number) => Math.floor((NOW - m * 60000) / 1000);
const hrsAgo = (h: number) => Math.floor((NOW - h * 3600000) / 1000);

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

test('workerTotalShares / workerRejectedShares sum both schemes, treating nulls as zero', () => {
  assert.equal(workerTotalShares(worker({ total_shares: 1000, fpps_total_shares: 200 })), 1200);
  assert.equal(workerTotalShares(worker({ total_shares: null, fpps_total_shares: null })), 0);
  assert.equal(workerRejectedShares(worker({ rejected_shares: 10, fpps_rejected_shares: 5 })), 15);
  assert.equal(workerRejectedShares(worker({ rejected_shares: null, fpps_rejected_shares: null })), 0);
});

test('formatConnectedSince renders the panel date "18 Jun 2026, 08:24 UTC"', () => {
  const sec = Math.floor(Date.parse('2026-06-18T08:24:00Z') / 1000);
  assert.equal(formatConnectedSince(worker({ connected_at: sec })), '18 Jun 2026, 08:24 UTC');
  // a millisecond value (>= 1e12) is handled the same
  assert.equal(formatConnectedSince(worker({ connected_at: sec * 1000 })), '18 Jun 2026, 08:24 UTC');
  // pads single-digit hour/minute
  const early = Math.floor(Date.parse('2026-01-05T03:07:00Z') / 1000);
  assert.equal(formatConnectedSince(worker({ connected_at: early })), '5 Jan 2026, 03:07 UTC');
  assert.equal(formatConnectedSince(worker({ connected_at: null })), 'Unknown');
  assert.equal(formatConnectedSince(worker({ connected_at: undefined })), 'Unknown');
});

test('formatOfflineDuration spells out the offline span for the banner (no "ago")', () => {
  assert.equal(formatOfflineDuration(worker({ is_connected: true }), NOW), null); // online -> no banner
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: null }), NOW), null); // unknown
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: minsAgo(0) }), NOW), 'less than a minute');
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: minsAgo(1) }), NOW), '1 minute');
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: minsAgo(42) }), NOW), '42 minutes');
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: hrsAgo(3) }), NOW), '3 hours');
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: hrsAgo(42) }), NOW), '1 day 18 hours');
  assert.equal(formatOfflineDuration(worker({ is_connected: false, connected_at: hrsAgo(48) }), NOW), '2 days');
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
  assert.equal(searchWorkers(roster, 's19', NOW).length, 1);
  assert.equal(searchWorkers(roster, 'PRO', NOW).length, 1);
  assert.equal(searchWorkers(roster, '   ', NOW).length, 2);
  assert.equal(searchWorkers(roster, 'zzz', NOW).length, 0);
});

test('searchWorkers matches ANY comma-separated term (OR), trimming and ignoring empties', () => {
  const roster = [worker({ name: 'S19-Pro-01' }), worker({ name: 'Avalon-7' }), worker({ name: 'Whatsminer-3' })];
  assert.equal(searchWorkers(roster, 's19, avalon', NOW).length, 2); // OR across terms
  assert.equal(searchWorkers(roster, '  s19 ,  AVALON  ', NOW).length, 2); // trims + case-insensitive
  assert.equal(searchWorkers(roster, 'avalon,', NOW).length, 1); // trailing comma -> empty term dropped
  assert.equal(searchWorkers(roster, ' , , ', NOW).length, 3); // only commas/space -> passes all
  assert.equal(searchWorkers(roster, 'zzz, qqq', NOW).length, 0); // no term matches
});

test('searchWorkers covers all columns, not just the name (mode + status)', () => {
  const roster = [
    worker({ name: 'S19-Pro-01', is_fpps: false, is_connected: true }),
    worker({ name: 'Avalon-7', is_fpps: true, is_connected: false, connected_at: hrsAgo(2) }),
  ];
  assert.equal(searchWorkers(roster, 'fpps', NOW).length, 1); // mode column
  assert.equal(searchWorkers(roster, 'online', NOW).length, 1); // status column ("offline" doesn't contain "online")
  assert.equal(searchWorkers(roster, 'offline', NOW).length, 1); // status column
  assert.equal(searchWorkers(roster, 's19', NOW).length, 1); // name still matches
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

test('isWorkerFilterActive is true only when a facet is set', () => {
  assert.equal(isWorkerFilterActive(EMPTY_WORKER_FILTER), false);
  assert.equal(isWorkerFilterActive({ ...EMPTY_WORKER_FILTER, status: ['online'] }), true);
  assert.equal(isWorkerFilterActive({ ...EMPTY_WORKER_FILTER, mode: ['FPPS'] }), true);
  assert.equal(isWorkerFilterActive({ ...EMPTY_WORKER_FILTER, rejection: 'lt1' }), true);
});

test('applyWorkerFilter: status multi-select is OR, no facet passes all', () => {
  const roster = [
    worker({ name: 'on', is_connected: true }),
    worker({ name: 'off', is_connected: false, connected_at: hrsAgo(2) }),
    worker({ name: 'off24', is_connected: false, connected_at: hrsAgo(30) }),
  ];
  assert.deepEqual(applyWorkerFilter(roster, EMPTY_WORKER_FILTER, NOW).map((w) => w.name), ['on', 'off', 'off24']);
  assert.deepEqual(
    applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, status: ['online'] }, NOW).map((w) => w.name),
    ['on'],
  );
  // OR across two chosen status buckets
  assert.deepEqual(
    applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, status: ['online', 'offline_24h'] }, NOW).map((w) => w.name),
    ['on', 'off24'],
  );
});

test('applyWorkerFilter: mode multi-select', () => {
  const roster = [worker({ name: 'p', is_fpps: false }), worker({ name: 'f', is_fpps: true })];
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, mode: ['PPLNS'] }, NOW).map((w) => w.name), ['p']);
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, mode: ['PPLNS', 'FPPS'] }, NOW).map((w) => w.name), ['p', 'f']);
});

test('applyWorkerFilter: rejection buckets, and no-shares never matches', () => {
  const roster = [
    worker({ name: 'lt1', total_shares: 1000, rejected_shares: 5, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // 0.5%
    worker({ name: 'mid', total_shares: 1000, rejected_shares: 20, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // 2%
    worker({ name: 'gt3', total_shares: 1000, rejected_shares: 50, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // 5%
    worker({ name: 'none', total_shares: 0, rejected_shares: 0, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // no rate
  ];
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, rejection: 'lt1' }, NOW).map((w) => w.name), ['lt1']);
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, rejection: '1to3' }, NOW).map((w) => w.name), ['mid']);
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, rejection: 'gt3' }, NOW).map((w) => w.name), ['gt3']);
});

test('applyWorkerFilter: boundaries 1% -> 1to3, 3% -> 1to3', () => {
  const at1 = worker({ name: 'one', total_shares: 100, rejected_shares: 1, fpps_total_shares: 0, fpps_rejected_shares: 0 }); // exactly 1%
  const at3 = worker({ name: 'three', total_shares: 100, rejected_shares: 3, fpps_total_shares: 0, fpps_rejected_shares: 0 }); // exactly 3%
  assert.deepEqual(applyWorkerFilter([at1], { ...EMPTY_WORKER_FILTER, rejection: 'lt1' }, NOW).map((w) => w.name), []);
  assert.deepEqual(applyWorkerFilter([at1], { ...EMPTY_WORKER_FILTER, rejection: '1to3' }, NOW).map((w) => w.name), ['one']);
  assert.deepEqual(applyWorkerFilter([at3], { ...EMPTY_WORKER_FILTER, rejection: '1to3' }, NOW).map((w) => w.name), ['three']);
  assert.deepEqual(applyWorkerFilter([at3], { ...EMPTY_WORKER_FILTER, rejection: 'gt3' }, NOW).map((w) => w.name), []);
});

test('applyWorkerFilter: facets combine with AND', () => {
  const roster = [
    worker({ name: 'onp', is_connected: true, is_fpps: false }),
    worker({ name: 'onf', is_connected: true, is_fpps: true }),
    worker({ name: 'offp', is_connected: false, connected_at: hrsAgo(2), is_fpps: false }),
  ];
  assert.deepEqual(
    applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, status: ['online'], mode: ['PPLNS'] }, NOW).map((w) => w.name),
    ['onp'],
  );
});

test('filterWorkersByRange keeps workers last connected inside the window', () => {
  const startSec = Math.floor((NOW - 7 * 24 * 3600 * 1000) / 1000); // 7 days ago
  const endSec = Math.floor(NOW / 1000);
  const roster = [
    worker({ name: 'online', is_connected: true }), // last seen = now -> inside
    worker({ name: 'recent', is_connected: false, connected_at: hrsAgo(2) }),
    worker({ name: 'old', is_connected: false, connected_at: hrsAgo(24 * 30) }), // 30 days -> outside
    worker({ name: 'unknown', is_connected: false, connected_at: null }), // no timestamp -> excluded
  ];
  assert.deepEqual(
    filterWorkersByRange(roster, startSec, endSec, NOW).map((w) => w.name),
    ['online', 'recent'],
  );
});

test('filterWorkersByRange bounds are inclusive on both ends', () => {
  const at = hrsAgo(48); // a worker last seen exactly 48h ago (unix seconds)
  const w = worker({ name: 'edge', is_connected: false, connected_at: at });
  assert.equal(filterWorkersByRange([w], at, at, NOW).length, 1); // start == end == its time
  assert.equal(filterWorkersByRange([w], at + 1, at + 100, NOW).length, 0); // just after
  assert.equal(filterWorkersByRange([w], at - 100, at - 1, NOW).length, 0); // just before
});

test('workersToCsv emits the production raw-schema header even when empty', () => {
  assert.equal(workersToCsv([]), 'name,kind,hashrate,total_shares,rejected_shares,is_connected,connected_at');
});

test('workersToCsv writes raw fields: lowercase kind, true/false, raw numbers, empty for nulls', () => {
  const csv = workersToCsv([
    worker({ name: 'S19-Pro-01', is_fpps: false, hashrate: 8.9e13, total_shares: 1000, rejected_shares: 2, is_connected: true, connected_at: 1751000000 }),
    worker({ name: 'Avalon', is_fpps: true, hashrate: null, total_shares: null, rejected_shares: null, is_connected: false, connected_at: null }),
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[1], 'S19-Pro-01,pplns,89000000000000,1000,2,true,1751000000');
  assert.equal(lines[2], 'Avalon,fpps,,,,false,'); // nulls -> empty cells, fpps kind, false
});

test('workersToCsv quotes a comma in the name and neutralizes formula injection', () => {
  const csv = workersToCsv([
    worker({ name: 'rig, two', is_connected: true, connected_at: null }),
    worker({ name: '=SUM(A1:A9)', is_connected: true, connected_at: null }),
  ]);
  const lines = csv.split('\n');
  assert.ok(lines[1]?.startsWith('"rig, two",')); // comma in name forces quoting
  assert.equal(lines[2]?.split(',')[0], "'=SUM(A1:A9)"); // leading quote so Excel treats it as text
});
