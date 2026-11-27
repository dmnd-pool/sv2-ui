export const SETUP_STEPS = [
  'Introduction', 'Bitcoin Core', 'sv2-tp', 'Transaction priority', 'Merge mining',
  'DMND Client', 'Connect miners',
] as const;

export const SETUP_STEP = { introduction: 0, core: 1, tp: 2, transactions: 3, merge: 4, client: 5, miners: 6 } as const;

export const PLATFORMS = {
  'linux-x64': 'Linux · Intel or AMD (64-bit)',
  'linux-arm64': 'Linux · ARM (64-bit)',
  'windows-x64': 'Windows / WSL · Intel or AMD (64-bit)',
  'windows-arm64': 'Windows / WSL · ARM (64-bit)',
  'macos-arm64': 'macOS · Apple Silicon',
  'macos-x64': 'macOS · Intel',
} as const;

export const DEFAULT_SETUP = {
  platform: 'linux-x64' as keyof typeof PLATFORMS,
  coreSetup: null as 'yes' | 'no' | null,
  tpSetup: null as 'yes' | 'no' | null,
  tpAddress: '127.0.0.1:8336', method: 'binary' as 'binary' | 'docker',
  clientIp: '', hashrate: '', minerPort: '32767', apiPort: '3001',
  loglevel: 'info', headful: true, autoUpdate: true, minerName: '', tagPrefix: '/DMND/',
  minDifficulty: '131072', shareLog: false, txEnabled: false,
  rpcUrl: 'http://127.0.0.1:8332', rpcUser: '', mergeEnabled: false,
  rewardAddress: '', rskRpcUrl: 'http://127.0.0.1:4444',
};

export type SetupAnswers = typeof DEFAULT_SETUP;

/** Credentials stay in memory and are never included in the saved answers. */
export type SetupSecrets = Record<'token' | 'rpcPassword' | 'txToken' | 'mergeSecret', string>;

export interface SetupProgress {
  answers: SetupAnswers;
  current: number;
  status: Partial<Record<number, 'done' | 'skipped'>>;
}

export function nextSetupStep(status: SetupProgress['status']) {
  const next = SETUP_STEPS.findIndex((_, index) => !status[index]);
  return next === -1 ? SETUP_STEPS.length - 1 : next;
}

const FIRST_USED_ON: Partial<Record<keyof SetupAnswers, number>> = { coreSetup: SETUP_STEPS.length, tpSetup: SETUP_STEP.client };

export function updateSetup(progress: SetupProgress, patch: Partial<SetupAnswers>, result?: 'done' | 'skipped'): SetupProgress {
  // With nothing changed, Math.min() is Infinity and every step is kept.
  const undoFrom = Math.min(...Object.entries(patch)
    .filter(([key, value]) => progress.answers[key as keyof SetupAnswers] !== value)
    .map(([key]) => FIRST_USED_ON[key as keyof SetupAnswers] ?? progress.current));
  const status = Object.fromEntries(Object.entries(progress.status).filter(([step]) => Number(step) < undoFrom));
  if (result) status[progress.current] = result;
  return {
    answers: { ...progress.answers, ...patch }, status,
    current: result ? Math.min(progress.current + 1, SETUP_STEPS.length - 1) : progress.current,
  };
}

export function requiredCredentialStep(answers: SetupAnswers, secrets: SetupSecrets): number | null {
  if (answers.txEnabled && (!answers.rpcUser.trim() || !secrets.rpcPassword)) return SETUP_STEP.transactions;
  if (answers.mergeEnabled && !secrets.mergeSecret) return SETUP_STEP.merge;
  return null;
}

export function restoreSetup(raw: string | null): SetupProgress {
  const fallback: SetupProgress = { answers: { ...DEFAULT_SETUP }, current: 0, status: {} };
  try {
    const saved = JSON.parse(raw ?? 'null');
    if (!saved || typeof saved !== 'object' || !saved.answers || typeof saved.answers !== 'object') return fallback;
    // Copy known, correctly typed settings only.
    const answers = { ...DEFAULT_SETUP };
    for (const key of Object.keys(DEFAULT_SETUP) as (keyof SetupAnswers)[]) {
      const value: unknown = saved.answers[key];
      if (typeof value === typeof DEFAULT_SETUP[key] && typeof value !== 'object') {
        Object.assign(answers, { [key]: value });
      }
    }
    answers.platform = Object.prototype.hasOwnProperty.call(PLATFORMS, saved.answers.platform) ? saved.answers.platform : DEFAULT_SETUP.platform;
    answers.method = saved.answers.method === 'docker' ? 'docker' : 'binary';
    answers.tagPrefix = DEFAULT_SETUP.tagPrefix;
    for (const key of ['coreSetup', 'tpSetup'] as const) {
      answers[key] = ['yes', 'no'].includes(saved.answers[key]) ? saved.answers[key] : null;
    }
    const status: SetupProgress['status'] = {};
    for (let index = 0; index < SETUP_STEPS.length; index++) {
      const value = saved.status?.[index];
      if (value !== 'done' && value !== 'skipped') break;
      status[index] = value;
    }
    const current = Number.isInteger(saved.current) && saved.current >= 0 ? Math.min(saved.current, nextSetupStep(status)) : 0;
    return { answers, current, status };
  } catch {
    return fallback;
  }
}

/** Single-quote shell values so user input stays data, including quotes and substitutions. */
export function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function commandWithEnv(env: Record<string, string>, command: string, prefix = '') {
  return [...Object.entries(env).map(([key, value]) => `${prefix}${key}=${shellQuote(value)}`), command].join(' \\\n');
}

/** The on-screen stand-in for each secret that is set. */
export function maskSecrets(secrets: SetupSecrets) {
  return Object.fromEntries(Object.entries(secrets).map(([key, value]) => [key, value && '••••••••'])) as SetupSecrets;
}

/** dmnd-client reads -d as a number followed by T, P or E, such as 250T. */
export function validHashrate(value: string) {
  const hashrate = value.trim();
  const rate = Math.fround(Number(hashrate.slice(0, -1)) * 10 ** ({ t: 12, p: 15, e: 18 }[hashrate.slice(-1).toLowerCase()] ?? 0));
  return !hashrate || (/^(?:\d+(?:\.\d*)?|\.\d+)[tpe]$/i.test(hashrate) && Number.isFinite(rate) && rate > 0);
}

export const validMinerName = (value: string) => new TextEncoder().encode(value).length <= 10;

export function validDifficulty(value: string) {
  const difficulty = Math.fround(Number(value));
  return /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) && Number.isFinite(difficulty) && difficulty > 0;
}

const validPort = (value: string) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535;

export function validClientPorts(answers: SetupAnswers) {
  return validPort(answers.minerPort) && validPort(answers.apiPort) && Number(answers.minerPort) !== Number(answers.apiPort);
}

export function validTpAddress(address: string) {
  try {
    const url = new URL(`tcp://${address}`);
    return !!url.hostname && validPort(url.port) && !/[\s/?#@]/.test(address);
  } catch { return false; }
}

/** Wallets show Rootstock addresses with 0x. RskJ's miner.reward.address takes the 40 characters after it. */
export function validRewardAddress(value: string) {
  return /^(?:0x)?[0-9a-f]{40}$/i.test(value.trim());
}

/** Only Linux on Intel/AMD and Apple Silicon Macs have a published client binary. */
export function buildsFromSource(platform: SetupAnswers['platform']) {
  return platform === 'linux-arm64' || platform === 'windows-arm64' || platform === 'macos-x64';
}

export const usesDockerDesktop = (answers: SetupAnswers) => answers.method === 'docker' && answers.platform.startsWith('macos');

/** Docker Desktop reaches services on the Mac through its host alias, not container loopback. */
function clientHostAddress(answers: SetupAnswers, address: string) {
  return usesDockerDesktop(answers)
    ? address.replace(/^(https?:\/\/)?(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])(?=[:/?#]|$)/i, '$1host.docker.internal')
    : address;
}

export function templateAddress(answers: SetupAnswers) {
  // The installation we generate binds sv2-tp on this host. Do not ask for that address again.
  return clientHostAddress(answers, answers.tpSetup === 'no' ? '127.0.0.1:8336' : answers.tpAddress.trim() || '<template-provider-ip>:8336');
}

/** The latest published binary for a computer that has one. */
export function clientRelease(platform: SetupAnswers['platform']) {
  return `https://github.com/dmnd-pool/dmnd-client/releases/latest/download/${platform.startsWith('macos') ? 'dmnd-client-macos' : 'dmnd-client-linux'}`;
}

/** Builds the client on a computer with no published binary. Each step runs only if the one before it worked. */
export function clientBuild() {
  return [
    'git clone https://github.com/dmnd-pool/dmnd-client.git',
    'cd dmnd-client',
    'cargo build --release --bin dmnd-client',
    'cp target/release/dmnd-client ./dmnd-client',
  ].join(' && \\\n');
}

export function clientCommand(answers: SetupAnswers, secrets: SetupSecrets) {
  const env: Record<string, string> = {
    TOKEN: secrets.token || '<DMND-token>',
    API_BIND_ADDRESS: '127.0.0.1',
    API_TX_TOKEN: secrets.txToken || '<dashboard-token>',
  };
  if (answers.apiPort !== DEFAULT_SETUP.apiPort) env.API_SERVER_PORT = answers.apiPort;
  if (answers.minerPort !== DEFAULT_SETUP.minerPort) env.LISTENING_ADDR = `0.0.0.0:${answers.minerPort}`;
  if (answers.loglevel !== DEFAULT_SETUP.loglevel) env.LOGLEVEL = answers.loglevel;
  if (answers.method === 'docker' || !answers.headful) env.HEADFUL = 'false';
  // Source builds must not update to binaries for a different architecture.
  if (answers.method === 'docker' || !answers.autoUpdate || buildsFromSource(answers.platform)) env.AUTO_UPDATE = 'false';
  if (answers.minerName) env.MINER_NAME = answers.minerName;
  // Pasted values often carry spaces that the checks ignore but the client would not.
  const minDifficulty = answers.minDifficulty.trim();
  if (minDifficulty !== DEFAULT_SETUP.minDifficulty) env.DOWNSTREAM_MIN_DIFFICULTY = minDifficulty;
  if (answers.shareLog) env.SHARE_LOG = 'true';
  if (answers.txEnabled) {
    env.RPC_URL = clientHostAddress(answers, answers.rpcUrl.trim());
    env.RPC_USER = answers.rpcUser.trim() || '<bitcoin-rpc-user>';
    env.RPC_PWD = secrets.rpcPassword || '<bitcoin-rpc-password>';
  }
  if (answers.mergeEnabled) env.API_SECRET = secrets.mergeSecret || '<merge-mining-secret>';
  const flags = [`--tp-address=${shellQuote(templateAddress(answers))}`];
  if (answers.hashrate.trim()) flags.push(`-d ${shellQuote(answers.hashrate.trim())}`);
  if (answers.method === 'docker') {
    const desktop = usesDockerDesktop(answers);
    if (desktop) delete env.API_BIND_ADDRESS;
    return [
      'docker run -d --name dmnd-client --restart unless-stopped',
      ...(desktop ? [`-p ${shellQuote(`${answers.minerPort}:${answers.minerPort}`)}`, `-p ${shellQuote(`127.0.0.1:${answers.apiPort}:${answers.apiPort}`)}`] : ['--network host']),
      commandWithEnv(env, `dmndcorp/dmnd-client:latest ${flags.join(' ')}`, '-e '),
    ].join(' \\\n');
  }
  // Browser downloads on macOS need their quarantine mark removed before running.
  const prepare = `chmod +x ./dmnd-client\n${answers.platform === 'macos-arm64' ? 'xattr -d com.apple.quarantine ./dmnd-client 2>/dev/null\n' : ''}`;
  return prepare + commandWithEnv(env, `./dmnd-client ${flags.join(' ')}`);
}

export function minerConnection(answers: SetupAnswers) {
  return `stratum+tcp://${answers.clientIp.trim() || '<client-machine-LAN-IP>'}:${answers.minerPort}`;
}

export function bridgeCommand(answers: SetupAnswers, secrets: SetupSecrets) {
  return commandWithEnv({
    RSK_RPC_URL: answers.rskRpcUrl.trim(),
    DMND_CLIENT_API_SECRET: secrets.mergeSecret || '<merge-mining-secret>',
    DMND_CLIENT_OP_RETURN_URL: `http://127.0.0.1:${answers.apiPort}/api/coinbase/op-return`,
    DMND_CLIENT_FOUND_JOB_URL: `http://127.0.0.1:${answers.apiPort}/api/merge-mining/found-job`,
  }, './target/release/demand-rsk-op-return-bridge');
}

export function rskCommand(answers: SetupAnswers) {
  let port = '4444';
  try {
    const url = new URL(answers.rskRpcUrl);
    port = url.port || (url.protocol === 'https:' ? '443' : '80');
  } catch { /* Keep the local default while editing. */ }
  return [
    'java',
    '  -Drpc.providers.web.http.enabled=true',
    '  -Drpc.providers.web.http.bind_address=127.0.0.1',
    `  -Drpc.providers.web.http.port=${shellQuote(port)}`,
    '  -Drpc.modules.mnr.version=1.0',
    '  -Drpc.modules.mnr.enabled=true',
    '  -Dminer.server.enabled=true',
    // RskJ refuses to start unless this is exactly 40 characters, so the 0x is left out.
    `  -Dminer.reward.address=${shellQuote(answers.rewardAddress.trim().replace(/^0x/i, '') || '<your-Rootstock-address>')}`,
    '  -cp ./rskj-core-9.0.3-VETIVER-all.jar co.rsk.Start',
  ].join(' \\\n');
}
