import test from 'node:test';
import assert from 'node:assert/strict';
import { AGG_STORAGE_KEY, readAggregated } from '../aggregatedMode';

test('AGG_STORAGE_KEY is the namespaced dashboard key', () => {
  assert.equal(AGG_STORAGE_KEY, 'dmnd.dashboard.aggregated');
});

test('readAggregated is true only for the exact "true" string', () => {
  assert.equal(readAggregated('true'), true);
});

test('readAggregated defaults to false for null, empty, or unknown values', () => {
  assert.equal(readAggregated(null), false);
  assert.equal(readAggregated(''), false);
  assert.equal(readAggregated('false'), false);
  assert.equal(readAggregated('1'), false);
  assert.equal(readAggregated('nonsense'), false);
});
