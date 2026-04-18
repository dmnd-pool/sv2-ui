import { describe, expect, it } from '@jest/globals';
import { generateJdcConfig, generateTranslatorConfig, normalizeSetupData } from '../src/config-generator.js';
import type { SetupData } from '../src/types.js';

function createBaseSetupData(): SetupData {
  return {
    miningMode: 'pool',
    mode: 'jd',
    pool: {
      name: 'Braiins Pool',
      address: 'stratum.braiins.com',
      port: 3333,
      authority_public_key: '9awtMD5KQgvRUh2yFbjVeT7b6hjipWcAsQHd6wEhgtDT9soosna',
    },
    bitcoin: {
      network: 'mainnet',
      os: 'macos',
      customDataDir: '/Users/test/Library/Application Support/Bitcoin',
      socket_path: '~/Library/Application Support/Bitcoin/bitcoin.sock',
    },
    jdc: {
      user_identity: 'miner',
      jdc_signature: 'signature',
      coinbase_reward_address: 'bc1qexample',
    },
    translator: {
      user_identity: 'miner',
      enable_vardiff: true,
      aggregate_channels: false,
      min_hashrate: 1000000000000,
    },
  };
}

describe('config generation', () => {
  it('enables translator channel aggregation for supported pool configurations', () => {
    const normalized = normalizeSetupData({
      ...createBaseSetupData(),
      translator: {
        ...createBaseSetupData().translator,
        aggregate_channels: false,
      },
    });

    expect(normalized.translator.aggregate_channels).toBe(true);
  });

  it('escapes translator TOML values that contain quotes and newlines', () => {
    const config = generateTranslatorConfig({
      ...createBaseSetupData(),
      mode: 'no-jd',
      pool: {
        name: 'Custom Pool',
        address: 'pool.example.com',
        port: 3333,
        authority_public_key: 'authority-key',
      },
      translator: {
        ...createBaseSetupData().translator,
        user_identity: 'test"\n[malicious]\nkey="value',
      },
      jdc: null,
      bitcoin: null,
    });

    expect(config).toContain('user_identity = "test\\"\\n[malicious]\\nkey=\\"value"');
    expect(config).not.toMatch(/\n\[malicious\]\n/);
  });

  it('escapes JD config fields without changing the expected mode selection', () => {
    const config = generateJdcConfig({
      ...createBaseSetupData(),
      miningMode: 'solo',
      pool: null,
      jdc: {
        user_identity: 'miner',
        jdc_signature: 'sig"\nline',
        coinbase_reward_address: 'bc1qexample',
      },
      translator: {
        ...createBaseSetupData().translator,
        aggregate_channels: false,
      },
    });

    expect(config).not.toBeNull();
    expect(config).toContain('mode = "SOLOMINING"');
    expect(config).toContain('jdc_signature = "sig\\"\\nline"');
    expect(config).not.toMatch(/\n\[malicious\]\n/);
  });
});
