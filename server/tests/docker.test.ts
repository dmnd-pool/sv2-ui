import { PassThrough } from 'node:stream';
import type Docker from 'dockerode';
import { jest, beforeAll, beforeEach, afterEach, describe, expect, it } from '@jest/globals';

const mockExistsSync = jest.fn(() => true);
const mockDockerInstance = {
  ping: jest.fn(),
  getNetwork: jest.fn(),
  listContainers: jest.fn(),
  createNetwork: jest.fn(),
  pull: jest.fn(),
  modem: {
    followProgress: jest.fn(),
  },
  createContainer: jest.fn(),
  getContainer: jest.fn(),
};
const mockDockerFactory = jest.fn(() => mockDockerInstance);

process.env.DOCKER_SOCKET_PATH = '~/docker.sock';
process.env.HOST_HOME = '/Users/test';

let dockerModule: typeof import('../src/docker.js');

beforeAll(async () => {
  await jest.unstable_mockModule('fs', () => ({
    default: {
      existsSync: mockExistsSync,
    },
  }));

  await jest.unstable_mockModule('dockerode', () => ({
    default: mockDockerFactory,
  }));

  dockerModule = await import('../src/docker.js');
});

function createRunningContainer(name: string) {
  return {
    inspect: async () => ({
      Id: `${name}-id`,
      State: {
        Running: true,
        Health: {
          Status: 'healthy',
        },
      },
      NetworkSettings: {
        Ports: {
          '9092/tcp': [{ HostPort: '9092' }],
        },
      },
    }),
    stop: async () => undefined,
    remove: async () => undefined,
  };
}

function createMissingContainer() {
  return {
    inspect: async () => Promise.reject(new Error('missing')),
    stop: async () => undefined,
    remove: async () => undefined,
  };
}

describe('docker orchestration', () => {
  beforeEach(() => {
    dockerModule.__setDockerForTests(
      mockDockerInstance as unknown as Docker,
      {
        endpoint: '/Users/test/docker.sock',
        options: { socketPath: '/Users/test/docker.sock' },
        source: 'DOCKER_SOCKET_PATH=~/docker.sock',
      },
    );

    jest.clearAllMocks();
    mockDockerInstance.ping.mockImplementation(async () => undefined);
    mockDockerInstance.createNetwork.mockImplementation(async () => undefined);
    mockDockerInstance.listContainers.mockImplementation(async () => []);
    mockDockerInstance.getNetwork.mockReturnValue({
      inspect: async () => Promise.reject(new Error('network missing')),
      connect: async () => undefined,
    });
    mockDockerInstance.pull.mockImplementation((...args: unknown[]) => {
      const callback = args[1] as (error: Error | null, stream?: NodeJS.ReadableStream) => void;
      callback(null, new PassThrough());
    });
    mockDockerInstance.modem.followProgress.mockImplementation((...args: unknown[]) => {
      const callback = args[1] as (error: Error | null) => void;
      callback(null);
    });
    mockDockerInstance.createContainer.mockImplementation(async () => ({
      start: async () => undefined,
    }));
    mockDockerInstance.getContainer.mockImplementation(() => createMissingContainer());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves Docker socket paths and reports availability', async () => {
    expect(dockerModule.getDockerConnectionInfo()).toEqual({
      endpoint: '/Users/test/docker.sock',
      options: { socketPath: '/Users/test/docker.sock' },
      source: 'DOCKER_SOCKET_PATH=~/docker.sock',
    });

    await expect(dockerModule.isDockerAvailable()).resolves.toBe(true);
    await expect(dockerModule.ensureDockerAvailable()).resolves.toBeUndefined();
  });

  it('starts JD mode containers in the expected order', async () => {
    jest.useFakeTimers();

    const createdContainers: string[] = [];
    mockDockerInstance.createContainer.mockImplementation(async (...args: unknown[]) => {
      const config = args[0] as { name: string };
      createdContainers.push(config.name);
      return {
        start: async () => undefined,
      };
    });

    const startPromise = dockerModule.startStack(
      {
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
          socket_path: '~/bitcoin/node.sock',
        },
        jdc: {
          user_identity: 'miner',
          jdc_signature: 'sig',
          coinbase_reward_address: 'bc1qexample',
        },
        translator: {
          user_identity: 'miner',
          enable_vardiff: true,
          aggregate_channels: true,
          min_hashrate: 1000000000000,
        },
      },
      '/tmp/sv2-config'
    );

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(3000);
    await startPromise;

    expect(mockDockerInstance.pull).toHaveBeenNthCalledWith(1, 'stratumv2/translator_sv2:main', expect.any(Function));
    expect(mockDockerInstance.pull).toHaveBeenNthCalledWith(2, 'stratumv2/jd_client_sv2:main', expect.any(Function));
    expect(createdContainers).toEqual(['sv2-jdc', 'sv2-translator']);
  });

  it('stops JDC before Translator', async () => {
    const callOrder: string[] = [];
    mockDockerInstance.getContainer.mockImplementation((...args: unknown[]) => {
      const name = String(args[0]);
      const container = createRunningContainer(name);
      container.stop = async () => {
        callOrder.push(`stop:${name}`);
      };
      container.remove = async () => {
        callOrder.push(`remove:${name}`);
      };
      return container;
    });

    await dockerModule.stopStack();

    expect(mockDockerInstance.getContainer.mock.calls.map((call: unknown[]) => String(call[0]))).toEqual(['sv2-jdc', 'sv2-translator']);
    expect(callOrder).toEqual([
      'stop:sv2-jdc',
      'remove:sv2-jdc',
      'stop:sv2-translator',
      'remove:sv2-translator',
    ]);
  });

  it('returns stack status for no-jd and jd modes', async () => {
    mockDockerInstance.getContainer.mockImplementation((...args: unknown[]) => {
      const name = String(args[0]);
      return createRunningContainer(name);
    });

    const noJdStatus = await dockerModule.getStackStatus('no-jd');
    expect(noJdStatus.translator?.status).toBe('healthy');
    expect(noJdStatus.jdc).toBeNull();

    const jdStatus = await dockerModule.getStackStatus('jd');
    expect(jdStatus.translator?.status).toBe('healthy');
    expect(jdStatus.jdc?.status).toBe('healthy');
  });

  it('reports docker unavailable and throws a normalized error when ping fails', async () => {
    const pingError = Object.assign(new Error('missing socket'), { code: 'ENOENT' });
    mockDockerInstance.ping.mockImplementation(async () => Promise.reject(pingError));

    await expect(dockerModule.isDockerAvailable()).resolves.toBe(false);
    await expect(dockerModule.ensureDockerAvailable()).rejects.toThrow(/Docker is not reachable/);
  });
});
