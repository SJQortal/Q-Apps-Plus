import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { ADDR, MS_PER_BLOCK, NOW, PEOPLE, TIP, installWorld } from '../test/world';
import { loadNominations, loadNominationsFor } from './nominations';

const DAY = 86_400_000;
const DAY_BLOCKS = Math.round(DAY / MS_PER_BLOCK);

describe('the nominations read: rounds an older invite decided', () => {
  // Simon, 2026-11-17: QQQ Test's October round, rejected two days later, read as lapsed:
  // its invite was older than the last two waiting windows, the only invites the read took.
  it('reads invites back to its oldest record, so a round an old invite decided is decided', async () => {
    const { world } = installWorld('learner');
    const nominee = ADDR.lapsed;
    // The lapsed person's record moves 40 days back, and an invite answered it a day later.
    const record = world.records.find(
      (r: { identifier: string }) => r.identifier === `qmp-nomination-${nominee}`
    );
    if (!record) throw new Error('no record');
    record.created = NOW - 40 * DAY;
    (record.body as { created: number }).created = NOW - 40 * DAY;
    const h = TIP - 39 * DAY_BLOCKS;
    world.decided.push({
      type: 'GROUP_INVITE',
      timestamp: NOW - 39 * DAY,
      reference: 'old-invite-reference',
      fee: '0.01000000',
      signature: 'oldInviteSignatureForTheLapsedPersonRejectedLongAgo1111111111111111111111',
      txGroupId: 694,
      blockHeight: h,
      approvalStatus: 'REJECTED',
      approvalHeight: h + 2 * DAY_BLOCKS,
      creatorAddress: ADDR.admin,
      adminPublicKey: world.accounts.get(ADDR.admin)?.publicKey,
      groupId: 694,
      invitee: nominee,
      timeToLive: 864_000,
    });
    const data = await loadNominations();
    const n = data.all.find((x) => x.nominee === nominee);
    expect(n?.state).toBe('rejected');
    expect(n?.latestInvite?.approvalStatus).toBe('REJECTED');
  });

  // Simon, 2026-11-20: Jonny's November invite was rejected, and his nomination showed his
  // October round's nominator and text again.
  it('a decided round shows the nominator its own invite answered, not an earlier round’s', async () => {
    const { world } = installWorld('learner');
    const nominee = ADDR.lapsed;
    const record = world.records.find(
      (r: { identifier: string }) => r.identifier === `qmp-nomination-${nominee}`
    );
    if (!record) throw new Error('no record');
    // Nora's record is the second round, 12 days ago; Avery's was the first, 40 days ago.
    record.created = NOW - 12 * DAY;
    (record.body as { created: number }).created = NOW - 12 * DAY;
    world.records.push({
      name: 'Avery Admin',
      identifier: `qmp-nomination-${nominee}`,
      created: NOW - 40 * DAY,
      body: { ...(record.body as object), created: NOW - 40 * DAY, reason: 'The first round.' },
    });
    const invite = (daysAgo: number, decidedDaysAgo: number, id: string) => {
      const h = TIP - daysAgo * DAY_BLOCKS;
      world.decided.push({
        type: 'GROUP_INVITE',
        timestamp: NOW - daysAgo * DAY,
        reference: `ref-${id}`,
        fee: '0.01000000',
        signature: `${id}InviteSignatureRejected${'1'.repeat(60)}`.slice(0, 88),
        txGroupId: 694,
        blockHeight: h,
        approvalStatus: 'REJECTED',
        approvalHeight: TIP - decidedDaysAgo * DAY_BLOCKS,
        creatorAddress: ADDR.admin,
        adminPublicKey: world.accounts.get(ADDR.admin)?.publicKey,
        groupId: 694,
        invitee: nominee,
        timeToLive: 864_000,
      });
    };
    invite(39, 37, 'first');
    invite(11, 9, 'second');
    for (const data of [await loadNominations(), { all: await loadNominationsFor(nominee) }]) {
      const n = data.all.find((x) => x.nominee === nominee);
      expect(n?.state).toBe('rejected');
      expect(n?.nomination?.publisher.name).toBe('Nora Nominator');
      expect(n?.publishedAt).toBe(NOW - 12 * DAY);
    }
  });
});

// Simon, 2026-11-20: "make sure there are no more mistakes like this". Comments under a
// nominee's address must stop where an earlier round that lapsed stopped counting.
describe('the nominations read: where an earlier round ended', () => {
  const WINDOW = 10_080 * MS_PER_BLOCK;

  /** The lapsed person nominated by Nora `nowDaysAgo` days ago, and by Avery `earlierDaysAgo`. */
  async function twoRecords(nowDaysAgo: number, earlierDaysAgo: number) {
    const { world } = installWorld('learner');
    const nominee = ADDR.lapsed;
    const record = world.records.find(
      (r: { identifier: string }) => r.identifier === `qmp-nomination-${nominee}`
    );
    if (!record) throw new Error('no record');
    record.created = NOW - nowDaysAgo * DAY;
    (record.body as { created: number }).created = NOW - nowDaysAgo * DAY;
    world.records.push({
      name: 'Avery Admin',
      identifier: `qmp-nomination-${nominee}`,
      created: NOW - earlierDaysAgo * DAY,
      body: { ...(record.body as object), created: NOW - earlierDaysAgo * DAY, reason: 'Earlier.' },
    });
    return (await loadNominations()).all.find((x) => x.nominee === nominee);
  }

  it('an earlier round that lapsed ended a window after its last record', async () => {
    const n = await twoRecords(3, 20);
    expect(n?.nomination?.publisher.name).toBe('Nora Nominator');
    expect(n?.earlierRoundEnd).toBe(NOW - 20 * DAY + WINDOW);
  });

  it('a record still waiting when the next came is the same round, so nothing ends before it', async () => {
    // Avery's ran out of its window 1.5 days ago, but it was still waiting when Nora's came.
    expect(10 * DAY - WINDOW).toBeGreaterThan(0);
    expect(7 * DAY).toBeLessThan(WINDOW);
    const n = await twoRecords(3, 10);
    expect(n?.nomination?.publisher.name).toBe('Nora Nominator');
    expect(n?.earlierRoundEnd).toBeNull();
  });
});

// Simon, 2026-11-24: igorcoin nominated Stone Golem again under the same record, and the
// comments of the nomination that lapsed came along as if they were the new one's.
describe('the nominations read: a nominator who nominates someone again', () => {
  const WINDOW = 10_080 * MS_PER_BLOCK;

  /** The lapsed person's record, first published `createdDaysAgo` and again `updatedDaysAgo`. */
  function publishedTwice(createdDaysAgo: number, updatedDaysAgo: number) {
    const { world } = installWorld('learner');
    const nominee = ADDR.lapsed;
    const record = world.records.find(
      (r: { identifier: string }) => r.identifier === `qmp-nomination-${nominee}`
    );
    if (!record) throw new Error('no record');
    record.created = NOW - createdDaysAgo * DAY;
    record.updated = NOW - updatedDaysAgo * DAY;
    (record.body as { created: number }).created = NOW - updatedDaysAgo * DAY;
    return { world, nominee };
  }

  it('after its wait ran out: the first publish is an earlier round, which lapsed', async () => {
    const { nominee } = publishedTwice(20, 2);
    const n = (await loadNominations()).all.find((x) => x.nominee === nominee);
    expect(n?.state).toBe('waiting');
    expect(n?.publishedAt).toBe(NOW - 2 * DAY);
    expect(n?.earlierRounds).toEqual([
      {
        startedAt: NOW - 20 * DAY,
        endedAt: NOW - 20 * DAY + WINDOW,
        outcome: 'lapsed',
        invite: null,
      },
    ]);
    // Comments under their address count for this one from when that round stopped counting.
    expect(n?.earlierRoundEnd).toBe(NOW - 20 * DAY + WINDOW);
    expect(n?.records.map((r) => [r.publishedAt, Boolean(r.replaced)])).toEqual([
      [NOW - 20 * DAY, true],
      [NOW - 2 * DAY, false],
    ]);
  });

  it('after an invite rejected it: the first publish is that invite’s round, credited to them', async () => {
    const { world, nominee } = publishedTwice(8, 2);
    const h = TIP - 7 * DAY_BLOCKS;
    world.decided.push({
      type: 'GROUP_INVITE',
      timestamp: NOW - 7 * DAY,
      reference: 'quick-reject-reference',
      fee: '0.01000000',
      signature: `quickRejectInviteSignature${'1'.repeat(70)}`.slice(0, 88),
      txGroupId: 694,
      blockHeight: h,
      approvalStatus: 'REJECTED',
      approvalHeight: h + DAY_BLOCKS,
      creatorAddress: ADDR.admin,
      adminPublicKey: world.accounts.get(ADDR.admin)?.publicKey,
      groupId: 694,
      invitee: nominee,
      timeToLive: 864_000,
    });
    for (const data of [await loadNominations(), { all: await loadNominationsFor(nominee) }]) {
      const n = data.all.find((x) => x.nominee === nominee);
      expect(n?.state).toBe('waiting');
      expect(n?.earlierRounds.map((r) => [r.outcome, r.startedAt, r.invite?.at])).toEqual([
        ['rejected', NOW - 8 * DAY, NOW - 7 * DAY],
      ]);
      expect(n?.records.filter((r) => r.replaced).map((r) => r.publishedAt)).toEqual([
        NOW - 8 * DAY,
      ]);
    }
  });

  it('not for a record published once, nor again within minutes', async () => {
    const { nominee } = publishedTwice(3, 3 - 5 / (24 * 60));
    const n = (await loadNominations()).all.find((x) => x.nominee === nominee);
    expect(n?.earlierRounds).toEqual([]);
    expect(n?.records.some((r) => r.replaced)).toBe(false);
  });
});

describe('the nominations read: a record the node doesn’t give', () => {
  // Simon, 2026-11-25: Minter Admins who block a nominator never saw that nominator's
  // re-nomination: published again longer, it went off chain, and Core never fetches a
  // blocked name's data. It showed for them only once another Minter Admin put it on chain.
  const name = (who: 'nominator' | 'learner' | 'adminL4'): string => PEOPLE[who].name ?? who;
  const nominator = name('nominator');
  const bodyPath = (name: string, kind: string, nominee: string) =>
    `/arbitrary/JSON/${encodeURIComponent(name)}/qmp-${kind}-${nominee}`;

  /** The node has the row but answers no body for it, and this status. */
  function notGiven(name: string, kind: string, nominee: string, status?: string) {
    mockFetchRoute(
      bodyPath(name, kind, nominee),
      () => new Response('{"error":1,"message":"data unavailable"}', { status: 404 })
    );
    if (status)
      mockFetchRoute(`/arbitrary/resource/status/JSON/${encodeURIComponent(name)}/qmp-${kind}-${nominee}`, {
        status,
        id: status,
        localChunkCount: 0,
        totalChunkCount: 1,
      });
  }

  it('one not on the node yet still shows, who nominated whom and when, without its text', async () => {
    installWorld('admin');
    notGiven(nominator, 'nomination', ADDR.nominatedWaiting, 'MISSING_DATA');
    const data = await loadNominations();
    const n = data.all.find((x) => x.nominee === ADDR.nominatedWaiting);
    expect(n?.state).toBe('waiting');
    expect(n?.publishedAt).toBe(NOW - 2 * DAY);
    expect(n?.nomination?.publisher.name).toBe(nominator);
    expect(n?.nomination?.unread).toBe('missing');
    expect(n?.nomination?.record).toEqual({
      v: 1,
      nomineeAddress: ADDR.nominatedWaiting,
      reason: '',
      links: [],
    });
    expect(data.open.some((x) => x.nominee === ADDR.nominatedWaiting)).toBe(true);
    expect(data.ignored.some((r) => r.identifier.endsWith(ADDR.nominatedWaiting))).toBe(false);
  });

  it('a nominator blocked on the node: it shows, and says the node blocks them', async () => {
    installWorld('admin');
    notGiven(nominator, 'nomination', ADDR.nominatedWaiting, 'BLOCKED');
    for (const all of [
      (await loadNominations()).all,
      await loadNominationsFor(ADDR.nominatedWaiting),
    ]) {
      const n = all.find((x) => x.nominee === ADDR.nominatedWaiting);
      expect(n?.nomination?.unread).toBe('blocked');
      expect(n?.nomination?.publisher.name).toBe(nominator);
    }
  });

  it('a nominee and publisher are still checked: an ineligible publisher’s stays out', async () => {
    installWorld('admin');
    // The learner (level 0) published one for the newcomer: ignored, read or not.
    notGiven(name('learner'), 'nomination', ADDR.newcomerName, 'BLOCKED');
    const data = await loadNominations();
    expect(data.all.some((x) => x.nominee === ADDR.newcomerName)).toBe(false);
    expect(data.ignored).toContainEqual({
      name: name('learner'),
      identifier: `qmp-nomination-${ADDR.newcomerName}`,
      why: 'publisher',
    });
  });

  it('one its nominator deleted stays out', async () => {
    installWorld('admin');
    mockFetchRoute(bodyPath(nominator, 'nomination', ADDR.nominatedWaiting), 'D');
    const data = await loadNominations();
    expect(data.all.some((x) => x.nominee === ADDR.nominatedWaiting)).toBe(false);
    expect(data.ignored).toContainEqual({
      name: nominator,
      identifier: `qmp-nomination-${ADDR.nominatedWaiting}`,
      why: 'unreadable',
    });
  });

  it('re-published and not given: both rounds show, the lapsed one in History too', async () => {
    const { world } = installWorld('learner');
    const nominee = ADDR.lapsed;
    const record = world.records.find(
      (r: { identifier: string }) => r.identifier === `qmp-nomination-${nominee}`
    );
    if (!record) throw new Error('no record');
    record.created = NOW - 20 * DAY;
    record.updated = NOW - 2 * DAY;
    notGiven(record.name, 'nomination', nominee, 'BLOCKED');
    const n = (await loadNominations()).all.find((x) => x.nominee === nominee);
    expect(n?.state).toBe('waiting');
    expect(n?.earlierRounds.map((r) => r.outcome)).toEqual(['lapsed']);
    expect(n?.records.map((r) => [r.publishedAt, Boolean(r.replaced), r.unread])).toEqual([
      [NOW - 20 * DAY, true, 'blocked'],
      [NOW - 2 * DAY, false, 'blocked'],
    ]);
  });

  it('a support the node didn’t give still counts, without its note', async () => {
    installWorld('admin');
    notGiven(name('adminL4'), 'support', ADDR.nominatedWaiting);
    const n = (await loadNominations()).all.find((x) => x.nominee === ADDR.nominatedWaiting);
    const support = n?.supporters.find((s) => s.publisher.name === name('adminL4'));
    expect(support?.record).toEqual({ v: 1, nomineeAddress: ADDR.nominatedWaiting });
  });

  it('a blocked nominator’s record isn’t waited for: one read, one status read', async () => {
    installWorld('admin');
    notGiven(nominator, 'nomination', ADDR.nominatedWaiting, 'BLOCKED');
    await loadNominations();
    await loadNominations({ force: true });
    expect(fetchCallsFor(bodyPath(nominator, 'nomination', ADDR.nominatedWaiting))).toHaveLength(1);
    expect(fetchCallsFor('/arbitrary/resource/status/')).toEqual([
      `/arbitrary/resource/status/JSON/${encodeURIComponent(nominator)}/qmp-nomination-${ADDR.nominatedWaiting}?build=false`,
    ]);
  });
});
