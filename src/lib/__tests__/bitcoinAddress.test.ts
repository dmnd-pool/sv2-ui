import assert from 'node:assert/strict';
import test from 'node:test';

import * as bitcoin from 'bitcoinjs-lib';
import { getBitcoinAddressError, isValidBitcoinAddress } from '@/lib/bitcoinAddress';

test('Taproot addresses validate with the pure-JS curve library', () => {
  // BIP-86 and BIP-350 test vectors.
  assert.equal(isValidBitcoinAddress('bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr', 'mainnet'), true);
  assert.equal(isValidBitcoinAddress('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', 'mainnet'), true);
  // Well-formed Taproot encoding whose key is not on the curve (x = 0 has no point).
  const offCurve = bitcoin.address.toBech32(new Uint8Array(32), 1, 'bc');
  assert.equal(isValidBitcoinAddress(offCurve, 'mainnet'), false);
});

test('legacy and SegWit addresses still validate, and the wrong network is named', () => {
  assert.equal(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'mainnet'), true);
  assert.equal(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'mainnet'), true);
  assert.equal(getBitcoinAddressError('bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr', 'testnet4'), 'Wrong network');
  assert.equal(getBitcoinAddressError('not-an-address', 'mainnet'), 'Invalid Bitcoin address');
  assert.equal(getBitcoinAddressError('', 'mainnet'), null);
});
