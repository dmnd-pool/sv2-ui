import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleAllCheckedSelection, isAllCheckedSelected } from '@/lib/multiSelect';

const ALL = ['Main account', 'A', 'B', 'C'];

test('toggleAllCheckedSelection unchecks one option from the all-checked default', () => {
  // Empty = every option checked; the first toggle seeds the full list minus the click.
  assert.deepEqual(toggleAllCheckedSelection([], 'B', ALL), ['Main account', 'A', 'C']);
  assert.deepEqual(toggleAllCheckedSelection([], 'Main account', ALL), ['A', 'B', 'C']);
});

test('toggleAllCheckedSelection collapses back to empty when every option is re-checked', () => {
  // Re-checking the last missing option means "all included" again -> empty (no filter).
  assert.deepEqual(toggleAllCheckedSelection(['Main account', 'A', 'C'], 'B', ALL), []);
  // Unchecking the final remaining option also collapses (never an empty result).
  assert.deepEqual(toggleAllCheckedSelection(['A'], 'A', ALL), []);
});

test('toggleAllCheckedSelection narrows an existing partial selection', () => {
  assert.deepEqual(toggleAllCheckedSelection(['Main account', 'A', 'C'], 'A', ALL), ['Main account', 'C']);
});

test('isAllCheckedSelected treats an empty selection as everything checked', () => {
  assert.equal(isAllCheckedSelected([], 'A'), true);
  assert.equal(isAllCheckedSelected(['A'], 'A'), true);
  assert.equal(isAllCheckedSelected(['A'], 'B'), false);
});
