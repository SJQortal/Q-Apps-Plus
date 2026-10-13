/**
 * A mock MINTER group for tests and the screenshot check: one consistent
 * world with a person in every status and a decision in every state. Every
 * address and name here is made up. Plain JS so both vitest (src/test/world.ts)
 * and scripts/screens.mjs (e2e/screens.config.mjs) can use it.
 *
 * answerCore(world, pathname, searchParams) answers the Core GETs the app
 * makes; answerQortal(world, persona, request) answers qortalRequest. Writes
 * are always declined: nothing can be sent from a mock.
 *
 * Extensions: e2e/world-legacy.mjs (old Q-Mintership cards, polls and
 * comments) and e2e/world-activity.mjs (history for Minter Admin Activity)
 * add their own data and endpoints.
 */
import { extendLegacy, answerLegacy } from './world-legacy.mjs';
import { extendActivity, answerActivity } from './world-activity.mjs';

export const NOW = 1_791_830_000_000; // 2026-10-12 ~14:33 UTC
export const TIP = 2_757_500;
export const MS_PER_BLOCK = 72_900;
export const GROUP = 694;
export const NULL_OWNER = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';
const MAX_DELAY = 10_080;

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
/** A made-up but well-formed address (34 base58 chars starting with Q). */
export function fakeAddress(seed) {
  let x = 0;
  for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  let out = 'Q';
  for (let i = 0; i < 33; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out += B58[(x >>> 8) % 58];
  }
  return out;
}
function base58(bytes) {
  const digits = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  return digits
    .reverse()
    .map((d) => B58[d])
    .join('');
}
/** Base58 with leading zero bytes kept as "1" (raw transaction bytes start with zeros). */
function base58Raw(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + base58(bytes.slice(zeros));
}
function base58Bytes(text) {
  let zeros = 0;
  while (text[zeros] === '1') zeros++;
  const bytes = [];
  for (const char of text.slice(zeros)) {
    let carry = B58.indexOf(char);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes.reverse()]);
}
/** The raw bytes Core answers for a CANCEL_GROUP_INVITE (…/raw), group and invitee included. */
function cancelInviteRaw(row, target) {
  const bytes = new Uint8Array(213);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, 30);
  view.setBigInt64(4, BigInt(row.timestamp));
  view.setInt32(12, row.txGroupId);
  bytes.set(base58Bytes(row.reference).slice(0, 64), 16);
  view.setInt32(112, target.groupId);
  bytes.set(base58Bytes(target.invitee), 116);
  view.setBigInt64(141, 1_000_000n);
  bytes.set(base58Bytes(row.signature).slice(0, 64), 149);
  return base58Raw(bytes);
}
/** A made-up key or signature: `bytes` pseudo-random bytes, base58 (32 for keys, 64 for signatures). */
export function fakeKey(seed, bytes = 32) {
  let x = 7;
  for (const c of String(seed)) x = (x * 33 + c.charCodeAt(0)) >>> 0;
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out[i] = (x >>> 16) & 0xff;
  }
  if (out[0] === 0) out[0] = 1; // a leading zero byte would encode as "1"
  return base58(out);
}
const sig = (seed) => fakeKey(`sig:${seed}`, 64);
const pk = (address) => fakeKey(`pk:${address}`, 32);
const blockTime = (height) => NOW - (TIP - height) * MS_PER_BLOCK;

/** The people. `persona` keys are what `?as=` picks in the screenshot check. */
export const PEOPLE = {
  admin: { name: 'Avery Admin', level: 7, blocks: 1_730_799 },
  adminL4: { name: 'Juniper L4', level: 4, blocks: 401_000 },
  nominator: { name: 'Nora Nominator', level: 6, blocks: 980_000 },
  learner: { name: 'Leo Learner', level: 2, blocks: 90_500 },
  newcomer: { name: null, level: 0, blocks: 0 },
  newcomerName: { name: 'Zoë Newcomer', level: 0, blocks: 0 },
  nominatedWaiting: { name: 'Wren Waiting', level: 0, blocks: 0 },
  nominatedSigning: { name: 'bob+builder', level: 0, blocks: 0 },
  approved: { name: 'Ada Approved', level: 0, blocks: 0 },
  kicked: { name: 'Kit Kicked', level: 3, blocks: 210_000 },
  banned: { name: 'Bram Banned', level: 1, blocks: 8_000 },
  left: { name: 'Lou Left', level: 5, blocks: 640_000 },
  lapsed: { name: 'Lapsed Person With A Very Long Name That Wraps On Phones', level: 0, blocks: 0 },
  expired: { name: 'Ünïcode Ñame', level: 0, blocks: 0 },
  urgent: { name: 'Uma Urgent', level: 0, blocks: 0 },
  met: { name: 'Mia Met', level: 0, blocks: 0 },
  late: { name: 'Lars Late', level: 0, blocks: 0 },
  early: { name: 'Eli Early', level: 0, blocks: 0 },
  kickTarget: { name: 'Kai Target', level: 4, blocks: 380_000 },
  banTarget: { name: 'Ben Target', level: 2, blocks: 75_000 },
  promote: { name: 'Pia Promote', level: 8, blocks: 2_400_000 },
  demote: { name: 'Dex Demote', level: 7, blocks: 1_600_000 },
  liftBan: { name: null, level: 1, blocks: 9_000 },
  recentlyJoined: { name: 'Remy Recent', level: 0, blocks: 1_200 },
  // Not in MINTER; addReady() gives them a join request ("ready to mint").
  ready: { name: 'Rae Ready', level: 0, blocks: 0 },
};
export const ADDR = Object.fromEntries(Object.keys(PEOPLE).map((key) => [key, fakeAddress(key)]));

function buildWorld() {
  const accounts = new Map();
  const names = new Map(); // name -> address
  const addAccount = (address, { name = null, level = 0, blocks = 0 } = {}) => {
    accounts.set(address, {
      address,
      name,
      level,
      blocks,
      publicKey: pk(address),
      reference: sig(`ref:${address}`),
      balance: level > 0 || name ? 12.5 : 0,
    });
    if (name) names.set(name, address);
  };
  for (const [key, p] of Object.entries(PEOPLE)) addAccount(ADDR[key], p);
  accounts.get(ADDR.newcomer).balance = 0; // shows the "you need 0.01 QORT" help
  addAccount(NULL_OWNER, { name: null, level: 0, blocks: 0 });

  // 16 more admins: with admin, adminL4, demote and the null owner, 20 admin rows.
  const extraAdmins = Array.from({ length: 16 }, (_, i) => {
    const address = fakeAddress(`admin-${i}`);
    addAccount(address, {
      name: `Admin ${String.fromCharCode(65 + i)}${i === 3 ? ' ΑΩ' : ''}`,
      level: 6 + (i % 3),
      blocks: 1_000_000 + i * 50_000,
    });
    return address;
  });
  const admins = [ADDR.admin, ADDR.adminL4, ADDR.demote, ...extraAdmins, NULL_OWNER]; // 20 rows
  const plainMembers = Array.from({ length: 40 }, (_, i) => {
    const address = fakeAddress(`member-${i}`);
    const level = [0, 1, 2, 3, 4, 5, 6, 6, 7, 7, 8][i % 11];
    addAccount(address, {
      name: `Member ${i + 1}`,
      level,
      blocks: [
        0, 8_000, 80_000, 210_000, 380_000, 640_000, 1_000_000, 1_100_000, 1_600_000, 1_700_000,
        2_300_000,
      ][i % 11],
    });
    return address;
  });
  const members = [
    ...admins,
    ADDR.nominator,
    ADDR.learner,
    ADDR.kickTarget,
    ADDR.promote,
    ADDR.recentlyJoined,
    ...plainMembers,
  ];
  const memberJoined = (i) => NOW - (i + 1) * 86_400_000 * 3;

  // ---- pending MINTER decisions -------------------------------------------
  const pending = [];
  const approvals = [];
  const unconfirmedApprovals = [];
  const tx = (type, h, extra) => ({
    type,
    timestamp: h === null ? NOW - 60_000 : blockTime(h) - 20_000,
    reference: sig(`r:${type}:${h}:${JSON.stringify(extra)}`),
    fee: '0.01000000',
    signature: sig(`${type}:${h}:${JSON.stringify(extra)}`),
    txGroupId: GROUP,
    ...(h === null ? {} : { blockHeight: h }),
    approvalStatus: 'PENDING',
    ...extra,
  });
  const sign = (pendingTx, signerAddress, h, confirmed = true, approval = true) => {
    const row = {
      type: 'GROUP_APPROVAL',
      timestamp: confirmed ? blockTime(h) - 10_000 : NOW - 30_000,
      reference: sig(`ar:${signerAddress}:${pendingTx.signature}`),
      fee: '0.01000000',
      signature: sig(`a:${signerAddress}:${pendingTx.signature}:${h}`),
      txGroupId: 0,
      ...(confirmed ? { blockHeight: h } : {}),
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: signerAddress,
      adminPublicKey: pk(signerAddress),
      pendingSignature: pendingTx.signature,
      approval,
    };
    (confirmed ? approvals : unconfirmedApprovals).push(row);
  };
  const invite = (subjectKey, h, by, n, opts = {}) => {
    const t = tx('GROUP_INVITE', h, {
      creatorAddress: by,
      adminPublicKey: pk(by),
      groupId: GROUP,
      invitee: ADDR[subjectKey],
      timeToLive: 864_000,
    });
    pending.push(t);
    const signers = [by, ...extraAdmins.filter((a) => a !== by)].slice(0, n);
    signers.forEach((s, i) => sign(t, s, h + 1 + i * 37));
    if (opts.plusUnconfirmed) sign(t, opts.plusUnconfirmed, null, false);
    return t;
  };

  // Signing: 5 of 8, the admin persona hasn't signed; one more confirming.
  invite('nominatedSigning', TIP - 3_000, extraAdmins[0], 5, { plusUnconfirmed: extraAdmins[9] });
  // Urgent: 79 blocks of signing left, 7 of 8, the admin persona signed it.
  const urgent = invite('urgent', TIP - 10_000, extraAdmins[1], 6);
  sign(urgent, ADDR.admin, TIP - 9_000);
  // Threshold met: 8 of 8, decides in the next block.
  invite('met', TIP - 4_000, extraAdmins[2], 8);
  // Too late: next block is its last decision block.
  invite('late', TIP - (MAX_DELAY - 1), extraAdmins[3], 3);
  // Early: confirmed 2 blocks ago, only the creator signed.
  invite('early', TIP - 2, ADDR.admin, 1);
  // Kick, 2 of 8 (reason given).
  const kick = tx('GROUP_KICK', TIP - 1_200, {
    creatorAddress: extraAdmins[4],
    adminPublicKey: pk(extraAdmins[4]),
    groupId: GROUP,
    member: ADDR.kickTarget,
    reason: 'Not minting for 6 months',
  });
  pending.push(kick);
  [extraAdmins[4], extraAdmins[5]].forEach((s, i) => sign(kick, s, TIP - 1_100 + i));
  // Ban, permanent, 1 of 8.
  const ban = tx('GROUP_BAN', TIP - 5_000, {
    creatorAddress: extraAdmins[6],
    adminPublicKey: pk(extraAdmins[6]),
    groupId: GROUP,
    offender: ADDR.banTarget,
    reason: 'Banned by Minter Admins',
    timeToLive: 0,
  });
  pending.push(ban);
  sign(ban, extraAdmins[6], TIP - 4_990);
  // Add admin, 5 of 8.
  const add = tx('ADD_GROUP_ADMIN', TIP - 7_425, {
    creatorAddress: ADDR.promote,
    ownerPublicKey: pk(ADDR.promote),
    groupId: GROUP,
    member: ADDR.promote,
  });
  pending.push(add);
  extraAdmins.slice(7, 12).forEach((s, i) => sign(add, s, TIP - 7_300 + i * 100));
  // Remove admin, still unconfirmed (no clock yet).
  pending.push(
    tx('REMOVE_GROUP_ADMIN', null, {
      creatorAddress: extraAdmins[12],
      ownerPublicKey: pk(extraAdmins[12]),
      groupId: GROUP,
      admin: ADDR.demote,
    })
  );
  // Lift a ban, 3 of 8.
  const lift = tx('CANCEL_GROUP_BAN', TIP - 600, {
    creatorAddress: extraAdmins[13],
    adminPublicKey: pk(extraAdmins[13]),
    groupId: GROUP,
    member: ADDR.liftBan,
  });
  pending.push(lift);
  extraAdmins.slice(13, 16).forEach((s, i) => sign(lift, s, TIP - 590 + i));
  // Cancel an approved invite: Core's answer leaves out groupId and invitee
  // (the raw bytes have them: cancelTargets).
  const cancel = tx('CANCEL_GROUP_INVITE', TIP - 300, { creatorAddress: extraAdmins[14] });
  pending.push(cancel);
  const cancelTargets = new Map([
    [cancel.signature, { groupId: GROUP, invitee: fakeAddress('stale-1') }],
  ]);
  // A MINTER transaction on an unusual approval route (txGroupId neither 694 nor 0).
  const unusual = tx('ADD_GROUP_ADMIN', TIP - 50, {
    creatorAddress: ADDR.learner,
    ownerPublicKey: pk(ADDR.learner),
    groupId: GROUP,
    member: ADDR.learner,
    txGroupId: 4242,
  });

  // ---- decided history ----------------------------------------------------
  const decided = [];
  const decidedTx = (type, h, approvalHeight, status, extra) => ({
    ...tx(type, h, extra),
    approvalStatus: status,
    ...(approvalHeight ? { approvalHeight } : {}),
  });
  // Old approved invites (people who were members once).
  for (const key of ['kicked', 'banned', 'left', 'admin', 'nominator', 'learner']) {
    decided.push(
      decidedTx('GROUP_INVITE', 2_300_000, 2_301_400, 'APPROVED', {
        creatorAddress: extraAdmins[0],
        adminPublicKey: pk(extraAdmins[0]),
        groupId: GROUP,
        invitee: ADDR[key],
        timeToLive: 864_000,
      })
    );
  }
  decided.push(
    decidedTx('GROUP_KICK', 2_700_000, 2_701_900, 'APPROVED', {
      creatorAddress: extraAdmins[1],
      adminPublicKey: pk(extraAdmins[1]),
      groupId: GROUP,
      member: ADDR.kicked,
      reason: 'Kicked by Minter Admins',
    })
  );
  decided.push(
    decidedTx('GROUP_BAN', 2_683_605, 2_684_556, 'APPROVED', {
      creatorAddress: extraAdmins[2],
      adminPublicKey: pk(extraAdmins[2]),
      groupId: GROUP,
      offender: ADDR.banned,
      reason: 'Banned by Minter Admins',
      timeToLive: 0,
    })
  );
  decided.push({
    ...tx('LEAVE_GROUP', 2_740_000, {
      creatorAddress: ADDR.left,
      leaverPublicKey: pk(ADDR.left),
      groupId: GROUP,
    }),
    txGroupId: 0,
    approvalStatus: 'NOT_REQUIRED',
  });
  // A recent expired round (re-nomination possible) and a recent approval.
  // Core records an expired transaction's approvalHeight as h + 10,081.
  decided.push(
    decidedTx('GROUP_INVITE', TIP - 15_000, TIP - 15_000 + 10_081, 'EXPIRED', {
      creatorAddress: extraAdmins[5],
      adminPublicKey: pk(extraAdmins[5]),
      groupId: GROUP,
      invitee: ADDR.expired,
      timeToLive: 864_000,
    })
  );
  decided.push(
    decidedTx('GROUP_INVITE', TIP - 6_000, TIP - 5_200, 'APPROVED', {
      creatorAddress: extraAdmins[6],
      adminPublicKey: pk(extraAdmins[6]),
      groupId: GROUP,
      invitee: ADDR.recentlyJoined,
      timeToLive: 864_000,
    })
  );
  decided.push(
    decidedTx('GROUP_INVITE', TIP - 9_000, TIP - 8_100, 'APPROVED', {
      creatorAddress: extraAdmins[3],
      adminPublicKey: pk(extraAdmins[3]),
      groupId: GROUP,
      invitee: ADDR.approved,
      timeToLive: 864_000,
    })
  );
  // The admin persona proposed a few invites for others.
  for (let i = 0; i < 3; i++) {
    decided.push(
      decidedTx('GROUP_INVITE', 2_600_000 + i * 1000, 2_601_000 + i * 1000, 'APPROVED', {
        creatorAddress: ADDR.admin,
        adminPublicKey: pk(ADDR.admin),
        groupId: GROUP,
        invitee: plainMembers[i],
        timeToLive: 864_000,
      })
    );
  }

  const joinRequests = [
    ADDR.nominatedSigning,
    ADDR.urgent,
    ADDR.met,
    fakeAddress('jr-1'),
    fakeAddress('jr-2'),
    fakeAddress('jr-3'),
  ].map((joiner) => ({ groupId: GROUP, joiner }));
  const storedInvites = [
    {
      groupId: GROUP,
      inviter: extraAdmins[3],
      invitee: ADDR.approved,
      expiry: blockTime(TIP - 9_000) + 864_000_000,
    },
    {
      groupId: GROUP,
      inviter: extraAdmins[1],
      invitee: fakeAddress('stale-1'),
      expiry: 1_738_933_583_118,
    },
    {
      groupId: GROUP,
      inviter: extraAdmins[2],
      invitee: fakeAddress('stale-2'),
      expiry: 1_760_608_800_398,
    },
    {
      groupId: GROUP,
      inviter: extraAdmins[4],
      invitee: fakeAddress('stale-3'),
      expiry: 1_765_000_000_000,
    },
    {
      groupId: GROUP,
      inviter: extraAdmins[2],
      invitee: plainMembers[5],
      expiry: 1_770_000_000_000,
    },
  ];
  const bans = [
    {
      groupId: GROUP,
      offender: ADDR.banned,
      admin: extraAdmins[2],
      banned: blockTime(2_684_556),
      reason: 'Banned by Minter Admins',
    },
    {
      groupId: GROUP,
      offender: ADDR.liftBan,
      admin: extraAdmins[3],
      banned: NOW - 40 * 86_400_000,
      reason: 'Spam',
    },
    {
      groupId: GROUP,
      offender: fakeAddress('old-ban'),
      admin: extraAdmins[3],
      banned: NOW - 90 * 86_400_000,
      reason: 'Temporary',
      expiry: NOW - 60 * 86_400_000,
    },
  ];

  // ---- QDN nomination and support records ---------------------------------
  const records = []; // { name, identifier, created, updated?, body }
  const rec = (publisherKey, nomineeKey, ageMs, body = {}) =>
    records.push({
      name: PEOPLE[publisherKey]?.name ?? publisherKey,
      identifier: `qmp-nomination-${ADDR[nomineeKey]}`,
      created: NOW - ageMs,
      body: {
        v: 1,
        nomineeAddress: ADDR[nomineeKey],
        nomineeName: PEOPLE[nomineeKey].name ?? undefined,
        reason:
          body.reason ??
          `I've worked with ${PEOPLE[nomineeKey].name ?? 'them'} for months: reliable node, helps newcomers in Q-Chat, and runs a public node for the community.`,
        links: body.links ?? ['qortal://APP/Q-Tube/channel/Example', 'qortal://WEBSITE/Example'],
        createdHeight: TIP - Math.round(ageMs / MS_PER_BLOCK),
        created: NOW - ageMs,
      },
    });
  const support = (publisherKey, nomineeKey, ageMs, note) =>
    records.push({
      name: PEOPLE[publisherKey]?.name ?? publisherKey,
      identifier: `qmp-support-${ADDR[nomineeKey]}`,
      created: NOW - ageMs,
      body: { v: 1, nomineeAddress: ADDR[nomineeKey], ...(note ? { note } : {}) },
    });
  rec('nominator', 'nominatedWaiting', 2 * 86_400_000);
  support(
    'adminL4',
    'nominatedWaiting',
    86_400_000,
    'Seen them help in the minting chat every week.'
  );
  support('learner', 'nominatedWaiting', 3_600_000, 'Not eligible yet: ignored.');
  rec('nominator', 'nominatedSigning', 4 * 86_400_000, { links: [] });
  rec('nominator', 'urgent', 9 * 86_400_000);
  rec('learner', 'newcomerName', 86_400_000); // ineligible publisher: ignored
  rec('nominator', 'lapsed', 10 * 86_400_000);
  rec('nominator', 'expired', 20 * 86_400_000);
  records.push({
    name: PEOPLE.nominator.name,
    identifier: 'qmp-nomination-not-an-address',
    created: NOW - 1000,
    body: { v: 1 },
  });

  const world = {
    accounts,
    names,
    admins,
    members,
    memberJoined,
    pending,
    unusual,
    cancelTargets,
    approvals,
    unconfirmedApprovals,
    decided,
    joinRequests,
    storedInvites,
    bans,
    records,
    group: {
      groupId: GROUP,
      owner: NULL_OWNER,
      groupName: 'MINTER',
      description: 'The MINTER Group of Qortal',
      created: 1_726_506_730_054,
      updated: 1_737_566_770_294,
      isOpen: false,
      approvalThreshold: 'PCT40',
      minimumBlockDelay: 5,
      maximumBlockDelay: MAX_DELAY,
      memberCount: members.length,
    },
  };
  extendLegacy(world);
  extendActivity(world);
  return world;
}

export function createWorld() {
  return buildWorld();
}

/**
 * Add three pending transactions that wait for MINTER's admins but aren't
 * MINTER group changes: another group's invite, a name registration and
 * another group's invite cancellation. Returns their signatures.
 */
export function addOtherPending(world) {
  const base = {
    fee: '0.01000000',
    txGroupId: GROUP,
    approvalStatus: 'PENDING',
    creatorAddress: ADDR.learner,
    reference: sig('r:other-pending'),
  };
  const rows = [
    {
      ...base,
      type: 'GROUP_INVITE',
      groupId: 4242,
      invitee: ADDR.nominatedWaiting,
      timeToLive: 864_000,
    },
    { ...base, type: 'REGISTER_NAME', name: 'example' },
    { ...base, type: 'CANCEL_GROUP_INVITE' },
  ].map((row, i) => ({
    ...row,
    timestamp: blockTime(TIP - 8 + i) - 20_000,
    signature: sig(`other-pending-${i}`),
    blockHeight: TIP - 8 + i,
  }));
  world.pending.push(...rows);
  world.cancelTargets.set(rows[2].signature, { groupId: 4242, invitee: ADDR.nominatedWaiting });
  return rows.map((row) => row.signature);
}

/** Give the `ready` persona a join request, so they have shown they're ready to mint. */
export function addReady(world) {
  world.joinRequests.push({ groupId: GROUP, joiner: ADDR.ready });
}

// ---- answering Core --------------------------------------------------------
const page = (list, sp) => {
  let rows = list;
  if (sp.get('reverse') === 'true') rows = [...rows].reverse();
  const offset = Number(sp.get('offset') || 0);
  const limit = Number(sp.get('limit') || 20);
  if (!limit) throw new Error('limit=0 is not allowed in this app');
  return rows.slice(offset, offset + limit);
};

function subjectOf(t) {
  return t.invitee ?? t.member ?? t.offender ?? t.admin ?? null;
}

function allTxs(world) {
  return [
    ...world.decided,
    ...world.pending.filter((t) => typeof t.blockHeight === 'number'),
    ...world.approvals,
  ];
}

function memberRow(world, address, i) {
  const a = world.accounts.get(address);
  return {
    member: address,
    joined: world.memberJoined(i),
    ...(a?.name ? { primaryName: a.name } : {}),
  };
}

/**
 * Answer a Core GET. Returns { status, body, text } or undefined when the
 * path is not part of the world (the caller answers 404).
 */
export function answerCore(world, pathname, sp) {
  const json = (body, status = 200) => ({ status, body });
  const text = (value, status = 200) => ({ status, text: String(value) });
  const p = pathname;
  let m;

  const ext = answerLegacy(world, p, sp) ?? answerActivity(world, p, sp);
  if (ext) return ext;

  if (p === '/blocks/height') return text(TIP);
  if (p === '/blocks/last')
    return json({ height: TIP, timestamp: NOW, signature: sig('tip'), onlineAccountsCount: 4100 });
  if ((m = p.match(/^\/blocks\/byheight\/(\d+)$/)))
    return json({ height: Number(m[1]), timestamp: blockTime(Number(m[1])) });
  if ((m = p.match(/^\/blocks\/timestamp\/(\d+)$/))) {
    const height = Math.max(1, TIP - Math.ceil((NOW - Number(m[1])) / MS_PER_BLOCK));
    return json({ height, timestamp: blockTime(height) });
  }
  if (p === '/transactions/unitfee') return text(1_000_000);

  if (p === `/groups/${GROUP}`) return json(world.group);
  if (p === `/groups/members/${GROUP}`) {
    if (sp.get('onlyAdmins') === 'true') {
      const rows = world.admins.map((a, i) => ({ ...memberRow(world, a, i), isAdmin: true }));
      return json({
        memberCount: world.members.length,
        adminCount: world.admins.length,
        members: page(rows, sp),
      });
    }
    const rows = world.members.map((a, i) => memberRow(world, a, i));
    return json({
      memberCount: world.members.length,
      adminCount: world.admins.length,
      members: page(rows, sp),
    });
  }
  if ((m = p.match(/^\/groups\/member\/(Q\w+)$/))) {
    const address = m[1];
    if (!world.members.includes(address))
      return json([{ groupId: 2, groupName: 'Some other group', owner: NULL_OWNER }]);
    return json([{ ...world.group, ...(world.admins.includes(address) ? { isAdmin: true } : {}) }]);
  }
  if (p === `/groups/joinrequests/${GROUP}`) return json(world.joinRequests);
  if ((m = p.match(/^\/groups\/joinrequests\/address\/(Q\w+)$/)))
    return json(world.joinRequests.filter((r) => r.joiner === m[1]));
  if (p === `/groups/invites/group/${GROUP}`) return json(world.storedInvites);
  if ((m = p.match(/^\/groups\/invites\/(Q\w+)$/)))
    return json(world.storedInvites.filter((r) => r.invitee === m[1]));
  if (p === `/groups/bans/${GROUP}`) return json(world.bans);

  if ((m = p.match(/^\/addresses\/balance\/(Q\w+)$/)))
    return text(world.accounts.get(m[1])?.balance ?? 0);
  if ((m = p.match(/^\/addresses\/lastreference\/(Q\w+)$/)))
    return text(world.accounts.get(m[1])?.reference ?? '');
  if ((m = p.match(/^\/addresses\/(Q\w+)$/))) {
    const a = world.accounts.get(m[1]);
    if (!a)
      return json({
        address: m[1],
        level: 0,
        blocksMinted: 0,
        blocksMintedAdjustment: 0,
        blocksMintedPenalty: 0,
      });
    return json({
      address: a.address,
      reference: a.reference,
      publicKey: a.publicKey,
      defaultGroupId: 0,
      flags: 0,
      level: a.level,
      blocksMinted: a.blocks,
      blocksMintedAdjustment: 0,
      blocksMintedPenalty: 0,
    });
  }
  if ((m = p.match(/^\/names\/primary\/(Q\w+)$/))) {
    const a = world.accounts.get(m[1]);
    return json(a?.name ? { name: a.name, owner: a.address } : { owner: m[1] });
  }
  if ((m = p.match(/^\/names\/(.+)$/))) {
    const name = decodeURIComponent(m[1]);
    const owner = world.names.get(name);
    return owner ? json({ name, owner }) : json({ error: 401, message: 'name unknown' }, 404);
  }

  if (p === '/transactions/pending') {
    const groupId = sp.get('txGroupId');
    const rows = groupId
      ? world.pending.filter((t) => String(t.txGroupId) === groupId)
      : [...world.pending, world.unusual];
    return json(page(rows, sp));
  }
  if (p === '/transactions/unconfirmed') {
    const types = sp.getAll('txType');
    const creator = sp.get('creator');
    let rows = [
      ...world.unconfirmedApprovals,
      ...world.pending.filter((t) => typeof t.blockHeight !== 'number'),
    ];
    if (types.length) rows = rows.filter((t) => types.includes(t.type));
    if (creator)
      rows = rows.filter(
        (t) => (t.adminPublicKey ?? t.ownerPublicKey ?? t.joinerPublicKey) === creator
      );
    return json(page(rows, sp));
  }
  if ((m = p.match(/^\/transactions\/signature\/(\w+)\/raw$/))) {
    const row = [...world.pending, ...world.decided].find((t) => t.signature === m[1]);
    const target = world.cancelTargets.get(m[1]);
    if (!row || !target) return json({ error: 1, message: 'transaction unknown' }, 404);
    return text(cancelInviteRaw(row, target));
  }
  if ((m = p.match(/^\/transactions\/signature\/(\w+)$/))) {
    const found = [...world.pending, world.unusual, ...world.decided, ...world.approvals].find(
      (t) => t.signature === m[1]
    );
    return found ? json(found) : json({ error: 1, message: 'transaction unknown' }, 404);
  }
  if (p === '/transactions/search') {
    const types = sp.getAll('txType');
    if (!types.length && !sp.get('address') && Number(sp.get('limit') || 0) > 20)
      return json({ error: 'txType, address or limit ≤ 20 needed' }, 400);
    let rows = allTxs(world);
    if (types.length) rows = rows.filter((t) => types.includes(t.type));
    const address = sp.get('address');
    if (address)
      rows = rows.filter((t) => t.creatorAddress === address || subjectOf(t) === address);
    const txGroupId = sp.get('txGroupId');
    if (txGroupId) rows = rows.filter((t) => String(t.txGroupId) === txGroupId);
    const start = Number(sp.get('startBlock') || 0);
    const limitBlocks = Number(sp.get('blockLimit') || 0);
    if (start)
      rows = rows.filter(
        (t) =>
          (t.blockHeight ?? 0) >= start && (!limitBlocks || t.blockHeight < start + limitBlocks)
      );
    rows = [...rows].sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0));
    return json(page(rows, sp));
  }

  if (p === '/arbitrary/resources/searchsimple') {
    const service = sp.get('service');
    const ident = sp.get('identifier') || '';
    let rows = world.records
      .filter(() => service === 'JSON')
      .filter((r) =>
        sp.get('prefix') === 'true' ? r.identifier.startsWith(ident) : r.identifier === ident
      )
      .map((r) => ({
        name: r.name,
        service: 'JSON',
        identifier: r.identifier,
        // A republished resource has a new latest signature, as on a node.
        latestSignature: sig(`qdn:${r.name}:${r.identifier}${r.updated ? `:${r.updated}` : ''}`),
        size: 300,
        created: r.created,
        ...(r.updated ? { updated: r.updated } : {}),
      }));
    const names = sp.getAll('name');
    if (names.length) rows = rows.filter((r) => names.includes(r.name));
    // Core: `after` keeps resources created after that time.
    const after = Number(sp.get('after') || 0);
    if (after) rows = rows.filter((r) => r.created > after);
    rows.sort((a, b) => a.created - b.created);
    return json(page(rows, sp));
  }
  if ((m = p.match(/^\/arbitrary\/JSON\/([^/]+)\/([^/]+)$/))) {
    const name = decodeURIComponent(m[1]);
    const identifier = decodeURIComponent(m[2]);
    const r = world.records.find((x) => x.name === name && x.identifier === identifier);
    return r ? json(r.body) : json({ error: 1401, message: 'not found' }, 404);
  }
  return undefined;
}

// ---- answering qortalRequest ----------------------------------------------
/** The account each persona signs in as. `signedOut` declines; `outside` has no Hub at all. */
export function personaAddress(persona) {
  return ADDR[persona] ?? ADDR.admin;
}

export function answerQortal(world, persona, request) {
  switch (request.action) {
    case 'GET_USER_ACCOUNT': {
      if (persona === 'signedOut')
        throw { error: 'User declined request', message: 'User declined request' };
      const address = personaAddress(persona);
      return { address, publicKey: world.accounts.get(address)?.publicKey ?? pk(address) };
    }
    case 'GET_PRIMARY_NAME':
      return world.accounts.get(request.address)?.name ?? '';
    case 'INVITE_TO_GROUP':
    case 'CANCEL_GROUP_INVITE':
    case 'KICK_FROM_GROUP':
    case 'BAN_FROM_GROUP':
    case 'CANCEL_GROUP_BAN':
    case 'ADD_GROUP_ADMIN':
    case 'REMOVE_GROUP_ADMIN':
    case 'JOIN_GROUP':
    case 'SIGN_TRANSACTION':
    case 'PUBLISH_QDN_RESOURCE':
    case 'PUBLISH_MULTIPLE_QDN_RESOURCES':
      throw { error: 'User declined request', message: 'User declined request' };
    default:
      return null;
  }
}

// ---- a moving target (Decisions → admin changes and the target) ------------
/**
 * The target moves: two Minter Admins were removed lately (23 admin rows
 * became 21, so 10 signatures needed became 9), a new admin row is added so
 * the count is 21, and the waiting removal of Dex Demote is confirmed with
 * three signatures. If it passes, the target drops to 8 and Mia Met's invite
 * (8 signatures) applies at once. Kai Target's removal has 9 signatures:
 * enough now, not at the old target. Returns what tests need.
 */
export function addTargetShift(world) {
  const extra = Array.from({ length: 16 }, (_, i) => fakeAddress(`admin-${i}`));
  const person = (seed, name, level) => {
    const address = fakeAddress(seed);
    world.accounts.set(address, {
      address,
      name,
      level,
      blocks: 1_000_000,
      publicKey: pk(address),
      reference: sig(`ref:${address}`),
      balance: 5,
    });
    world.names.set(name, address);
    if (!world.members.includes(address)) world.members.push(address);
    return address;
  };
  // A 21st admin row: 9 signatures needed.
  const newAdmin = person('admin-16', 'Admin Q', 7);
  world.admins.splice(world.admins.length - 1, 0, newAdmin);

  // Two removals approved lately: the count went 23 → 22 → 21.
  const outgoing = [
    person('outgoing-1', 'Otto Outgoing', 6),
    person('outgoing-2', 'Orla Outgoing', 6),
  ];
  const removed = outgoing.map((address, i) => {
    const h = TIP - 2_000 + i * 500;
    const row = {
      type: 'REMOVE_GROUP_ADMIN',
      timestamp: blockTime(h) - 20_000,
      reference: sig(`r:shift:${address}`),
      fee: '0.01000000',
      signature: sig(`shift:remove:${address}`),
      txGroupId: GROUP,
      blockHeight: h,
      approvalStatus: 'APPROVED',
      approvalHeight: TIP - 40 + i * 20,
      creatorAddress: extra[0],
      ownerPublicKey: pk(extra[0]),
      groupId: GROUP,
      admin: address,
    };
    world.decided.push(row);
    return row;
  });

  const approve = (pendingTx, who, h) =>
    world.approvals.push({
      type: 'GROUP_APPROVAL',
      timestamp: blockTime(h) - 10_000,
      reference: sig(`ar:shift:${who}:${pendingTx.signature}`),
      fee: '0.01000000',
      signature: sig(`a:shift:${who}:${pendingTx.signature}:${h}`),
      txGroupId: 0,
      blockHeight: h,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: who,
      adminPublicKey: pk(who),
      pendingSignature: pendingTx.signature,
      approval: true,
    });

  // The waiting removal of Dex Demote, now in a block, with three signatures.
  const demote = world.pending.find(
    (t) => t.type === 'REMOVE_GROUP_ADMIN' && t.admin === ADDR.demote
  );
  demote.blockHeight = TIP - 900;
  demote.timestamp = blockTime(TIP - 900) - 20_000;
  [extra[12], extra[13], extra[14]].forEach((who, i) => approve(demote, who, TIP - 890 + i));

  // Kai Target's removal: 9 signatures (enough at 21 rows, not at 23).
  const kick = world.pending.find((t) => t.type === 'GROUP_KICK' && t.member === ADDR.kickTarget);
  [extra[0], extra[1], extra[2], extra[3], extra[6], extra[7], extra[8]].forEach((who, i) =>
    approve(kick, who, TIP - 1_000 + i)
  );

  const met = world.pending.find((t) => t.type === 'GROUP_INVITE' && t.invitee === ADDR.met);
  return {
    /** What this device saw before the two removals (for the "target changed" note). */
    seenBefore: { adminCount: 23, needed: 10, height: TIP - 100 },
    demote: demote.signature,
    kick: kick.signature,
    met: met.signature,
    removed: removed.map((row) => row.signature),
    outgoing,
  };
}
// ---- rejections (Reject, Withdraw my signature) ------------------------------
/**
 * Add rejections to the world: on the kick, one admin withdrew their
 * signature and another rejected it (1 of 8 signatures left, 2 rejections);
 * on the ban, a rejection is still on its way; the lifted ban has 8
 * rejections (enough to end it); and an invite in the history was rejected.
 * Returns the signatures involved.
 */
export function addRejections(world) {
  const extra = (i) => fakeAddress(`admin-${i}`);
  const answer = (pendingTx, who, h, approval, seed) => {
    const row = {
      type: 'GROUP_APPROVAL',
      timestamp: h === null ? NOW - 20_000 : blockTime(h) - 5_000,
      reference: sig(`rr:${seed}`),
      fee: '0.01000000',
      signature: sig(`reject:${seed}`),
      txGroupId: 0,
      ...(h === null ? {} : { blockHeight: h }),
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: who,
      adminPublicKey: pk(who),
      pendingSignature: pendingTx.signature,
      approval,
    };
    (h === null ? world.unconfirmedApprovals : world.approvals).push(row);
    return row;
  };
  const kick = world.pending.find((t) => t.type === 'GROUP_KICK');
  const ban = world.pending.find((t) => t.type === 'GROUP_BAN');
  const lift = world.pending.find((t) => t.type === 'CANCEL_GROUP_BAN');
  // Kick: admin-5 signed at TIP - 1,099, then withdrew; admin-8 rejected.
  answer(kick, extra(5), TIP - 900, false, 'kick-5');
  answer(kick, extra(8), TIP - 800, false, 'kick-8');
  // Ban: a rejection on its way.
  answer(ban, extra(10), null, false, 'ban-10');
  // Lift a ban: 8 rejections, the target.
  [0, 1, 2, 3, 6, 7, 8, 9].forEach((i, n) =>
    answer(lift, extra(i), TIP - 500 + n, false, `lift-${i}`)
  );
  // A rejected invite in the history.
  const invitee = fakeAddress('rejected-1');
  const h = TIP - 4_500;
  const rejected = {
    type: 'GROUP_INVITE',
    timestamp: blockTime(h) - 20_000,
    reference: sig('r:rejected-invite'),
    fee: '0.01000000',
    signature: sig('rejected-invite'),
    txGroupId: GROUP,
    blockHeight: h,
    approvalStatus: 'REJECTED',
    approvalHeight: h + 400,
    creatorAddress: extra(7),
    adminPublicKey: pk(extra(7)),
    groupId: GROUP,
    invitee,
    timeToLive: 864_000,
  };
  world.decided.push(rejected);
  return {
    kick: kick.signature,
    ban: ban.signature,
    lift: lift.signature,
    rejectedInvite: rejected.signature,
    invitee,
  };
}

// ---- Considering (a Minter Admin's "not sure yet", on QDN) -------------------
/**
 * Add Considering records: on bob+builder's invite Admin K (with a note) and
 * Admin L are considering, Admin N cleared theirs, and Admin B's record is
 * older than their signature (so it no longer shows); Admin M is considering
 * Wren Waiting's nomination; and three records that are ignored (a member
 * who isn't an admin, a record from long ago, a body that doesn't match its
 * identifier). Returns the keys used.
 */
export function addConsidering(world) {
  const extra = (i) => fakeAddress(`admin-${i}`);
  const nameOf = (address) => world.accounts.get(address)?.name;
  const invite = world.pending.find((t) => t.invitee === ADDR.nominatedSigning);
  const decisionKey = invite.signature.slice(0, 40);
  const add = (name, key, body, ageMs, updatedAgeMs) =>
    world.records.push({
      name,
      identifier: `qmp-considering-${key}`,
      created: NOW - ageMs,
      ...(updatedAgeMs !== undefined ? { updated: NOW - updatedAgeMs } : {}),
      body: { v: 1, ...body },
    });
  const onInvite = { pendingSignature: invite.signature };
  add(
    nameOf(extra(10)),
    decisionKey,
    { ...onInvite, note: 'Waiting to hear back from them in Q-Chat about their node.' },
    3 * 3_600_000
  );
  add(nameOf(extra(11)), decisionKey, onInvite, 2 * 3_600_000);
  add(nameOf(extra(13)), decisionKey, { ...onInvite, cleared: true }, 5 * 3_600_000, 3_600_000);
  // Admin B signed at block h + 38, after this record (h + 10): their signature replaces it.
  add(nameOf(extra(1)), decisionKey, onInvite, NOW - blockTime(TIP - 2_990));
  add(
    nameOf(extra(12)),
    ADDR.nominatedWaiting,
    { nomineeAddress: ADDR.nominatedWaiting, note: 'Checking their minting history first.' },
    12 * 3_600_000
  );
  // Ignored: not a Minter Admin; long ago; key and body disagree.
  add(PEOPLE.nominator.name, decisionKey, onInvite, 3_600_000);
  add(nameOf(extra(14)), ADDR.lapsed, { nomineeAddress: ADDR.lapsed }, 40 * 86_400_000);
  add(nameOf(extra(15)), ADDR.urgent, { nomineeAddress: ADDR.nominatedWaiting }, 3_600_000);
  return { decisionKey, inviteSignature: invite.signature, waitingKey: ADDR.nominatedWaiting };
}
// ---- shareable links (decision and nomination pages) ------------------------
/**
 * Signatures on a decided decision, for its own page (/decisions/<sig>):
 * eight Minter Admins signed Nora Nominator's old approved invite, long
 * before the windows Activity reads, so no other screen's numbers change.
 * Returns that invite's signature.
 */
export function addDecidedSignatures(world) {
  const invite = world.decided.find(
    (t) => t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominator
  );
  const signers = world.admins.filter((a) => a !== NULL_OWNER).slice(3, 11);
  signers.forEach((admin, i) => {
    const h = invite.blockHeight + 10 + i * 50;
    world.approvals.push({
      type: 'GROUP_APPROVAL',
      timestamp: blockTime(h) - 10_000,
      reference: sig(`ar:${admin}:${invite.signature}`),
      fee: '0.01000000',
      signature: sig(`a:${admin}:${invite.signature}:${h}`),
      txGroupId: 0,
      blockHeight: h,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: admin,
      adminPublicKey: pk(admin),
      pendingSignature: invite.signature,
      approval: true,
    });
  });
  return invite.signature;
}
// ---- comments (Q-Mintership+ 2.0: public comments and Minter Admin hides) ----
/**
 * Add public comments and hide records (JSON `qmp-comment-<key>-<id>` and
 * `qmp-hide-<key>-<id>`) to `world.records`:
 *
 * - Wren Waiting's nomination (waiting, keyed by their address): a thread
 *   with replies (one answering a reply), an edited comment the nominee
 *   answered, a deleted comment with a reply still readable, a comment a
 *   Minter Admin hid, and a hide by a member that doesn't count;
 * - bob+builder's invite (signing): one comment from before the first
 *   signature (their address) and two under the decision (first 40
 *   characters of its signature).
 *
 * Returns the keys and identifiers, for tests.
 */
export function addComments(world) {
  const HOUR = 3_600_000;
  const waitingKey = ADDR.nominatedWaiting;
  const signingTx = world.pending.find(
    (t) => t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominatedSigning
  );
  const decisionKey = signingTx.signature.slice(0, 40);
  const id = (key, suffix) => `qmp-comment-${key}-${suffix}`;
  const comment = (name, key, suffix, hoursAgo, body, updatedHoursAgo) =>
    world.records.push({
      name,
      identifier: id(key, suffix),
      created: NOW - hoursAgo * HOUR,
      ...(updatedHoursAgo !== undefined ? { updated: NOW - updatedHoursAgo * HOUR } : {}),
      body: { v: 1, key, ...body },
    });
  world.names.set('Spam Name', fakeAddress('spam-name'));

  const ids = {
    helped: id(waitingKey, 'wren01'),
    sameHere: id(waitingKey, 'wren02'),
    thanks: id(waitingKey, 'wren03'),
    online: id(waitingKey, 'wren04'),
    answer: id(waitingKey, 'wren05'),
    deleted: id(waitingKey, 'wren06'),
    civil: id(waitingKey, 'wren07'),
    spam: id(waitingKey, 'wren08'),
    beforeSigning: id(ADDR.nominatedSigning, 'bob001'),
    signed: id(decisionKey, 'bob002'),
    agreed: id(decisionKey, 'bob003'),
  };

  comment('Member 7', waitingKey, 'wren01', 26, {
    text: 'Wren helped me set up my node last month. Patient, clear, and they checked back a week later to see it was still minting.',
  });
  comment('Nora Nominator', waitingKey, 'wren02', 20, {
    text: 'Same experience here. Their node guide is worth a read: qortal://WEBSITE/WrenNodeGuide',
    replyTo: ids.helped,
  });
  comment('Zoë Newcomer', waitingKey, 'wren03', 18, {
    text: 'Thanks for the link, that guide got me going too.',
    replyTo: ids.sameHere,
  });
  comment(
    'Lou Left',
    waitingKey,
    'wren04',
    30,
    {
      text: 'Do they keep their node online most of the day? That matters more than anything else for minting.',
      edited: true,
    },
    28
  );
  comment('Wren Waiting', waitingKey, 'wren05', 27, {
    text: 'Yes: it runs on a small home server and has been online since spring.',
    replyTo: ids.online,
  });
  comment('Member 3', waitingKey, 'wren06', 40, { text: '', deleted: true }, 39);
  comment('Member 9', waitingKey, 'wren07', 38, {
    text: 'Please keep it about minting, everyone.',
    replyTo: ids.deleted,
  });
  comment('Spam Name', waitingKey, 'wren08', 10, {
    text: 'Cheap QORT here, message me!!! qortal://APP/NotARealApp',
  });
  // Avery Admin hid the spam; a member's hide of Member 7's comment doesn't count.
  world.records.push({
    name: PEOPLE.admin.name,
    identifier: `qmp-hide-${waitingKey}-hide01`,
    created: NOW - 9 * HOUR,
    body: { v: 1, commentName: 'Spam Name', commentIdentifier: ids.spam, hidden: true },
  });
  world.records.push({
    name: PEOPLE.learner.name,
    identifier: `qmp-hide-${waitingKey}-hide02`,
    created: NOW - 8 * HOUR,
    body: { v: 1, commentName: 'Member 7', commentIdentifier: ids.helped, hidden: true },
  });

  comment('Member 2', ADDR.nominatedSigning, 'bob001', 80, {
    text: 'bob+builder answers questions in the minting chat almost every day.',
  });
  comment('Admin C', decisionKey, 'bob002', 3, {
    text: 'Signed. Their node has been steady all month.',
  });
  comment('Member 5', decisionKey, 'bob003', 2, {
    text: 'Agreed, I see them online every day.',
    replyTo: ids.signed,
  });
  return { waitingKey, decisionKey, ids };
}
// ---- answers-wording (night 2): former members ready to mint, name search ----

/** Two former members who have asked to join again: one removed, one who left. */
export const FORMER_READY = {
  removed: { address: fakeAddress('former-ready-removed'), name: 'Fern Former' },
  left: { address: fakeAddress('former-ready-left'), name: 'Leif Left Before' },
};

/**
 * Add FORMER_READY to the world: their accounts, their MINTER history (an
 * approved invite, then an approved kick or their own LEAVE_GROUP, all
 * older than Activity's longest range) and their join requests, so Ready to
 * mint shows them marked as former members.
 */
export function addFormerReady(world) {
  const admin = world.admins[3];
  for (const [i, who] of [FORMER_READY.removed, FORMER_READY.left].entries()) {
    world.accounts.set(who.address, {
      address: who.address,
      name: who.name,
      level: 2 + i,
      blocks: 90_000 + i * 120_000,
      publicKey: pk(who.address),
      reference: sig(`ref:${who.address}`),
      balance: 1,
    });
    world.names.set(who.name, who.address);
    world.decided.push({
      type: 'GROUP_INVITE',
      timestamp: blockTime(2_300_000 + i) - 20_000,
      reference: sig(`r:former-invite:${i}`),
      fee: '0.01000000',
      signature: sig(`former-invite:${i}`),
      txGroupId: GROUP,
      blockHeight: 2_300_000 + i,
      approvalStatus: 'APPROVED',
      approvalHeight: 2_301_000 + i,
      creatorAddress: admin,
      adminPublicKey: pk(admin),
      groupId: GROUP,
      invitee: who.address,
      timeToLive: 864_000,
    });
    world.joinRequests.push({ groupId: GROUP, joiner: who.address });
  }
  world.decided.push({
    type: 'GROUP_KICK',
    timestamp: blockTime(2_480_000) - 20_000,
    reference: sig('r:former-kick'),
    fee: '0.01000000',
    signature: sig('former-kick'),
    txGroupId: GROUP,
    blockHeight: 2_480_000,
    approvalStatus: 'APPROVED',
    approvalHeight: 2_481_200,
    creatorAddress: admin,
    adminPublicKey: pk(admin),
    groupId: GROUP,
    member: FORMER_READY.removed.address,
    reason: 'Not minting',
  });
  world.decided.push({
    type: 'LEAVE_GROUP',
    timestamp: blockTime(2_490_000) - 20_000,
    reference: sig('r:former-leave'),
    fee: '0.01000000',
    signature: sig('former-leave'),
    txGroupId: 0,
    blockHeight: 2_490_000,
    approvalStatus: 'NOT_REQUIRED',
    creatorAddress: FORMER_READY.left.address,
    leaverPublicKey: pk(FORMER_READY.left.address),
    groupId: GROUP,
  });
}

/**
 * Core's `GET /names/search?query=&prefix=true&limit=`: the world's names
 * that start with the query (any case), one page. Undefined for other paths.
 */
export function answerNameSearch(world, pathname, sp) {
  if (pathname !== '/names/search') return undefined;
  const q = (sp.get('query') || '').toLowerCase();
  const limit = Number(sp.get('limit') || 0);
  if (!limit) throw new Error('limit=0 is not allowed in this app');
  const rows = [...world.names.entries()]
    .filter(([name]) => name.toLowerCase().startsWith(q))
    .slice(0, limit)
    .map(([name, owner]) => ({ name, owner }));
  return { status: 200, body: rows };
}
