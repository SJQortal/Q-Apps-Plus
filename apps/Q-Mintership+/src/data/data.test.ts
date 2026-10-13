import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADDR, NULL_OWNER, TIP, addOtherPending, installWorld } from '../test/world';
import { fakeAddress, fakeKey } from '../../e2e/world.mjs';
import { fetchCalls } from '../test/setup';
import { getChainNow, heightToTime } from './chain';
import { loadDecisions } from './decisions';
import { getAdmins, getGroupInfo, getMembers } from './group';
import { loadMyStatus } from './me';
import { loadNominations, loadNominationsFor } from './nominations';
import { fetchQuery, invalidate, queryLoadCounts, resetQueries } from './query';

afterEach(() => vi.useRealTimers());


describe('read store', () => {
  it('merges identical loads, caches, and never caches a failure', async () => {
    resetQueries();
    let calls = 0;
    const load = async () => {
      calls++;
      return calls;
    };
    await Promise.all([fetchQuery('t:a', load), fetchQuery('t:a', load)]);
    expect(calls).toBe(1);
    expect(await fetchQuery('t:a', load)).toBe(1);
    invalidate('t:');
    expect(await fetchQuery('t:a', load)).toBe(2);
    await expect(fetchQuery('t:b', () => Promise.reject(new Error('down')))).rejects.toThrow(
      'down'
    );
    expect(await fetchQuery('t:b', async () => 'up')).toBe('up');
    expect(queryLoadCounts().t).toBe(4);
  });
});

describe('MINTER reads against the mock world', () => {
  it('reads settings and admins with onlyAdmins=true, null owner counted', async () => {
    installWorld();
    const [info, admins] = await Promise.all([getGroupInfo(), getAdmins()]);
    expect(info.approvalThreshold).toBe('PCT40');
    expect(admins.adminCount).toBe(20);
    expect(admins.admins.some((a) => a.member === NULL_OWNER)).toBe(true);
    expect(admins.signers).toHaveLength(19);
    expect(
      fetchCalls.some((c) => c.startsWith('/groups/members/694?onlyAdmins=true&limit=100&offset=0'))
    ).toBe(true);
  });

  it('pages the member list at 100 and never asks for limit=0', async () => {
    installWorld();
    const members = await getMembers();
    expect(members.members.length).toBe(members.memberCount);
    expect(fetchCalls.every((c) => !/[?&]limit=0(&|$)/.test(c))).toBe(true);
  });

  it('measures block time from real block timestamps', async () => {
    installWorld();
    const now = await getChainNow();
    expect(now.height).toBe(TIP);
    expect(Math.round(now.msPerBlock)).toBe(72_900);
    expect(now.estimated).toBe(false);
    expect(heightToTime(now, TIP + 10)).toBe(now.timestamp + 10 * now.msPerBlock);
  });
});

describe('loadDecisions', () => {
  it('builds every pending decision with its tally, clock and phase', async () => {
    installWorld();
    const data = await loadDecisions();
    const byKind = (subject: string) => data.decisions.find((d) => d.subject === subject);
    const signing = byKind(ADDR.nominatedSigning)!;
    expect(signing.kind).toBe('invite');
    expect(signing.tally?.approvalCount).toBe(5);
    expect(signing.tally?.needed).toBe(8);
    expect(signing.tally?.inFlight).toHaveLength(1);
    expect(signing.phase).toBe('open');
    expect(signing.window?.expiresAtHeight).toBe(TIP - 3_000 + 10_081);

    expect(byKind(ADDR.met)?.phase).toBe('thresholdMet');
    expect(byKind(ADDR.late)?.phase).toBe('tooLate');
    expect(byKind(ADDR.early)?.phase).toBe('early');
    expect(byKind(ADDR.demote)?.phase).toBe('unconfirmed');
    expect(byKind(ADDR.kickTarget)?.reason).toBe('Not minting for 6 months');
    expect(byKind(ADDR.banTarget)?.banSeconds).toBe(0);
    // A cancelled invite's invitee comes from its raw bytes (Core's JSON leaves it out).
    expect(data.decisions.find((d) => d.kind === 'cancelInvite')?.subject).toBe(
      fakeAddress('stale-1')
    );
    // Most urgent first: the open ones by expiry.
    expect(data.decisions[0].subject).toBe(ADDR.urgent);
  });

  it('lists a MINTER transaction on an unusual approval route, admins only', async () => {
    installWorld();
    const data = await loadDecisions();
    expect(data.unusual).toHaveLength(1);
    expect(data.unusual[0].unusualRoute).toBe(true);
    expect(data.unusual[0].tally).toBeNull();
    expect(data.decisions.every((d) => !d.unusualRoute)).toBe(true);
  });

  it('lists only MINTER group changes as decisions; other waiting transactions apart', async () => {
    const { world } = installWorld();
    const others = addOtherPending(world);
    const data = await loadDecisions();
    expect(data.decisions.some((d) => others.includes(d.signature))).toBe(false);
    expect(data.others.map((o) => [o.label, o.groupId])).toEqual([
      ['Invite to a group', 4242],
      ['Register name', null],
      ['Cancel a group invite', 4242],
    ]);
    // MINTER's own cancellation (group 694 in its raw bytes) stays a decision.
    expect(data.decisions.filter((d) => d.kind === 'cancelInvite')).toHaveLength(1);
    // The nominee's real nomination is still waiting for its first signature.
    const nominations = await loadNominations();
    const waiting = nominations.all.find((n) => n.nominee === ADDR.nominatedWaiting)!;
    expect(waiting.state).toBe('waiting');
    expect(waiting.decision).toBeNull();
  });

  it('never takes another group’s decided invite for a MINTER one', async () => {
    const { world } = installWorld();
    world.decided.push({
      ...world.pending[0],
      signature: fakeKey('other-decided', 64),
      groupId: 4242,
      invitee: ADDR.nominatedWaiting,
      blockHeight: TIP - 500,
      approvalStatus: 'APPROVED',
      approvalHeight: TIP - 400,
    });
    const data = await loadNominations();
    const waiting = data.all.find((n) => n.nominee === ADDR.nominatedWaiting)!;
    expect(waiting.state).toBe('waiting');
    expect(waiting.latestInvite).toBeNull();
  });

  it('reads approvals by block range, starting just below the oldest pending', async () => {
    installWorld();
    await loadDecisions();
    const search = fetchCalls.find((c) =>
      c.startsWith('/transactions/search?txType=GROUP_APPROVAL')
    )!;
    const start = Number(new URLSearchParams(search.split('?')[1]).get('startBlock'));
    expect(start).toBe(TIP - 10_079 - 10);
    expect(search).toContain('confirmationStatus=CONFIRMED');
    expect(search).toContain('limit=100');
  });
});

describe('loadNominations', () => {
  it('re-validates publishers and joins records with the chain', async () => {
    installWorld();
    const data = await loadNominations();
    const of = (address: string) => data.all.find((n) => n.nominee === address);
    const waiting = of(ADDR.nominatedWaiting)!;
    expect(waiting.state).toBe('waiting');
    expect(waiting.nomination?.publisher.address).toBe(ADDR.nominator);
    // adminL4 (an admin, level 4) counts; learner (level 2 member) is ignored.
    expect(waiting.supporters.map((s) => s.publisher.address)).toEqual([ADDR.adminL4]);
    expect(waiting.waitingEndsAt).toBeGreaterThan(Date.now());

    const signing = of(ADDR.nominatedSigning)!;
    expect(signing.state).toBe('signing');
    expect(signing.hasJoinRequest).toBe(true);
    expect(signing.decision?.tally?.approvalCount).toBe(5);

    expect(of(ADDR.lapsed)?.state).toBe('lapsed');
    expect(of(ADDR.newcomerName)).toBeUndefined();
    expect(data.ignored.map((i) => i.why).sort()).toEqual(['invalid', 'publisher']);
    expect(
      data.open.every((n) => ['waiting', 'signing', 'approved', 'blocked'].includes(n.state))
    ).toBe(true);
  });

  it('treats an invite that expired after the record as the end of that round', async () => {
    installWorld();
    const data = await loadNominations();
    expect(data.all.find((n) => n.nominee === ADDR.expired)?.state).toBe('expired');
  });

  it('includes pending invites with no record as chain nominations', async () => {
    installWorld();
    const data = await loadNominations();
    const met = data.all.find((n) => n.nominee === ADDR.met)!;
    expect(met.source).toBe('chain');
    expect(met.state).toBe('signing');
  });

  it("reads one person's nominations without the member list", async () => {
    installWorld();
    const mine = await loadNominationsFor(ADDR.nominatedWaiting);
    expect(mine).toHaveLength(1);
    expect(mine[0].state).toBe('waiting');
    expect(fetchCalls.some((c) => c.startsWith('/groups/members/694?limit'))).toBe(false);
  });
});

describe('loadMyStatus', () => {
  const cases: Array<[string, string]> = [
    ['admin', 'admin'],
    ['adminL4', 'admin'],
    ['nominator', 'memberNominator'],
    ['learner', 'member'],
    ['newcomer', 'newcomer'],
    ['newcomerName', 'newcomer'],
    ['nominatedWaiting', 'nominated'],
    ['nominatedSigning', 'nominated'],
    ['approved', 'approvedInvite'],
    ['kicked', 'formerKicked'],
    ['banned', 'formerBanned'],
    ['left', 'formerLeft'],
  ];
  it.each(cases)('%s → %s', async (persona, kind) => {
    const { address } = installWorld(persona);
    const status = await loadMyStatus(address);
    expect(status.kind).toBe(kind);
  });

  it('stops at membership for members and admins (nothing else changes their status)', async () => {
    for (const persona of ['nominator', 'admin']) {
      const { address } = installWorld(persona);
      fetchCalls.length = 0;
      await loadMyStatus(address, { force: true });
      expect(fetchCalls.some((c) => c.startsWith('/transactions/'))).toBe(false);
      expect(fetchCalls.some((c) => c.startsWith('/arbitrary/'))).toBe(false);
      expect(fetchCalls.some((c) => c.startsWith('/groups/joinrequests/'))).toBe(false);
      expect(fetchCalls.some((c) => c.startsWith('/groups/invites/'))).toBe(false);
    }
  });

  it('a forced status refresh leaves the decisions queue to its own pollers', async () => {
    const { address } = installWorld('nominatedWaiting');
    await loadMyStatus(address);
    const queueReads = () =>
      fetchCalls.filter((c) => c.startsWith('/transactions/pending?txGroupId=694')).length;
    const before = queueReads();
    await loadMyStatus(address, { force: true });
    expect(queueReads()).toBe(before);
  });

  it('carries the real numbers each home needs', async () => {
    const { address } = installWorld('learner');
    const status = await loadMyStatus(address);
    expect(status.level).toBe(2);
    expect(status.progress.blocksToTarget).toBe(618_400 - 90_500);
    expect(status.canNominate).toBe(false);
    expect(status.nominateBlock).toContain('level 5');
  });

  it('knows a kicked member was a member, and when', async () => {
    const { address } = installWorld('kicked');
    const status = await loadMyStatus(address);
    expect(status.removal?.kind).toBe('kick');
    expect(status.wasMember).toBe(true);
    expect(status.level).toBe(3);
  });

  it('gives nominees their nomination with its signatures', async () => {
    const { address } = installWorld('nominatedSigning');
    const status = await loadMyStatus(address);
    expect(status.nomination?.state).toBe('signing');
    expect(status.hasJoinRequest).toBe(true);
  });

  it('an admin is a member too and can nominate at level 4', async () => {
    const { address } = installWorld('adminL4');
    const status = await loadMyStatus(address);
    expect(status.isMember).toBe(true);
    expect(status.canNominate).toBe(true);
  });
});
