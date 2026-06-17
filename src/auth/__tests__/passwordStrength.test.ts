import assert from 'node:assert/strict';
import test from 'node:test';

import { levelFromScore, quickStrength, scoreStrength } from '../passwordStrength';

test('levelFromScore maps zxcvbn scores to the 3-segment levels', () => {
  assert.equal(levelFromScore(0), 'weak');
  assert.equal(levelFromScore(1), 'weak');
  assert.equal(levelFromScore(2), 'medium');
  assert.equal(levelFromScore(3), 'strong');
  assert.equal(levelFromScore(4), 'strong');
});

test('quickStrength prompts for the 9-character minimum when empty', () => {
  const s = quickStrength('');
  assert.equal(s.level, 'empty');
  assert.equal(s.message, 'Password should be a minimum of 9 characters');
});

test('quickStrength reads a short password as weak', () => {
  assert.equal(quickStrength('sato').level, 'weak');
});

test('quickStrength never claims strong (only zxcvbn can), so no false green', () => {
  // 4 character classes and long, yet the instant read caps at medium.
  assert.equal(quickStrength('Sato@123456').level, 'medium');
});

test('scoreStrength: empty and too-short skip zxcvbn', async () => {
  assert.equal((await scoreStrength('')).level, 'empty');
  assert.equal((await scoreStrength('aA1$x')).level, 'weak');
});

test('scoreStrength matches the server boundary (rejects score 2, accepts 3+)', async () => {
  // Verified against the live API: these are rejected as low entropy.
  assert.equal((await scoreStrength('aaaaaaaaa')).level, 'weak');
  assert.equal((await scoreStrength('Sato@123456')).level, 'medium');
  // Verified accepted by the live API.
  const strong = await scoreStrength('correct horse battery staple 9');
  assert.equal(strong.level, 'strong');
  assert.equal(strong.message, 'Password looks good');
});
