import test from 'node:test';
import assert from 'node:assert/strict';
import type { Worker } from '@/api/types';
import {
  classifyWorker,
  workerMode,
  workerRejection,
  workerTotalShares,
  workerRejectedShares,
  workerHashrate,
  isHashing,
  deriveWorkersPageStats,
  filterByTab,
  searchWorkers,
  sortWorkers,
  paginate,
  workersToCsv,
  EMPTY_WORKER_FILTER,
  isWorkerFilterActive,
  applyWorkerFilter,
  filterWorkersByMode,
  tagWorkersBySubaccount,
  workerRowId,
} from '@/lib/workersTable';

const NOW = Date.parse('2026-06-22T12:00:00Z'); // ms, passed as the `now` argument
// connected_at is a unix timestamp in SECONDS.
const hrsAgo = (h: number) => Math.floor((NOW - h * 3600000) / 1000);

// A PPLNS worker by default: the pool reports a scheme's figures only in that scheme's
// fields, so `hashrate` set and `fpps_hashrate` absent is what a PPLNS rig looks like.
function worker(over: Partial<Worker> = {}): Worker {
  return {
    name: 'rig',
    hashrate: 1e12,
    total_shares: 1000,
    rejected_shares: 10,
    is_connected: true,
    ...over,
  };
}

/** The FPPS counterpart: the same rig with its figures in the FPPS fields instead. */
function fppsWorker(over: Partial<Worker> = {}): Worker {
  return worker({
    hashrate: null,
    total_shares: null,
    rejected_shares: null,
    fpps_hashrate: 1e12,
    fpps_total_shares: 1000,
    fpps_rejected_shares: 10,
    ...over,
  });
}

test('classifyWorker: connected is online regardless of timestamps', () => {
  assert.equal(classifyWorker(worker({ is_connected: true, connected_at: hrsAgo(48) })), 'online');
});

test('classifyWorker: every worker without recent telemetry is offline', () => {
  assert.equal(classifyWorker(worker({ is_connected: false, connected_at: hrsAgo(2) })), 'offline');
  assert.equal(classifyWorker(worker({ is_connected: false, connected_at: hrsAgo(25) })), 'offline');
});

test('classifyWorker: offline with no timestamp cannot be escalated', () => {
  assert.equal(classifyWorker(worker({ is_connected: false, connected_at: null })), 'offline');
});

test('workerMode reads the scheme off the field carrying the hashrate', () => {
  assert.equal(workerMode(worker()), 'PPLNS');
  assert.equal(workerMode(fppsWorker()), 'FPPS');
  // A quiet worker has no figures in either scheme, and nothing distinguishes the two.
  assert.equal(workerMode(worker({ hashrate: null, is_connected: false })), null);
});

test('workerRejection combines schemes and is null with no shares', () => {
  assert.equal(workerRejection(worker({ total_shares: 1000, rejected_shares: 5 })), 0.005);
  assert.equal(
    workerRejection(worker({ total_shares: 100, rejected_shares: 1, fpps_total_shares: 100, fpps_rejected_shares: 3 })),
    0.02,
  );
  assert.equal(workerRejection(worker({ total_shares: 0, rejected_shares: 0, fpps_total_shares: 0 })), null);
});

test('workerTotalShares / workerRejectedShares sum both schemes, treating nulls as zero', () => {
  assert.equal(workerTotalShares(worker({ total_shares: 1000, fpps_total_shares: 200 })), 1200);
  assert.equal(workerTotalShares(worker({ total_shares: null, fpps_total_shares: null })), 0);
  assert.equal(workerRejectedShares(worker({ rejected_shares: 10, fpps_rejected_shares: 5 })), 15);
  assert.equal(workerRejectedShares(worker({ rejected_shares: null, fpps_rejected_shares: null })), 0);
});

test('workerHashrate takes the scheme\'s own field and keeps "no data" distinct from zero', () => {
  assert.equal(workerHashrate(worker({ hashrate: 2e12 })), 2e12);
  // An FPPS worker reports nothing in `hashrate`; reading that alone shows it idle.
  assert.equal(workerHashrate(fppsWorker({ fpps_hashrate: 4e12 })), 4e12);
  assert.equal(workerHashrate(worker({ hashrate: null })), null);
  assert.equal(workerHashrate(worker({ hashrate: 0 })), 0);
});

test('isHashing separates producing hashes from merely being reachable', () => {
  assert.equal(isHashing(worker({ hashrate: 1e12 })), true);
  assert.equal(isHashing(fppsWorker()), true);
  // Connected but idle: telemetry still arrives, no hashes landed in the pool's window.
  assert.equal(isHashing(worker({ is_connected: true, hashrate: 0 })), false);
  assert.equal(isHashing(fppsWorker({ is_connected: true, fpps_hashrate: 0 })), false);
  assert.equal(isHashing(worker({ is_connected: false, hashrate: null })), false);
});

test('deriveWorkersPageStats counts active and offline workers', () => {
  const roster = [
    worker({ is_connected: true }),
    worker({ is_connected: true }),
    worker({ is_connected: false, connected_at: hrsAgo(2) }),
    worker({ is_connected: false, connected_at: hrsAgo(30) }),
  ];
  const s = deriveWorkersPageStats(roster);
  assert.equal(s.total, 4);
  assert.equal(s.active, 2);
  assert.equal(s.offline, 2);
});

test('filterByTab splits on connection', () => {
  const roster = [worker({ is_connected: true }), worker({ is_connected: false, connected_at: hrsAgo(30) })];
  assert.equal(filterByTab(roster, 'all').length, 2);
  assert.equal(filterByTab(roster, 'online').length, 1);
  assert.equal(filterByTab(roster, 'offline').length, 1);
  assert.equal(filterByTab(roster, 'offline')[0]?.connected_at, hrsAgo(30));
});

test('searchWorkers is case-insensitive substring; blank passes all', () => {
  const roster = [worker({ name: 'S19-Pro-01' }), worker({ name: 'Avalon-7' })];
  assert.equal(searchWorkers(roster, 's19').length, 1);
  assert.equal(searchWorkers(roster, 'PRO').length, 1);
  assert.equal(searchWorkers(roster, '   ').length, 2);
  assert.equal(searchWorkers(roster, 'zzz').length, 0);
});

test('searchWorkers matches ANY comma-separated term (OR), trimming and ignoring empties', () => {
  const roster = [worker({ name: 'S19-Pro-01' }), worker({ name: 'Avalon-7' }), worker({ name: 'Whatsminer-3' })];
  assert.equal(searchWorkers(roster, 's19, avalon').length, 2); // OR across terms
  assert.equal(searchWorkers(roster, '  s19 ,  AVALON  ').length, 2); // trims + case-insensitive
  assert.equal(searchWorkers(roster, 'avalon,').length, 1); // trailing comma -> empty term dropped
  assert.equal(searchWorkers(roster, ' , , ').length, 3); // only commas/space -> passes all
  assert.equal(searchWorkers(roster, 'zzz, qqq').length, 0); // no term matches
});

test('searchWorkers covers all columns, not just the name (mode + status)', () => {
  const roster = [
    worker({ name: 'S19-Pro-01', is_connected: true }),
    fppsWorker({ name: 'Avalon-7', is_connected: false, connected_at: hrsAgo(2) }),
  ];
  assert.equal(searchWorkers(roster, 'fpps').length, 1); // mode column
  assert.equal(searchWorkers(roster, 'online').length, 1); // status column ("offline" doesn't contain "online")
  assert.equal(searchWorkers(roster, 'offline').length, 1); // status column
  assert.equal(searchWorkers(roster, 's19').length, 1); // name still matches
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
  // Unknown rejection is kept last in either direction.
  assert.equal(sortWorkers(roster, 'rejection', 'asc').at(-1)?.name, 'c');
  assert.equal(sortWorkers(roster, 'rejection', 'desc').at(-1)?.name, 'c');
});

test('sortWorkers breaks ties on name, ascending in either direction', () => {
  const roster = [worker({ name: 'c', hashrate: 0 }), worker({ name: 'a', hashrate: 0 }), worker({ name: 'b', hashrate: 0 })];
  assert.deepEqual(
    sortWorkers(roster, 'hashrate', 'desc').map((w) => w.name),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    sortWorkers(roster, 'hashrate', 'asc').map((w) => w.name),
    ['a', 'b', 'c'],
  );
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
  assert.deepEqual(applyWorkerFilter(roster, EMPTY_WORKER_FILTER).map((w) => w.name), ['on', 'off', 'off24']);
  assert.deepEqual(
    applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, status: ['online'] }).map((w) => w.name),
    ['on'],
  );
  // OR across the two statuses returns the complete roster.
  assert.deepEqual(
    applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, status: ['online', 'offline'] }).map((w) => w.name),
    ['on', 'off', 'off24'],
  );
});

test('applyWorkerFilter: mode multi-select', () => {
  const roster = [worker({ name: 'p' }), fppsWorker({ name: 'f' })];
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, mode: ['PPLNS'] }).map((w) => w.name), ['p']);
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, mode: ['PPLNS', 'FPPS'] }).map((w) => w.name), ['p', 'f']);
});

test('applyWorkerFilter: rejection buckets, and no-shares never matches', () => {
  const roster = [
    worker({ name: 'lt1', total_shares: 1000, rejected_shares: 5, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // 0.5%
    worker({ name: 'mid', total_shares: 1000, rejected_shares: 20, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // 2%
    worker({ name: 'gt3', total_shares: 1000, rejected_shares: 50, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // 5%
    worker({ name: 'none', total_shares: 0, rejected_shares: 0, fpps_total_shares: 0, fpps_rejected_shares: 0 }), // no rate
  ];
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, rejection: 'lt1' }).map((w) => w.name), ['lt1']);
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, rejection: '1to3' }).map((w) => w.name), ['mid']);
  assert.deepEqual(applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, rejection: 'gt3' }).map((w) => w.name), ['gt3']);
});

test('applyWorkerFilter: boundaries 1% -> 1to3, 3% -> 1to3', () => {
  const at1 = worker({ name: 'one', total_shares: 100, rejected_shares: 1, fpps_total_shares: 0, fpps_rejected_shares: 0 }); // exactly 1%
  const at3 = worker({ name: 'three', total_shares: 100, rejected_shares: 3, fpps_total_shares: 0, fpps_rejected_shares: 0 }); // exactly 3%
  assert.deepEqual(applyWorkerFilter([at1], { ...EMPTY_WORKER_FILTER, rejection: 'lt1' }).map((w) => w.name), []);
  assert.deepEqual(applyWorkerFilter([at1], { ...EMPTY_WORKER_FILTER, rejection: '1to3' }).map((w) => w.name), ['one']);
  assert.deepEqual(applyWorkerFilter([at3], { ...EMPTY_WORKER_FILTER, rejection: '1to3' }).map((w) => w.name), ['three']);
  assert.deepEqual(applyWorkerFilter([at3], { ...EMPTY_WORKER_FILTER, rejection: 'gt3' }).map((w) => w.name), []);
});

test('applyWorkerFilter: facets combine with AND', () => {
  const roster = [
    worker({ name: 'onp', is_connected: true }),
    fppsWorker({ name: 'onf', is_connected: true }),
    worker({ name: 'offp', is_connected: false, connected_at: hrsAgo(2) }),
  ];
  assert.deepEqual(
    applyWorkerFilter(roster, { ...EMPTY_WORKER_FILTER, status: ['online'], mode: ['PPLNS'] }).map((w) => w.name),
    ['onp'],
  );
});

test('filterWorkersByMode splits the export by payout scheme, dropping unknown-scheme rows', () => {
  const roster = [
    worker({ name: 'p', hashrate: 100 }),
    worker({ name: 'f', hashrate: null, fpps_hashrate: 200 }),
    worker({ name: 'quiet', hashrate: null }), // reports neither scheme -> kind unknown
  ];
  assert.deepEqual(filterWorkersByMode(roster, 'all').map((w) => w.name), ['p', 'f', 'quiet']);
  assert.deepEqual(filterWorkersByMode(roster, 'pplns').map((w) => w.name), ['p']);
  assert.deepEqual(filterWorkersByMode(roster, 'fpps').map((w) => w.name), ['f']);
});

test('workersToCsv emits the production raw-schema header even when empty', () => {
  assert.equal(workersToCsv([]), 'name,kind,hashrate,total_shares,rejected_shares,is_connected');
});

test('workersToCsv writes raw fields: lowercase kind, true/false, raw numbers, empty for nulls', () => {
  const csv = workersToCsv([
    worker({ name: 'S19-Pro-01', hashrate: 8.9e13, total_shares: 1000, rejected_shares: 2, is_connected: true, connected_at: 1751000000 }),
    fppsWorker({ name: 'Avalon', fpps_hashrate: 4.2e13, fpps_total_shares: 500, fpps_rejected_shares: 1, is_connected: true, connected_at: 1751000000 }),
    worker({ name: 'Quiet', hashrate: null, total_shares: null, rejected_shares: null, is_connected: false, connected_at: null }),
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[1], 'S19-Pro-01,pplns,89.00 TH/s,1000,2,true');
  // An FPPS row carries its own scheme's figures rather than blank PPLNS ones.
  assert.equal(lines[2], 'Avalon,fpps,42.00 TH/s,500,1,true');
  // Nothing reported in either scheme: empty cells, and no kind to claim.
  assert.equal(lines[3], 'Quiet,,,,,false');
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

test('tagWorkersBySubaccount flattens groups in order, tagging each worker with its sub', () => {
  const tagged = tagWorkersBySubaccount([
    { sub: 'alpha', subaccountId: 'id-alpha', workers: [worker({ name: 'a1' }), worker({ name: 'a2' })] },
    { sub: 'bravo', subaccountId: 'id-bravo', workers: [worker({ name: 'b1' })] },
  ]);
  assert.equal(tagged.length, 3);
  assert.deepEqual(tagged.map((w) => w.name), ['a1', 'a2', 'b1']); // group order, then worker order within a group
  assert.deepEqual(tagged.map((w) => w.subaccount), ['alpha', 'alpha', 'bravo']);
});

test('tagWorkersBySubaccount: an empty group contributes no rows', () => {
  const tagged = tagWorkersBySubaccount([
    { sub: 'alpha', subaccountId: 'id-alpha', workers: [worker({ name: 'a1' })] },
    { sub: 'empty', subaccountId: 'id-empty', workers: [] },
    { sub: 'bravo', subaccountId: 'id-bravo', workers: [worker({ name: 'b1' })] },
  ]);
  assert.equal(tagged.length, 2);
  assert.deepEqual(tagged.map((w) => w.subaccount), ['alpha', 'bravo']);
});

test('tagWorkersBySubaccount keeps same-named workers from different subs, tagged separately', () => {
  const tagged = tagWorkersBySubaccount([
    { sub: 'alpha', subaccountId: 'id-alpha', workers: [worker({ name: 'dup' })] },
    { sub: 'bravo', subaccountId: 'id-bravo', workers: [worker({ name: 'dup' })] },
  ]);
  assert.equal(tagged.length, 2); // not deduped
  assert.deepEqual(tagged.map((w) => w.name), ['dup', 'dup']);
  assert.deepEqual(tagged.map((w) => w.subaccount), ['alpha', 'bravo']);
});

test('workerRowId qualifies the name with its subaccount so namesakes stay distinct', () => {
  const plain = { name: 'rig-1', hashrate: null, total_shares: null, rejected_shares: null, is_connected: true };
  assert.equal(workerRowId(plain), 'rig-1');

  const tagged = tagWorkersBySubaccount([
    { sub: 'Main Farm', subaccountId: 'sub-1', workers: [plain] },
    { sub: 'Client Alpha', subaccountId: 'sub-2', workers: [plain] },
  ]);
  const ids = tagged.map(workerRowId);
  assert.deepEqual(ids, ['sub-1/rig-1', 'sub-2/rig-1']);
  assert.equal(new Set(ids).size, 2);
});

test('workerRowId disambiguates by subaccount id, not by name, so two identically-named subaccounts stay distinct', () => {
  const plain = { name: 'rig-1', hashrate: null, total_shares: null, rejected_shares: null, is_connected: true };
  const tagged = tagWorkersBySubaccount([
    { sub: 'Test Farm A', subaccountId: 'sub-1', workers: [plain] },
    { sub: 'Test Farm A', subaccountId: 'sub-2', workers: [plain] },
  ]);
  const ids = tagged.map(workerRowId);
  assert.equal(new Set(ids).size, 2);
});

test('applyWorkerFilter narrows by account, and an empty accounts list means all accounts', () => {
  const rows = tagWorkersBySubaccount([
    { sub: 'Main Farm', subaccountId: 'id-main-farm', workers: [{ name: 'a', hashrate: null, total_shares: null, rejected_shares: null, is_connected: true }] },
    { sub: 'Client Alpha', subaccountId: 'id-client-alpha', workers: [{ name: 'b', hashrate: null, total_shares: null, rejected_shares: null, is_connected: true }] },
    { sub: 'Warehouse 01', subaccountId: 'id-warehouse-01', workers: [{ name: 'c', hashrate: null, total_shares: null, rejected_shares: null, is_connected: true }] },
  ]);

  // No accounts selected = no narrowing, consistent with the other multi-select facets.
  assert.equal(applyWorkerFilter(rows, EMPTY_WORKER_FILTER).length, 3);

  const onlyAlpha = applyWorkerFilter(rows, { ...EMPTY_WORKER_FILTER, accounts: ['Client Alpha'] });
  assert.deepEqual(onlyAlpha.map((w) => w.name), ['b']);

  const two = applyWorkerFilter(rows, { ...EMPTY_WORKER_FILTER, accounts: ['Main Farm', 'Warehouse 01'] });
  assert.deepEqual(two.map((w) => w.name), ['a', 'c']);
});

test('isWorkerFilterActive counts a chosen account as an active facet', () => {
  assert.equal(isWorkerFilterActive(EMPTY_WORKER_FILTER), false);
  assert.equal(isWorkerFilterActive({ ...EMPTY_WORKER_FILTER, accounts: ['Main Farm'] }), true);
});

test('a worker with both payment modes keeps both rates and matches either filter', () => {
  const mixed = worker({ hashrate: 2e12, fpps_hashrate: 3e12, total_shares: 10, fpps_total_shares: 20, rejected_shares: 1, fpps_rejected_shares: 2 });
  assert.equal(workerHashrate(mixed), 5e12);
  assert.equal(workerMode(mixed), 'PPLNS + FPPS');
  assert.deepEqual(filterWorkersByMode([mixed], 'pplns'), [mixed]);
  assert.deepEqual(filterWorkersByMode([mixed], 'fpps'), [mixed]);
  assert.deepEqual(applyWorkerFilter([mixed], { ...EMPTY_WORKER_FILTER, mode: ['PPLNS'] }), [mixed]);
  assert.deepEqual(applyWorkerFilter([mixed], { ...EMPTY_WORKER_FILTER, mode: ['FPPS'] }), [mixed]);
  assert.match(workersToCsv([mixed]), /both,5.00 TH\/s,30,3,true/);
});
