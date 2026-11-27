import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  DEFAULT_SETUP, SETUP_STEP, bridgeCommand, buildsFromSource, clientBuild, clientCommand, clientRelease,
  maskSecrets, minerConnection, nextSetupStep, requiredCredentialStep, restoreSetup, rskCommand, shellQuote, templateAddress,
  updateSetup, validClientPorts, validDifficulty, validHashrate, validMinerName, validRewardAddress, validTpAddress, type SetupAnswers, type SetupSecrets,
} from '../blockSetup';

const secrets: SetupSecrets = { token: 'pool-token', rpcPassword: 'rpc-password', txToken: 'tx-token', mergeSecret: 'merge-secret' };

/** Capture the arguments the shell passes to Docker without starting any containers. */
function dockerArgs(answers: SetupAnswers, values = secrets) {
  return execFileSync('/bin/sh', ['-c', `docker() { printf '%s\\0' "$@"; }\n${clientCommand(answers, values)}`], { encoding: 'utf8' }).split('\0').slice(0, -1);
}

test('missing credentials return users to the earliest required feature step', () => {
  const answers = { ...DEFAULT_SETUP, rpcUser: 'miner', txEnabled: true, mergeEnabled: true };
  const empty = { token: 'pool-token', rpcPassword: '', txToken: '', mergeSecret: '' };
  assert.equal(requiredCredentialStep(answers, empty), SETUP_STEP.transactions);
  assert.equal(requiredCredentialStep(answers, { ...secrets, rpcPassword: '' }), SETUP_STEP.transactions);
  // The dashboard token is asked for on the client step itself, so it never sends anyone back.
  assert.equal(requiredCredentialStep(answers, { ...secrets, txToken: '' }), null);
  assert.equal(requiredCredentialStep(answers, { ...secrets, mergeSecret: '' }), SETUP_STEP.merge);
  assert.equal(requiredCredentialStep({ ...answers, rpcUser: '' }, secrets), SETUP_STEP.transactions);
  assert.equal(requiredCredentialStep(answers, secrets), null);
  assert.equal(requiredCredentialStep(DEFAULT_SETUP, empty), null);
});

test('installing sv2-tp fixes its address without asking for or reusing an existing address', () => {
  const answers = { ...DEFAULT_SETUP, tpSetup: 'no' as const, tpAddress: '192.168.1.4:8999' };
  assert.equal(templateAddress(answers), '127.0.0.1:8336');
  assert.match(clientCommand(answers, secrets), /--tp-address='127\.0\.0\.1:8336'/);
  assert.equal(templateAddress({ ...answers, tpSetup: 'yes' }), '192.168.1.4:8999');
});

test('starting hashrate is omitted unless explicitly set in Advanced settings', () => {
  assert.doesNotMatch(clientCommand(DEFAULT_SETUP, secrets), /DOWNSTREAM_HASHRATE| -d /);
  assert.match(clientCommand({ ...DEFAULT_SETUP, hashrate: '250T' }, secrets), / -d '250T'/);
});

test('hashrates need the T, P or E unit that dmnd-client reads from -d', () => {
  for (const value of ['', '250T', '2.5p', '.5E', '20P', '1.T']) assert.ok(validHashrate(value), value);
  // The client takes the last character as the unit, so each of these stops it at startup.
  for (const value of ['250', '500G', '100M', '1k', '250 T', '0T', 'T', '-5T', `${'9'.repeat(40)}E`]) assert.ok(!validHashrate(value), value);
});

test('optional features accumulate, use separate tokens, and share the selected API port', () => {
  const answers = { ...DEFAULT_SETUP, txEnabled: true, mergeEnabled: true, apiPort: '3009', rpcUser: 'miner' };
  const command = clientCommand(answers, secrets);
  for (const assignment of ["RPC_USER='miner'", "RPC_PWD='rpc-password'", "API_TX_TOKEN='tx-token'", "API_SECRET='merge-secret'", "API_SERVER_PORT='3009'"]) {
    assert.ok(command.includes(assignment), assignment);
  }
  assert.match(bridgeCommand(answers, secrets), /DMND_CLIENT_API_SECRET='merge-secret'/);
  assert.match(bridgeCommand(answers, secrets), /:3009\/api\/coinbase\/op-return/);
  assert.match(bridgeCommand(answers, secrets), /:3009\/api\/merge-mining\/found-job/);
  const disabled = clientCommand({ ...answers, txEnabled: false }, secrets);
  assert.doesNotMatch(disabled, /RPC_URL|RPC_USER|RPC_PWD/);
  assert.match(disabled, /API_SECRET='merge-secret'/);
});

test('every setup sets API_TX_TOKEN, which the client dashboard needs to show templates', () => {
  for (const answers of [DEFAULT_SETUP, { ...DEFAULT_SETUP, mergeEnabled: true }, { ...DEFAULT_SETUP, txEnabled: true, rpcUser: 'miner' }]) {
    assert.match(clientCommand(answers, secrets), /API_TX_TOKEN='tx-token'/);
    assert.match(clientCommand(answers, { ...secrets, txToken: '' }), /API_TX_TOKEN='<dashboard-token>'/);
  }
});

for (const platform of ['linux-x64', 'linux-arm64', 'windows-x64', 'windows-arm64', 'macos-arm64', 'macos-x64'] as const) {
  test(`${platform} runs the Docker image with the right network and dashboard settings`, () => {
    const answers = { ...DEFAULT_SETUP, method: 'docker' as const, platform, hashrate: '250T' };
    const args = dockerArgs(answers);
    assert.deepEqual(args.slice(0, 6), ['run', '-d', '--name', 'dmnd-client', '--restart', 'unless-stopped']);
    const desktop = platform.startsWith('macos');
    assert.equal(args.includes('--network'), !desktop);
    assert.equal(args.includes('API_BIND_ADDRESS=127.0.0.1'), !desktop);
    assert.equal(args.includes('-p'), desktop);
    if (desktop) {
      assert.ok(args.includes('32767:32767'));
      assert.ok(args.includes('127.0.0.1:3001:3001'));
      assert.ok(!args.some((arg) => arg.startsWith('API_BIND_ADDRESS=')));
    } else assert.equal(args[args.indexOf('--network') + 1], 'host');
    for (const env of ['TOKEN=pool-token', 'API_TX_TOKEN=tx-token', 'HEADFUL=false', 'AUTO_UPDATE=false']) {
      assert.equal(args[args.indexOf(env) - 1], '-e', env);
    }
    assert.deepEqual(args.slice(args.indexOf('dmndcorp/dmnd-client:latest') + 1), [
      `--tp-address=${desktop ? 'host.docker.internal' : '127.0.0.1'}:8336`, '-d', '250T',
    ]);
    assert.doesNotMatch(clientCommand(answers, secrets), /chmod|xattr|\.\/dmnd-client|coming soon/);
  });
}

test('Docker uses custom ports, remote templates, optional features, and shell-safe credentials', () => {
  const token = "miner's $(printf injected) `printf injected`\nvalue";
  const answers = { ...DEFAULT_SETUP, method: 'docker' as const, platform: 'macos-arm64' as const,
    minerPort: '3333', apiPort: '3010', tpAddress: '192.168.1.4:8999', txEnabled: true, mergeEnabled: true, rpcUser: 'miner' };
  const args = dockerArgs(answers, { ...secrets, token, rpcPassword: token });
  for (const arg of ['3333:3333', '127.0.0.1:3010:3010', 'API_SERVER_PORT=3010', 'LISTENING_ADDR=0.0.0.0:3333',
    '--tp-address=192.168.1.4:8999', 'RPC_URL=http://host.docker.internal:8332', 'RPC_USER=miner', `RPC_PWD=${token}`, `TOKEN=${token}`, 'API_SECRET=merge-secret']) {
    assert.ok(args.includes(arg), arg);
  }
  // The bridge still runs on the host and reaches the published local API port.
  assert.match(bridgeCommand(answers, secrets), /127\.0\.0\.1:3010\/api\/coinbase\/op-return/);
  assert.doesNotMatch(bridgeCommand(answers, secrets), /host\.docker\.internal/);
  const masked = clientCommand(answers, maskSecrets({ ...secrets, token, rpcPassword: token }));
  assert.doesNotMatch(masked, /pool-token|rpc-password|tx-token|merge-secret|printf injected/);
  assert.match(masked, /-e TOKEN='••••••••'/);
});

test('Docker Desktop rewrites only local host addresses and leaves saved answers intact', () => {
  const answers = { ...DEFAULT_SETUP, method: 'docker' as const, platform: 'macos-x64' as const, txEnabled: true };
  for (const host of ['localhost', '127.0.0.1', '127.0.0.2', '[::1]']) {
    const local = { ...answers, tpAddress: `${host}:8336`, rpcUrl: `http://${host}:8332/rpc?mode=1` };
    const args = dockerArgs(local);
    assert.ok(args.includes('--tp-address=host.docker.internal:8336'));
    assert.ok(args.includes('RPC_URL=http://host.docker.internal:8332/rpc?mode=1'));
    assert.equal(local.rpcUrl, `http://${host}:8332/rpc?mode=1`);
    assert.ok(dockerArgs({ ...local, platform: 'linux-x64' }).includes(`RPC_URL=${local.rpcUrl}`));
  }
  const remote = { ...answers, rpcUrl: 'https://node.example/rpc/localhost', tpAddress: 'templates.example:8336' };
  assert.ok(dockerArgs(remote).includes(`RPC_URL=${remote.rpcUrl}`));
  assert.equal(templateAddress(remote), remote.tpAddress);
  assert.equal(templateAddress({ ...remote, tpSetup: 'no' }), 'host.docker.internal:8336');
});

test('stray spaces around typed values never reach the commands', () => {
  const answers = { ...DEFAULT_SETUP, method: 'docker' as const, platform: 'macos-arm64' as const, txEnabled: true, mergeEnabled: true,
    minDifficulty: ' 1000 ', rpcUrl: ' http://127.0.0.1:8332 ', rpcUser: ' miner ', rskRpcUrl: ' http://127.0.0.1:4444 ' };
  const args = dockerArgs(answers);
  for (const arg of ['DOWNSTREAM_MIN_DIFFICULTY=1000', 'RPC_URL=http://host.docker.internal:8332', 'RPC_USER=miner']) {
    assert.ok(args.includes(arg), arg);
  }
  // The default, typed with spaces, is still the default and stays out of the command.
  assert.doesNotMatch(clientCommand({ ...DEFAULT_SETUP, minDifficulty: ' 131072 ' }, secrets), /DOWNSTREAM_MIN_DIFFICULTY/);
  assert.match(bridgeCommand(answers, secrets), /^RSK_RPC_URL='http:\/\/127\.0\.0\.1:4444' \\/);
});

test('RskJ uses the selected reward address and local RPC port', () => {
  const hex = '12'.repeat(20);
  const command = rskCommand({ ...DEFAULT_SETUP, rewardAddress: ` 0x${hex} `, rskRpcUrl: 'http://127.0.0.1:4455' });
  assert.match(command, /-Drpc.providers.web.http.bind_address=127.0.0.1/);
  assert.match(command, /-Drpc.providers.web.http.port='4455'/);
  // RskJ refuses to start unless miner.reward.address is exactly 40 characters.
  assert.ok(command.includes(`-Dminer.reward.address='${hex}'`));
  assert.equal(hex.length, 40);
  assert.ok(rskCommand({ ...DEFAULT_SETUP, rewardAddress: hex }).includes(`-Dminer.reward.address='${hex}'`));
  assert.doesNotThrow(() => execFileSync('/bin/sh', ['-n'], { input: command }));
  for (const [url, port] of [['http://localhost:80', '80'], ['https://localhost', '443']]) {
    assert.ok(rskCommand({ ...DEFAULT_SETUP, rskRpcUrl: url }).includes(`http.port='${port}'`));
  }
});

test('reward addresses are accepted with or without 0x, and nothing else', () => {
  const hex = 'aB'.repeat(20);
  for (const value of [`0x${hex}`, hex, `0X${hex}`, ` 0x${hex} `]) assert.ok(validRewardAddress(value), value);
  for (const value of ['', '0x', `0x${hex}0`, `0x${hex.slice(1)}`, `0x${'g'.repeat(40)}`]) assert.ok(!validRewardAddress(value), value);
});

test('shell inputs survive quotes, spaces, substitutions, and newlines as literal values', () => {
  const value = "miner's tag $(printf injected) `printf injected`\nsecond line";
  const output = execFileSync('/bin/sh', ['-c', `printf '%s' ${shellQuote(value)}`], { encoding: 'utf8' });
  assert.equal(output, value);
  const command = clientCommand({ ...DEFAULT_SETUP, minerName: value }, { ...secrets, token: value });
  assert.doesNotThrow(() => execFileSync('/bin/sh', ['-n'], { input: command }));
  const bridge = bridgeCommand({ ...DEFAULT_SETUP, apiPort: value }, secrets)
    .replace('./target/release/demand-rsk-op-return-bridge', 'printenv DMND_CLIENT_OP_RETURN_URL');
  assert.equal(execFileSync('/bin/sh', ['-c', bridge], { encoding: 'utf8' }), `http://127.0.0.1:${value}/api/coinbase/op-return\n`);
});

for (const [platform, source, binary] of [
  ['linux-x64', false, 'dmnd-client-linux'], ['macos-arm64', false, 'dmnd-client-macos'],
  ['linux-arm64', true, null], ['macos-x64', true, null],
  ['windows-x64', false, 'dmnd-client-linux'], ['windows-arm64', true, null],
] as const) test(`${platform} installs and updates the correct client`, () => {
  assert.equal(buildsFromSource(platform), source);
  assert.equal(clientCommand({ ...DEFAULT_SETUP, platform }, secrets).includes("AUTO_UPDATE='false'"), source);
  if (binary) assert.equal(clientRelease(platform), `https://github.com/dmnd-pool/dmnd-client/releases/latest/download/${binary}`);
  const command = clientCommand({ ...DEFAULT_SETUP, platform }, secrets);
  assert.ok(command.startsWith(`chmod +x ./dmnd-client\n${platform === 'macos-arm64' ? 'xattr -d com.apple.quarantine ./dmnd-client 2>/dev/null\n' : ''}`));
  assert.doesNotThrow(() => execFileSync('/bin/sh', ['-n'], { input: command }));
});

test('computers without a published binary build it, stopping at the first failed step', () => {
  const command = clientBuild();
  assert.match(command, /cargo build --release --bin dmnd-client/);
  for (const line of command.split('\n').slice(0, -1)) assert.match(line, / && \\$/, line);
  assert.doesNotThrow(() => execFileSync('/bin/sh', ['-n'], { input: command }));
});

test('masked commands hide each secret without touching the rest of the command', () => {
  // A secret typed one character at a time must not hide matching letters elsewhere.
  const typing = { token: 'T', rpcPassword: 'a', txToken: 'p', mergeSecret: 'e' };
  const answers = { ...DEFAULT_SETUP, txEnabled: true, mergeEnabled: true, rpcUser: 'miner' };
  const shown = clientCommand(answers, maskSecrets(typing));
  assert.match(shown, /TOKEN='••••••••' \\\nAPI_BIND_ADDRESS='127\.0\.0\.1'/);
  assert.match(shown, /RPC_PWD='••••••••'/);
  assert.match(shown, /API_SECRET='••••••••'/);
  assert.match(bridgeCommand(answers, maskSecrets(typing)), /^RSK_RPC_URL='http:\/\/127\.0\.0\.1:4444' \\\nDMND_CLIENT_API_SECRET='••••••••'/);
  // Secrets that are not set stay empty, so the command still shows their placeholders.
  assert.match(clientCommand(answers, maskSecrets({ ...typing, txToken: '' })), /API_TX_TOKEN='<dashboard-token>'/);
});

test('saved answers exclude credential fields and preserve Done versus Skip', () => {
  const restored = restoreSetup(JSON.stringify({
    answers: { ...DEFAULT_SETUP, ...secrets, platform: 'macos-arm64' },
    current: 3, status: { 0: 'done', 1: 'done', 2: 'skipped' },
  }));
  assert.equal(restored.current, 3);
  assert.equal(restored.answers.platform, 'macos-arm64');
  assert.equal(restored.status[2], 'skipped');
  for (const key of Object.keys(secrets)) assert.ok(!(key in restored.answers));
  assert.equal(nextSetupStep(restored.status), 3);
});

test('a finished setup with optional features keeps its progress, even though its credentials are gone', () => {
  const status = { 0: 'done', 1: 'done', 2: 'done', 3: 'done', 4: 'done', 5: 'done', 6: 'done' };
  const restored = restoreSetup(JSON.stringify({ answers: { ...DEFAULT_SETUP, txEnabled: true, mergeEnabled: true, rpcUser: 'miner' }, current: 6, status }));
  assert.equal(restored.current, SETUP_STEP.miners);
  assert.deepEqual(restored.status, status);
  // The client step still knows where to send the reader for them.
  assert.equal(requiredCredentialStep(restored.answers, { token: 'pool-token', rpcPassword: '', txToken: '', mergeSecret: '' }), SETUP_STEP.transactions);
});

test('default client commands omit optional overrides until the user changes them', () => {
  const basic = clientCommand(DEFAULT_SETUP, secrets);
  assert.doesNotMatch(basic, /API_SERVER_PORT|LISTENING_ADDR|LOGLEVEL|HEADFUL|AUTO_UPDATE/);
  const custom = clientCommand({ ...DEFAULT_SETUP, minerPort: '3333', apiPort: '3010', headful: false }, secrets);
  assert.match(custom, /LISTENING_ADDR='0\.0\.0\.0:3333'/);
  assert.match(custom, /API_SERVER_PORT='3010'/);
  assert.match(custom, /HEADFUL='false'/);
});

test('broken saved data cannot unlock steps or select unsupported platforms', () => {
  assert.equal(restoreSetup('{broken').current, 0);
  const restored = restoreSetup(JSON.stringify({ answers: { platform: '__proto__', method: 'unknown' }, current: 200, status: { 0: 'done', 2: 'done' } }));
  assert.equal(restored.answers.platform, DEFAULT_SETUP.platform);
  assert.equal(restored.answers.method, 'binary');
  assert.equal(restoreSetup(JSON.stringify({ answers: { method: 'docker' } })).answers.method, 'docker');
  assert.equal(restored.current, 1);
  assert.equal(restored.status[2], undefined);
  assert.equal(minerConnection({ ...DEFAULT_SETUP, clientIp: '192.168.1.15', minerPort: '3333' }), 'stratum+tcp://192.168.1.15:3333');
});

test('editing or skipping an earlier feature clears dependent progress; reviewing preserves it', () => {
  const progress = { answers: { ...DEFAULT_SETUP, txEnabled: true }, current: SETUP_STEP.transactions, status: { 0: 'done', 1: 'done', 2: 'done', 3: 'done', 4: 'done', 5: 'done', 6: 'done' } as const };
  const edited = updateSetup(progress, { rpcUser: 'new-user' });
  assert.deepEqual(edited.status, { 0: 'done', 1: 'done', 2: 'done' });
  assert.equal(edited.current, SETUP_STEP.transactions);
  const skipped = updateSetup(progress, { txEnabled: false }, 'skipped');
  assert.deepEqual(skipped.status, { ...edited.status, 3: 'skipped' });
  assert.equal(skipped.answers.txEnabled, false);
  assert.equal(skipped.current, SETUP_STEP.merge);
  assert.equal(progress.status[6], 'done');
  assert.deepEqual(updateSetup(progress, { txEnabled: true }, 'done').status, progress.status);
});

test('install answers undo only the steps whose commands use them', () => {
  const status = { 0: 'done', 1: 'done', 2: 'done', 3: 'done', 4: 'done', 5: 'done', 6: 'done' } as const;
  const answers = { ...DEFAULT_SETUP, coreSetup: 'yes' as const, tpSetup: 'yes' as const, tpAddress: '192.168.1.4:8999' };
  // Asking for Bitcoin Core install help changes no command, so a finished setup stays finished.
  const core = { answers, current: SETUP_STEP.core, status };
  assert.deepEqual(updateSetup(core, { coreSetup: 'no' }).status, status);
  assert.deepEqual(updateSetup(core, { coreSetup: null }).status, status);
  // Installing sv2-tp moves the template address, so only the client step and the one after it go.
  const tp = { answers, current: SETUP_STEP.tp, status };
  assert.deepEqual(updateSetup(tp, { tpSetup: 'no' }).status, { 0: 'done', 1: 'done', 2: 'done', 3: 'done', 4: 'done' });
  const answered = updateSetup({ ...tp, answers: { ...answers, tpSetup: null }, status: { 0: 'done', 1: 'done' } }, { tpSetup: 'yes' }, 'done');
  assert.deepEqual(answered.status, { 0: 'done', 1: 'done', 2: 'done' });
  assert.equal(answered.current, SETUP_STEP.transactions);
});

test('client ports must be in range and numerically different', () => {
  assert.ok(validClientPorts(DEFAULT_SETUP));
  for (const port of ['', '0', '65536', '1.5', '3001', '03001']) {
    assert.ok(!validClientPorts({ ...DEFAULT_SETUP, minerPort: port }), port);
  }
  assert.ok(!validClientPorts({ ...DEFAULT_SETUP, apiPort: 'bad' }));
});

test('Template Provider addresses accept only a host and valid TCP port', () => {
  for (const address of ['127.0.0.1:8336', 'node.local:8336', '[::1]:8336']) assert.ok(validTpAddress(address), address);
  for (const address of ['localhost', 'localhost:0', 'localhost:65536', 'user@localhost:8336', 'localhost:8336/path', 'localhost:8336?x', 'localhost:8336#x', 'localhost:8336?', 'localhost:8336#', 'local\nhost:8336']) {
    assert.ok(!validTpAddress(address), address);
  }
});

test('difficulty and miner names must fit the client parser', () => {
  for (const value of ['131072', '.5', '1e3']) assert.ok(validDifficulty(value), value);
  for (const value of ['', '0', '-1', '0x100', 'Infinity', '1e40']) assert.ok(!validDifficulty(value), value);
  for (const name of ['', 'a'.repeat(10), 'é'.repeat(5)]) assert.ok(validMinerName(name), name);
  for (const name of ['a'.repeat(11), 'é'.repeat(6)]) assert.ok(!validMinerName(name), name);
  const answers = { ...DEFAULT_SETUP, tagPrefix: '/custom/' };
  assert.doesNotMatch(clientCommand(answers, secrets), /TAG_PREFIX/);
  assert.equal(restoreSetup(JSON.stringify({ answers })).answers.tagPrefix, DEFAULT_SETUP.tagPrefix);
});
