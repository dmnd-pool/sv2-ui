import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchBrokerMiners,
  sumBrokerHashrate,
  averageBrokerFee,
  formatBrokerFee,
  brokerMinerRowId,
  splitValueUnit,
  type BrokerMiner,
} from '../brokerTable';

const miner = (over: Partial<BrokerMiner> = {}): BrokerMiner => ({
  id: '1',
  name: 'Alpha Mining',
  hashrate: 650e12,
  total_work: 0,
  broker_fee: 2,
  ...over,
});

test('searchBrokerMiners matches the miner name case-insensitively', () => {
  const rows = [miner(), miner({ id: '2', name: 'BTC Farm 01' })];
  assert.equal(searchBrokerMiners(rows, 'btc farm').length, 1);
  assert.equal(searchBrokerMiners(rows, 'ALPHA')[0].name, 'Alpha Mining');
});

test('searchBrokerMiners returns every row for a blank query', () => {
  const rows = [miner(), miner({ id: '2', name: 'BTC Farm 01' })];
  assert.equal(searchBrokerMiners(rows, '   ').length, 2);
});

test('sumBrokerHashrate totals the portfolio', () => {
  assert.equal(sumBrokerHashrate([miner({ hashrate: 1 }), miner({ id: '2', hashrate: 2 })]), 3);
});

test('sumBrokerHashrate skips non-finite hashrates rather than yielding NaN', () => {
  assert.equal(sumBrokerHashrate([miner({ hashrate: Number.NaN }), miner({ id: '2', hashrate: 5 })]), 5);
});

test('sumBrokerHashrate of an empty portfolio is 0', () => {
  assert.equal(sumBrokerHashrate([]), 0);
});

test('averageBrokerFee averages the per-miner fees', () => {
  assert.equal(averageBrokerFee([miner({ broker_fee: 2 }), miner({ id: '2', broker_fee: 3 })]), 2.5);
});

test('averageBrokerFee returns null with no miners, so the card can show a dash', () => {
  assert.equal(averageBrokerFee([]), null);
});

test('averageBrokerFee ignores non-finite fees', () => {
  assert.equal(averageBrokerFee([miner({ broker_fee: Number.NaN }), miner({ id: '2', broker_fee: 4 })]), 4);
});

test('formatBrokerFee drops the trailing zeros the design does not draw', () => {
  // The frames show `2%` and `1.5%`, never `2.0%`.
  assert.equal(formatBrokerFee(2), '2%');
  assert.equal(formatBrokerFee(1.5), '1.5%');
  assert.equal(formatBrokerFee(2.5), '2.5%');
});

test('formatBrokerFee renders a dash when the fee is missing', () => {
  assert.equal(formatBrokerFee(null), '--');
  assert.equal(formatBrokerFee(Number.NaN), '--');
});

test('brokerMinerRowId prefers the id and stays stable', () => {
  assert.equal(brokerMinerRowId(miner({ id: '7' })), '7');
});

test('brokerMinerRowId falls back to the name when the id is absent', () => {
  // The spec table omits `id`; only the live decoder carries it, so it may be missing.
  assert.equal(brokerMinerRowId(miner({ id: undefined, name: 'Warehouse 02' })), 'Warehouse 02');
});

test('splitValueUnit separates the numeral from its unit so they can be sized apart', () => {
  assert.deepEqual(splitValueUnit('2.84 TH/s'), { value: '2.84', unit: 'TH/s' });
  assert.deepEqual(splitValueUnit('0 H/s'), { value: '0', unit: 'H/s' });
});

test('splitValueUnit leaves a unitless reading alone', () => {
  assert.deepEqual(splitValueUnit('5'), { value: '5', unit: undefined });
  assert.deepEqual(splitValueUnit('--'), { value: '--', unit: undefined });
});
