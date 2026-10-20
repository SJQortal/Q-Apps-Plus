/**
 * Test worlds on the private testnet: MINTER-like groups made the way
 * MINTER was (closed, PCT40, short delays, members and admins added by the
 * owner, then the owner handed to the null account), named accounts, and
 * fresh funded accounts. Dev-only.
 *
 * World state (labels → addresses, group keys → ids) is kept in
 * ~/.qmp-testnet/world.json; fresh keys go into keys.json (mode 600).
 */
import fs from 'node:fs';
import path from 'node:path';
import { accountOf, newSeed } from './keys.mjs';
import { TESTNET_HOME, getJson, height, sleep, waitForConfirmed } from './node.mjs';
import { send } from './tx.mjs';

export const NULL_OWNER = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';
const KEYS = path.join(TESTNET_HOME, 'keys.json');
const WORLD = path.join(TESTNET_HOME, 'world.json');

function readKeysRaw() {
  return JSON.parse(fs.readFileSync(KEYS, 'utf8'));
}

function writeKeysRaw(raw) {
  fs.writeFileSync(KEYS, JSON.stringify(raw, null, 1), { mode: 0o600 });
  fs.chmodSync(KEYS, 0o600);
}

/** Every account by label: minter, faucet, the genesis pool and fresh extras. */
export function accounts() {
  const raw = readKeysRaw();
  const all = [raw.minter, raw.faucet, ...raw.pool, ...(raw.extra ?? [])];
  const map = new Map();
  for (const entry of all) {
    map.set(entry.label, { ...accountOf(Buffer.from(entry.seed, 'hex')), label: entry.label, level: entry.level ?? 0 });
  }
  return map;
}

export function account(label) {
  const found = accounts().get(label);
  if (!found) throw new Error(`No test account "${label}"`);
  return found;
}

/** Public view (no keys): label → { address, publicKey, level }. */
export function publicAccounts() {
  return Object.fromEntries(
    [...accounts()].map(([label, a]) => [label, { address: a.address, publicKey: a.publicKey, level: a.level }])
  );
}

export function readWorld() {
  try {
    return JSON.parse(fs.readFileSync(WORLD, 'utf8'));
  } catch {
    return { groups: {}, names: {} };
  }
}

function writeWorld(world) {
  fs.writeFileSync(WORLD, JSON.stringify(world, null, 1));
}

/** New accounts with fresh keys (level 0), saved before use. */
export function freshAccounts(prefix, count) {
  const raw = readKeysRaw();
  raw.extra = raw.extra ?? [];
  const made = [];
  for (let i = 0; i < count; i++) {
    let label;
    let n = raw.extra.length + 1;
    do label = `${prefix}${String(n++).padStart(3, '0')}`;
    while (raw.extra.some((e) => e.label === label));
    raw.extra.push({ label, level: 0, seed: newSeed().toString('hex') });
    made.push(label);
  }
  writeKeysRaw(raw);
  return made;
}

/** Send many transactions, then wait until every one is in a block. */
export async function sendAll(items) {
  const sent = [];
  for (const item of items) {
    const res = await send(account(item.as), item.type, item.fields, { txGroupId: item.txGroupId ?? 0 });
    sent.push({ ...item, signature: res.signature });
  }
  const confirmed = [];
  for (const item of sent) confirmed.push({ ...item, tx: await waitForConfirmed(item.signature) });
  return confirmed;
}

/** Fund accounts from the faucet (confirmed before it returns). */
export async function fund(labels, amount = '50') {
  if (!labels.length) return [];
  const faucet = account('faucet');
  return sendAll(
    labels.map((label) => ({
      as: faucet.label,
      type: 'PAYMENT',
      fields: { senderPublicKey: faucet.publicKey, recipient: account(label).address, amount },
    }))
  );
}

/** Register a name for each label that has none yet. */
export async function registerNames(entries) {
  const world = readWorld();
  const todo = entries.filter(({ label }) => !world.names[label]);
  const done = await sendAll(
    todo.map(({ label, name }) => ({
      as: label,
      type: 'REGISTER_NAME',
      fields: { registrantPublicKey: account(label).publicKey, name, data: '' },
    }))
  );
  const latest = readWorld();
  for (const item of done) latest.names[item.as] = item.fields.name;
  writeWorld(latest);
  return latest.names;
}

/**
 * A MINTER-like group, made as MINTER was: created closed with PCT40 and the
 * delays (Core ignores delays in a later UPDATE_GROUP), members invited and
 * joined, admins added, then the owner handed to the null account (the old
 * owner stays an admin, as on MINTER).
 */
export async function makeGroup(key, spec) {
  const world = readWorld();
  if (world.groups[key]) return world.groups[key];
  const owner = account(spec.owner);
  const name = `qmp-${key}-${Date.now().toString(36)}`;
  const [created] = await sendAll([
    {
      as: spec.owner,
      type: 'CREATE_GROUP',
      fields: {
        creatorPublicKey: owner.publicKey,
        groupName: name,
        description: `Q-Mintership+ testnet group (${key})`,
        isOpen: false,
        approvalThreshold: spec.threshold ?? 'PCT40',
        minimumBlockDelay: spec.minDelay ?? 5,
        maximumBlockDelay: spec.maxDelay ?? 60,
      },
    },
  ]);
  const groupId = await groupIdByName(spec.owner, name, created);
  const joiners = [...new Set([...(spec.admins ?? []), ...(spec.members ?? [])])].filter((l) => l !== spec.owner);
  await sendAll(
    joiners.flatMap((label) => [
      { as: label, type: 'JOIN_GROUP', fields: { joinerPublicKey: account(label).publicKey, groupId } },
      {
        as: spec.owner,
        type: 'GROUP_INVITE',
        fields: { adminPublicKey: owner.publicKey, groupId, invitee: account(label).address, timeToLive: 0 },
      },
    ])
  );
  const admins = (spec.admins ?? []).filter((l) => l !== spec.owner);
  await sendAll(
    admins.map((label) => ({
      as: spec.owner,
      type: 'ADD_GROUP_ADMIN',
      fields: { ownerPublicKey: owner.publicKey, groupId, member: account(label).address },
    }))
  );
  if (spec.handOver !== false) {
    await sendAll([
      {
        as: spec.owner,
        type: 'UPDATE_GROUP',
        fields: {
          ownerPublicKey: owner.publicKey,
          groupId,
          newOwner: NULL_OWNER,
          newDescription: `Q-Mintership+ testnet group (${key})`,
          newIsOpen: false,
          newApprovalThreshold: spec.threshold ?? 'PCT40',
          newMinimumBlockDelay: spec.minDelay ?? 5,
          newMaximumBlockDelay: spec.maxDelay ?? 60,
        },
      },
    ]);
  }
  const info = await getJson(`/groups/${groupId}`);
  const entry = { groupId, name, createdAt: await height(), spec, owner: info.owner };
  const latest = readWorld();
  latest.groups[key] = entry;
  writeWorld(latest);
  return entry;
}

async function groupIdByName(ownerLabel, name, created) {
  if (typeof created?.tx?.groupId === 'number') return created.tx.groupId;
  for (let i = 0; i < 30; i++) {
    const groups = await getJson(`/groups/owner/${account(ownerLabel).address}`).catch(() => []);
    const found = (groups ?? []).find((g) => g.groupName === name);
    if (found) return found.groupId;
    await sleep(2_000);
  }
  throw new Error(`Group ${name} not found`);
}
