import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePplnsProjection, pplnsProjectionMatchesAccount } from '../pplnsProjection';
import { pplnsProjectionFixture } from './pplnsProjectionFixture';

test('models 3 and 4 remain readable during a rolling deployment', () => {
  assert.equal(decodePplnsProjection(pplnsProjectionFixture(3)).model_version, 3);
  assert.equal(decodePplnsProjection(pplnsProjectionFixture(4)).model_version, 4);
});

test('older and unknown future models fail closed', () => {
  for (const model_version of [2, 5]) {
    assert.throws(() => decodePplnsProjection({ ...pplnsProjectionFixture(), model_version }));
  }
});

test('the complete response, including optional diagnostics, is retained', () => {
  assert.deepEqual(decodePplnsProjection(pplnsProjectionFixture()), pplnsProjectionFixture());
});

test('missing or malformed daily work is rejected instead of becoming an empty result', () => {
  const { daily_work: _dailyWork, ...withoutDailyWork } = pplnsProjectionFixture();
  assert.throws(() => decodePplnsProjection(withoutDailyWork));
  assert.throws(() => decodePplnsProjection({ ...pplnsProjectionFixture(), daily_work: 'invalid' }));
  assert.throws(() =>
    decodePplnsProjection({
      ...pplnsProjectionFixture(),
      daily_work: [{ ...pplnsProjectionFixture().daily_work[0], total_net_sats: 'invalid' }],
    }),
  );
});

test('horizons must be exactly 0 through 8 in order', () => {
  assert.throws(() => decodePplnsProjection({ ...pplnsProjectionFixture(), horizons: [] }));
  assert.throws(() =>
    decodePplnsProjection({
      ...pplnsProjectionFixture(),
      horizons: [...pplnsProjectionFixture().horizons].reverse(),
    }),
  );
});

test('response account matching canonicalizes decimal signs and leading zeroes', () => {
  const projection = pplnsProjectionFixture();
  assert.equal(pplnsProjectionMatchesAccount(projection, '+00123'), true);
  assert.equal(pplnsProjectionMatchesAccount({ ...projection, subaccount_id: '-0' }, '0'), true);
  assert.equal(pplnsProjectionMatchesAccount({ ...projection, subaccount_id: '' }, '0'), false);
  assert.equal(pplnsProjectionMatchesAccount(projection, 'account-123'), false);
});
