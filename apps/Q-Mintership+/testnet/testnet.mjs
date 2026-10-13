#!/usr/bin/env node
/**
 * Q-Mintership+'s private testnet (dev-only; nothing here is in the app).
 *
 *   node testnet/testnet.mjs init     fresh keys, chain config and settings in ~/.qmp-testnet
 *   node testnet/testnet.mjs start    start the node in its own network namespace
 *   node testnet/testnet.mjs status   height, peers, isTestNet
 *   node testnet/testnet.mjs stop     stop the node (data and keys stay)
 *
 * Isolation, in layers:
 * - the node runs under `unshare -rn`: a network namespace with nothing but
 *   loopback, so it can't reach any peer, mainnet or otherwise; a Unix socket
 *   in the testnet home (lib/bridge.mjs) is the only way in;
 * - its settings: isTestNet, its own chain config with a fresh genesis, its
 *   own repository and data folders, ports 24391–24394 bound to 127.0.0.1, a
 *   fixed network of one address nobody listens on, Reticulum off, no
 *   archive, no auto-update;
 * - every write the tools make checks GET /admin/info says "isTestNet": true.
 *
 * Keys are generated fresh by `init` and kept in ~/.qmp-testnet/keys.json
 * (mode 600). Nothing here prints a key.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountOf, base58Decode, base58Encode, newSeed, rewardShareSeed } from './lib/keys.mjs';
import { SOCKET_PATH, TESTNET_HOME, getJson, getText, post, sleep } from './lib/node.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOME = TESTNET_HOME;
const JAR_SOURCE = process.env.QMP_CORE_JAR || path.join(os.homedir(), 'qortal', 'qortal.jar');
/** Core's own testnet log settings (qortal.log in the testnet home). */
const LOG_CONFIG =
  process.env.QMP_CORE_LOG4J || path.join(os.homedir(), 'Desktop', 'ThankQ', 'qortal-core-src', 'testnet', 'log4j2.properties');
export const PORTS = { api: 24391, listen: 24392, devProxy: 24393, data: 24394, nobody: 24399 };

/** The test accounts: label prefix, how many, level. */
export const POOL = [
  { prefix: 'admin', count: 30, level: 7 },
  { prefix: 'low', count: 6, level: 4 },
  { prefix: 'nom', count: 16, level: 5 },
  { prefix: 'mem', count: 16, level: 2 },
  { prefix: 'new', count: 40, level: 0 },
];

const file = (name) => path.join(HOME, name);

function writePrivate(name, content) {
  fs.writeFileSync(file(name), content, { mode: 0o600 });
  fs.chmodSync(file(name), 0o600);
}

export function loadKeys() {
  const raw = JSON.parse(fs.readFileSync(file('keys.json'), 'utf8'));
  const toAccount = (entry) => ({ ...accountOf(Buffer.from(entry.seed, 'hex')), label: entry.label, level: entry.level });
  return {
    minter: toAccount(raw.minter),
    faucet: toAccount(raw.faucet),
    pool: raw.pool.map(toAccount),
    extra: (raw.extra ?? []).map(toAccount),
  };
}

function chainConfig(keys, genesisTimestamp) {
  const mainnet = JSON.parse(execFileSync('unzip', ['-p', file('qortal.jar'), 'blockchain.json']).toString('utf8'));
  const config = { isTestChain: true, ...mainnet };
  delete config.checkpoints;
  // Today's mainnet rules from the first block, except what a fresh one-node chain can't meet.
  const triggers = {};
  for (const key of Object.keys(mainnet.featureTriggers)) triggers[key] = 0;
  Object.assign(triggers, {
    transactionV6Timestamp: 9999999999999,
    increaseOnlineAccountsDifficultyTimestamp: 9999999999999,
    selfSponsorshipAlgoV1Height: 99999999,
    selfSponsorshipAlgoV2Height: 99999999,
    selfSponsorshipAlgoV3Height: 99999999,
    unconfirmableRewardSharesHeight: 99999999,
    disableTransferPrivsTimestamp: 9999999999990,
    enableTransferPrivsTimestamp: 9999999999999,
    cancelSellNameValidationTimestamp: 9999999999999,
    fixBatchRewardHeight: 99999999,
  });
  config.featureTriggers = triggers;
  Object.assign(config, {
    blockRewardBatchStartHeight: 99999000,
    onlineAccountsModulusV2Timestamp: 0,
    onlineAccountsModulusV3Timestamp: 9999999999999,
    selfSponsorshipAlgoV1SnapshotTimestamp: 9999999999999,
    selfSponsorshipAlgoV2SnapshotTimestamp: 9999999999999,
    selfSponsorshipAlgoV3SnapshotTimestamp: 9999999999999,
    minAccountLevelForBlockSubmissions: 1,
    minAccountLevelToRewardShare: 2,
    unitFees: [{ timestamp: 0, fee: '0.01' }],
    nameRegistrationUnitFees: [{ timestamp: 0, fee: '1.25' }],
    // Minting needs membership of group 1 (created below), as mainnet needs MINTER.
    mintingGroupIds: [{ height: 0, ids: [1] }],
  });
  const share = accountOf(rewardShareSeed(keys.minter.seed, base58Decode(keys.minter.publicKey)));
  const txs = [
    { type: 'ISSUE_ASSET', assetName: 'QORT', description: 'QORTAL coin', quantity: 0, isDivisible: true, data: '{}' },
    { type: 'ISSUE_ASSET', assetName: 'Legacy-QORA', description: 'Representative legacy QORA', quantity: 0, isDivisible: true, data: '{}', isUnspendable: true },
    { type: 'ISSUE_ASSET', assetName: 'QORT-from-QORA', description: 'QORT gained from holding legacy QORA', quantity: 0, isDivisible: true, data: '{}', isUnspendable: true },
    { type: 'GENESIS', recipient: keys.minter.address, amount: 1000000 },
    { type: 'GENESIS', recipient: keys.faucet.address, amount: 10000000 },
    ...keys.pool.map((a) => ({ type: 'GENESIS', recipient: a.address, amount: 1000 })),
    { type: 'ACCOUNT_FLAGS', target: keys.minter.address, andMask: -1, orMask: 1, xorMask: 0 },
    ...keys.pool.filter((a) => a.level > 0).map((a) => ({ type: 'ACCOUNT_LEVEL', target: a.address, level: a.level })),
    {
      type: 'REWARD_SHARE',
      minterPublicKey: keys.minter.publicKey,
      recipient: keys.minter.address,
      rewardSharePublicKey: share.publicKey,
      sharePercent: 0,
    },
    {
      type: 'CREATE_GROUP',
      creatorPublicKey: keys.minter.publicKey,
      owner: keys.minter.address,
      groupName: 'qmp-minting',
      description: 'testnet minting group',
      isOpen: false,
      approvalThreshold: 'ONE',
      minimumBlockDelay: 5,
      maximumBlockDelay: 1440,
    },
  ];
  config.genesisInfo = { version: 4, timestamp: String(genesisTimestamp), transactions: txs };
  return { config, rewardShare: share };
}

function settings() {
  return {
    isTestNet: true,
    blockchainConfig: 'testchain.json',
    repositoryPath: 'db',
    dataPath: 'data',
    listsPath: 'lists',
    bindAddress: '127.0.0.1',
    apiPort: PORTS.api,
    listenPort: PORTS.listen,
    listenDataPort: PORTS.data,
    devProxyPort: PORTS.devProxy,
    apiWhitelist: ['127.0.0.1', '::1'],
    apiRestricted: false,
    localAuthBypassEnabled: true,
    apiDocumentationEnabled: false,
    singleNodeTestnet: true,
    minBlockchainPeers: 0,
    fixedNetwork: [`127.0.0.1:${PORTS.nobody}`],
    maxPeers: 2,
    minOutboundPeers: 0,
    uPnPEnabled: false,
    autoUpdateEnabled: false,
    // With the archive off, bootstrap: true stops Core rebuilding a chain that has
    // only its genesis block at every start (BlockChain.validate); it can't fetch
    // a bootstrap anyway, with no network in the namespace.
    bootstrap: true,
    archiveEnabled: false,
    recoveryModeTimeout: 0,
    // No NTP without a network: use the host clock as it is (the host keeps it in sync).
    testNtpOffset: 0,
    allowConnectionsWithOlderPeerVersions: false,
    reticulumBackboneGatewayServers: [],
    reticulumTcpGatewayServers: [],
    reticulumDesiredClientInterfaces: 0,
    reticulumMaxPeers: 0,
    reticulumMinOutboundPeers: 0,
    reticulumMaxDataPeers: 0,
    reticulumMinDesiredCorePeers: 0,
    reticulumMinDesiredDataPeers: 0,
    bitcoinNet: 'TEST3',
    litecoinNet: 'TEST3',
    dogecoinNet: 'TEST3',
    digibyteNet: 'TEST3',
    ravencoinNet: 'TEST3',
  };
}

function init() {
  if (fs.existsSync(file('keys.json')) || fs.existsSync(file('db'))) {
    console.error(`${HOME} already holds a testnet. Stop it and move that folder away to start a fresh one.`);
    process.exit(1);
  }
  fs.mkdirSync(HOME, { recursive: true, mode: 0o700 });
  fs.chmodSync(HOME, 0o700);
  fs.copyFileSync(JAR_SOURCE, file('qortal.jar'));
  const version = execFileSync('unzip', ['-p', file('qortal.jar'), 'build.properties']).toString('utf8').trim();
  const seedEntry = (label, level) => ({ label, level, seed: newSeed().toString('hex') });
  const raw = {
    created: new Date().toISOString(),
    minter: seedEntry('minter', 10),
    faucet: seedEntry('faucet', 0),
    pool: POOL.flatMap(({ prefix, count, level }) =>
      Array.from({ length: count }, (_, i) => seedEntry(`${prefix}${String(i + 1).padStart(2, '0')}`, level))
    ),
  };
  writePrivate('keys.json', JSON.stringify(raw, null, 1));
  const keys = loadKeys();
  const { config, rewardShare } = chainConfig(keys, Date.now() - 60_000);
  fs.writeFileSync(file('testchain.json'), JSON.stringify(config, null, 1));
  fs.writeFileSync(file('settings.json'), JSON.stringify(settings(), null, 1));
  writePrivate('minting.json', JSON.stringify({ rewardShareSeed: base58Encode(rewardShare.seed) }));
  fs.copyFileSync(LOG_CONFIG, file('log4j2.properties'));
  console.log(`Testnet home: ${HOME}`);
  console.log(`Core jar: copied from ${JAR_SOURCE} (${version.replace(/\n/g, ', ')})`);
  console.log(`Accounts: minter, faucet and ${keys.pool.length} pool accounts (keys in keys.json, mode 600).`);
}

function readPid(name) {
  try {
    const pid = Number(fs.readFileSync(file(name), 'utf8'));
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function start() {
  if (!fs.existsSync(file('keys.json'))) {
    console.error('No testnet yet: run init first.');
    process.exit(1);
  }
  if (readPid('node.pid')) {
    console.log('Already running.');
    return;
  }
  await freshChainFix();
  // One shell inside a fresh network namespace (loopback only): the node, and the bridge in front.
  const script = [
    'set -e',
    'ip link set lo up',
    `cd ${JSON.stringify(HOME)}`,
    'java -Djava.net.preferIPv4Stack=false -Xss256m -Xmx1536m -jar qortal.jar settings.json > node.log 2>&1 &',
    'echo $! > node.pid',
    `exec ${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(here, 'lib', 'bridge.mjs'))} ${JSON.stringify(SOCKET_PATH)} ${PORTS.api}`,
  ].join('\n');
  const child = spawn('unshare', ['-rn', 'sh', '-c', script], {
    detached: true,
    stdio: ['ignore', fs.openSync(file('bridge.log'), 'a'), fs.openSync(file('bridge.log'), 'a')],
  });
  fs.writeFileSync(file('bridge.pid'), String(child.pid));
  child.unref();
  console.log('Starting the node (isolated network namespace)…');
  for (let i = 0; i < 90; i++) {
    await sleep(2_000);
    const info = await getJson('/admin/info').catch(() => null);
    if (info) {
      if (info.isTestNet !== true) {
        console.error('The node does not say isTestNet: stopping it.');
        await stop();
        process.exit(1);
      }
      console.log(`Up: ${info.buildVersion}, isTestNet ${info.isTestNet}`);
      await addMintingKey();
      return;
    }
  }
  console.error('The node did not answer within 3 minutes; see node.log.');
  process.exit(1);
}

/** Run a command inside its own loopback-only network namespace, in the testnet home. */
function isolated(command, { timeoutMs = 180_000 } = {}) {
  return execFileSync('unshare', ['-rn', 'sh', '-c', `ip link set lo up; cd ${JSON.stringify(HOME)}; ${command}`], {
    timeout: timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString('utf8');
}

/**
 * Core 6.1.9 can't start a brand-new chain (lib/PrimeChain.java says why),
 * so the database and the genesis block are made offline before the first
 * start, with Core's own classes.
 */
async function freshChainFix() {
  if (fs.existsSync(file('db'))) return;
  console.log('First start: creating the database and the genesis block…');
  const out = isolated(`java -cp qortal.jar ${JSON.stringify(path.join(here, 'lib', 'PrimeChain.java'))} 2>prime.log`);
  console.log(out.trim());
}

async function addMintingKey() {
  const { rewardShareSeed: key } = JSON.parse(fs.readFileSync(file('minting.json'), 'utf8'));
  const accounts = await getJson('/admin/mintingaccounts').catch(() => []);
  if (Array.isArray(accounts) && accounts.length) return;
  const res = await post('/admin/mintingaccounts', key, { contentType: 'text/plain' });
  console.log(res.text === 'true' ? 'Minting key added.' : `Adding the minting key: ${res.status} ${res.json?.message ?? ''}`);
}

async function stop() {
  const nodePid = readPid('node.pid');
  if (nodePid) {
    process.kill(nodePid, 'SIGTERM');
    for (let i = 0; i < 60 && readPid('node.pid'); i++) await sleep(1_000);
  }
  const bridgePid = readPid('bridge.pid');
  if (bridgePid) {
    try {
      process.kill(-bridgePid, 'SIGTERM');
    } catch {
      try {
        process.kill(bridgePid, 'SIGTERM');
      } catch {
        // gone
      }
    }
  }
  console.log(nodePid ? 'Stopped.' : 'Was not running.');
}

async function status() {
  const info = await getJson('/admin/info').catch(() => null);
  if (!info) {
    console.log('Not running (no answer on the socket).');
    return;
  }
  const [height, peers, known, minting] = await Promise.all([
    getText('/blocks/height'),
    getJson('/peers').catch(() => null),
    getJson('/peers/known').catch(() => null),
    getJson('/admin/mintingaccounts').catch(() => null),
  ]);
  console.log(
    JSON.stringify(
      {
        isTestNet: info.isTestNet,
        buildVersion: info.buildVersion,
        height: Number(height),
        connectedPeers: Array.isArray(peers) ? peers.length : peers,
        knownPeers: Array.isArray(known) ? known.map((p) => p.address) : known,
        mintingAccounts: Array.isArray(minting) ? minting.length : minting,
      },
      null,
      1
    )
  );
}

const command = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  const run = { init, start, stop, status }[command];
  if (!run) {
    console.error('usage: testnet.mjs init | start | status | stop');
    process.exit(2);
  }
  await run();
}
