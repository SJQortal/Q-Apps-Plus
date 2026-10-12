/**
 * History for Minter Admin Activity and the group pulse in the mock world:
 * about 50 decided MINTER decisions over the last 185 days and the
 * signatures on them, so the Activity screen and its tests have real
 * numbers. Every address and name is made up.
 *
 * What it adds (world.activity lists it for tests):
 * - invites, removals, bans, a lifted ban and a cancelled invite, decided by
 *   eight signatures (approved) or left to expire, signed by the current
 *   admins at different paces (Avery almost always, Dex rarely);
 * - two former admins, Fern (removed 12 days ago) and Gus (100 days ago),
 *   who both left MINTER afterwards;
 * - one admin made an admin 20 days ago and one 150 days ago;
 * - a few rejections, an admin who changed their mind each way, a
 *   signature that landed too late, and an approval for another group's
 *   transaction (must be ignored);
 * - signatures on the decided rows world.mjs already has.
 *
 * Rows go into world.decided and world.approvals, which answerCore's
 * /transactions/search already reads, so answerActivity adds no endpoint.
 */
import { fakeAddress, fakeKey, GROUP, MS_PER_BLOCK, NOW, NULL_OWNER, TIP } from './world.mjs';

// world.mjs imports this file, so its constants are only read inside functions.
const MAX_DELAY = 10_080;
const NEEDED = 8;

const blockTime = (height) => NOW - (TIP - height) * MS_PER_BLOCK;
const sig = (seed) => fakeKey(`activity:${seed}`, 64);

/** The same pseudo-random numbers on every run. */
function random(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1_664_525) + 1_013_904_223) >>> 0;
    return x / 2 ** 32;
  };
}

/** Add activity history to `world`. */
export function extendActivity(world) {
  const rand = random(694);
  /** Blocks in a day at the mock block time (1,185). */
  const dayBlocks = Math.round(86_400_000 / MS_PER_BLOCK);
  const days = (n) => TIP - Math.round(n * dayBlocks);
  const addAccount = (address, name, level, blocks) => {
    world.accounts.set(address, {
      address,
      name,
      level,
      blocks,
      publicKey: fakeKey(`pk:${address}`, 32),
      reference: fakeKey(`sig:ref:${address}`, 64),
      balance: 3,
    });
    world.names.set(name, address);
  };
  const pk = (address) => world.accounts.get(address)?.publicKey ?? fakeKey(`pk:${address}`, 32);

  const signers = world.admins.filter((a) => a !== NULL_OWNER);
  const [avery, juniper, dex, ...extra] = signers;
  const fern = fakeAddress('activity-former-fern');
  const gus = fakeAddress('activity-former-gus');
  addAccount(fern, 'Fern Former', 6, 1_100_000);
  addAccount(gus, 'Gus Gone', 5, 700_000);
  const lateAdded = extra[15];
  const earlyAdded = extra[14];
  const selfProposer = fakeAddress('member-7');

  const removedAt = new Map([
    [fern, days(12)],
    [gus, days(100)],
  ]);
  const addedAt = new Map([
    [lateAdded, days(20)],
    [earlyAdded, days(150)],
  ]);
  const isAdminAt = (address, height) =>
    (signers.includes(address) || removedAt.has(address)) &&
    !(removedAt.has(address) && height >= removedAt.get(address)) &&
    !(addedAt.has(address) && height < addedAt.get(address));

  // How likely each admin is to sign a decision, and so how they compare.
  const diligence = new Map([
    [avery, 0.95],
    [juniper, 0.5],
    [dex, 0.25],
    [fern, 0.7],
    [gus, 0.55],
  ]);
  const paces = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.6, 0.8];
  extra.forEach((a, i) => diligence.set(a, paces[i] ?? 0.9));
  const pool = [...signers, fern, gus];
  const byDiligence = [...pool].sort((a, b) => diligence.get(b) - diligence.get(a));

  const added = { decisions: [], approvals: [], leaves: [] };
  const approve = (tx, who, height, approval = true) => {
    const row = {
      type: 'GROUP_APPROVAL',
      timestamp: blockTime(height) - 10_000,
      reference: sig(`ar:${who}:${tx.signature}:${height}`),
      fee: '0.01000000',
      signature: sig(`a:${who}:${tx.signature}:${height}:${approval}`),
      txGroupId: 0,
      blockHeight: height,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: who,
      adminPublicKey: pk(who),
      pendingSignature: tx.signature,
      approval,
    };
    world.approvals.push(row);
    added.approvals.push(row);
    return row;
  };

  /**
   * One decided decision. `plan` 'approve' collects signatures until eight
   * are in (then Core approves it in the next block); 'expire' stops at
   * five. `at` forces the approval block (admin changes on fixed dates).
   */
  const decide = (type, h, creator, fields, plan, at) => {
    const keyField = type.endsWith('_GROUP_ADMIN') ? 'ownerPublicKey' : 'adminPublicKey';
    const tx = {
      type,
      timestamp: blockTime(h) - 20_000,
      reference: sig(`r:${type}:${h}`),
      fee: '0.01000000',
      signature: sig(`${type}:${h}:${creator}`),
      txGroupId: GROUP,
      blockHeight: h,
      approvalStatus: 'PENDING',
      creatorAddress: creator,
      [keyField]: pk(creator),
      groupId: GROUP,
      ...fields,
    };
    const subject = fields.member ?? fields.admin ?? fields.offender ?? fields.invitee;
    const votes = isAdminAt(creator, h) ? [{ who: creator, at: h + 1 }] : [];
    for (const who of pool) {
      if (who === creator || who === subject || !isAdminAt(who, h)) continue;
      if (rand() >= diligence.get(who)) continue;
      // Keen admins sign sooner, so they are less often beaten to it by the eighth signature.
      const when = h + 5 + Math.floor(rand() ** 2 * 7_000 * (1.15 - diligence.get(who)));
      if (isAdminAt(who, when)) votes.push({ who, at: when });
    }
    votes.sort((a, b) => a.at - b.at);
    let kept = votes;
    if (at !== undefined) {
      // Fixed approval block: the eight most diligent admins sign before it.
      const team = byDiligence.filter((w) => w !== subject && isAdminAt(w, h)).slice(0, NEEDED);
      kept = team.map((who, i) => ({ who, at: Math.min(at - 1, h + 1 + i * 90) }));
      tx.approvalStatus = 'APPROVED';
      tx.approvalHeight = at;
    } else if (plan === 'approve' && votes.length >= NEEDED) {
      const decidedAt = Math.max(votes[NEEDED - 1].at + 1, h + 6);
      kept = votes.filter((v) => v.at < decidedAt);
      tx.approvalStatus = 'APPROVED';
      tx.approvalHeight = decidedAt;
    } else {
      kept = votes.slice(0, Math.min(votes.length, NEEDED - 3));
      tx.approvalStatus = 'EXPIRED';
      tx.approvalHeight = h + MAX_DELAY + 1;
    }
    for (const vote of kept) approve(tx, vote.who, vote.at);
    world.decided.push(tx);
    added.decisions.push(tx);
    return tx;
  };

  const creatorAt = (h) => {
    const admins = byDiligence.filter((a) => isAdminAt(a, h));
    return admins[Math.floor(rand() * Math.min(admins.length, 10))];
  };

  // ---- fixed events -----------------------------------------------------
  decide('ADD_GROUP_ADMIN', days(150) - 900, avery, { member: earlyAdded }, 'approve', days(150));
  decide('REMOVE_GROUP_ADMIN', days(100) - 1_400, extra[0], { admin: gus }, 'approve', days(100));
  decide('ADD_GROUP_ADMIN', days(20) - 1_100, avery, { member: lateAdded }, 'approve', days(20));
  decide('REMOVE_GROUP_ADMIN', days(12) - 2_000, extra[1], { admin: fern }, 'approve', days(12));
  // A member proposing themselves as an admin: a few signatures, expired.
  decide('ADD_GROUP_ADMIN', days(45), selfProposer, { member: selfProposer }, 'expire');
  decide(
    'GROUP_KICK',
    days(150),
    extra[2],
    { member: fakeAddress('activity-kick-1'), reason: 'Not minting for a year' },
    'approve'
  );
  decide(
    'GROUP_KICK',
    days(60),
    extra[4],
    { member: fakeAddress('activity-kick-2'), reason: 'Kicked by Minter Admins' },
    'approve'
  );
  decide(
    'GROUP_KICK',
    days(25),
    juniper,
    { member: fakeAddress('activity-kick-3'), reason: 'Inactive' },
    'expire'
  );
  decide(
    'GROUP_BAN',
    days(110),
    extra[3],
    { offender: fakeAddress('activity-ban-1'), reason: 'Banned by Minter Admins', timeToLive: 0 },
    'approve'
  );
  decide(
    'GROUP_BAN',
    days(40),
    avery,
    { offender: fakeAddress('activity-ban-2'), reason: 'Spam', timeToLive: 7 * 86_400 },
    'approve'
  );
  decide(
    'CANCEL_GROUP_BAN',
    days(70),
    extra[5],
    { member: fakeAddress('activity-ban-lifted') },
    'approve'
  );
  // Core's answer for CANCEL_GROUP_INVITE leaves out groupId and invitee.
  const cancel = decide('CANCEL_GROUP_INVITE', days(90), extra[6], {}, 'approve');
  delete cancel.groupId;

  // ---- invites, one every few days --------------------------------------
  const invites = [];
  for (let d = 184, i = 0; d >= 10; d -= 3.4 + rand() * 1.2, i++) {
    const h = days(d);
    const plan = rand() < 0.74 ? 'approve' : 'expire';
    const invitee = fakeAddress(`activity-invitee-${i}`);
    invites.push(decide('GROUP_INVITE', h, creatorAt(h), { invitee, timeToLive: 864_000 }, plan));
  }

  // ---- changes of mind, a rejection, a late signature ---------------------
  const expired = invites.filter((tx) => tx.approvalStatus === 'EXPIRED');
  const signedBy = (tx, who) =>
    world.approvals.some((a) => a.pendingSignature === tx.signature && a.creatorAddress === who);
  const unsignedBy = (who, list) =>
    list.find((tx) => !signedBy(tx, who) && isAdminAt(who, tx.blockHeight));
  const flipNo = unsignedBy(extra[2], expired);
  if (flipNo) {
    approve(flipNo, extra[2], flipNo.blockHeight + 300, true);
    approve(flipNo, extra[2], flipNo.blockHeight + 900, false);
  }
  const flipYes = unsignedBy(
    extra[4],
    expired.filter((tx) => tx !== flipNo)
  );
  if (flipYes) {
    approve(flipYes, extra[4], flipYes.blockHeight + 200, false);
    approve(flipYes, extra[4], flipYes.blockHeight + 700, true);
  }
  const rejected = unsignedBy(
    extra[8],
    expired.filter((tx) => tx !== flipNo && tx !== flipYes)
  );
  if (rejected) approve(rejected, extra[8], rejected.blockHeight + 400, false);
  const tooLate = unsignedBy(
    juniper,
    expired.filter((tx) => tx !== flipNo && tx !== flipYes && tx !== rejected)
  );
  if (tooLate) approve(tooLate, juniper, tooLate.blockHeight + MAX_DELAY);
  // An approval of another group's transaction: Activity ignores it.
  approve({ signature: sig('another-groups-tx') }, avery, days(3));

  // ---- signatures on the decided rows world.mjs already has ---------------
  for (const tx of world.decided) {
    if (added.decisions.includes(tx) || tx.txGroupId !== GROUP) continue;
    if (typeof tx.blockHeight !== 'number' || tx.blockHeight < days(200)) continue;
    const h = tx.blockHeight;
    const team = byDiligence.filter((w) => isAdminAt(w, h) && w !== tx.creatorAddress);
    const people = [tx.creatorAddress, ...team];
    if (tx.approvalStatus === 'APPROVED' && typeof tx.approvalHeight === 'number') {
      const gap = Math.max(1, Math.floor((tx.approvalHeight - h - 2) / NEEDED));
      people
        .slice(0, NEEDED)
        .forEach((who, i) => approve(tx, who, Math.min(tx.approvalHeight - 1, h + 1 + i * gap)));
    } else if (tx.approvalStatus === 'EXPIRED') {
      people.slice(0, 3).forEach((who, i) => approve(tx, who, h + 1 + i * 500));
    }
  }

  // ---- the former admins left MINTER afterwards ---------------------------
  for (const [who, d] of [
    [fern, 5],
    [gus, 95],
  ]) {
    const h = days(d);
    const leave = {
      type: 'LEAVE_GROUP',
      timestamp: blockTime(h) - 20_000,
      reference: sig(`r:leave:${who}`),
      fee: '0.01000000',
      signature: sig(`leave:${who}`),
      txGroupId: 0,
      blockHeight: h,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: who,
      leaverPublicKey: pk(who),
      groupId: GROUP,
    };
    world.decided.push(leave);
    added.leaves.push(leave);
  }

  world.activity = {
    ...added,
    dayBlocks,
    former: { fern, gus },
    addedAdmins: { lateAdded, earlyAdded },
    flips: {
      approveThenReject: flipNo?.signature ?? null,
      rejectThenApprove: flipYes?.signature ?? null,
      rejected: rejected?.signature ?? null,
      tooLate: tooLate?.signature ?? null,
    },
  };
}

/** Answer a Core GET about activity history, or undefined (answerCore covers it). */
export function answerActivity(_world, _pathname, _sp) {
  return undefined;
}
