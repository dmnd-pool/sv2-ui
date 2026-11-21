import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

bitcoin.initEccLib(ecc);

/** Validate legacy, SegWit, and Taproot addresses against the selected network. */
export function isValidBitcoinAddress(addr: string, network: 'mainnet' | 'testnet4'): boolean {
  if (!addr) return false;
  const btcNetwork = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  try {
    bitcoin.address.toOutputScript(addr, btcNetwork);
    return true;
  } catch {
    return false;
  }
}

export function getBitcoinAddressError(addr: string, network: 'mainnet' | 'testnet4'): string | null {
  if (!addr || isValidBitcoinAddress(addr, network)) return null;
  const otherNetwork = network === 'mainnet' ? 'testnet4' : 'mainnet';
  return isValidBitcoinAddress(addr, otherNetwork) ? 'Wrong network' : 'Invalid Bitcoin address';
}
