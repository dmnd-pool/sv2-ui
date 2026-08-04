import test from 'node:test';
import assert from 'node:assert/strict';
import { workerBarFill, WORKER_BAR_COUNT } from '../workerBars';

test('the strip is always ten bars', () => {
  assert.equal(WORKER_BAR_COUNT, 10);
});

test('workerBarFill scales the filled count to the active proportion', () => {
  // The design annotates the strip as proportional: 10 of 100 online reads as one bar.
  assert.equal(workerBarFill(10, 100), 1);
  assert.equal(workerBarFill(50, 100), 5);
  assert.equal(workerBarFill(100, 100), 10);
  assert.equal(workerBarFill(0, 100), 0);
});

test('workerBarFill never rounds a live worker away to nothing', () => {
  // 1 of 50 is 0.2 bars; showing zero would read as "nothing is mining" while a rig is up.
  assert.equal(workerBarFill(1, 50), 1);
  assert.equal(workerBarFill(2, 100), 1);
});

test('workerBarFill never rounds up to a full strip while a worker is offline', () => {
  // 99 of 100 is 9.9 bars; a full strip would read as "everything is up".
  assert.equal(workerBarFill(99, 100), 9);
  assert.equal(workerBarFill(49, 50), 9);
});

test('workerBarFill handles an empty or nonsensical roster without throwing', () => {
  assert.equal(workerBarFill(0, 0), 0);
  assert.equal(workerBarFill(5, 0), 0);
  // More active than total should never overflow the strip.
  assert.equal(workerBarFill(12, 10), 10);
  assert.equal(workerBarFill(-1, 10), 0);
});
