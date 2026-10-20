import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerCore, fakeAddress } from '../../e2e/world.mjs';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { ADDR, NOW, installWorld } from '../test/world';
import { MINTER_GROUP_ID } from './constants';
import { loadNominations } from './nominations';
import { peekQuery } from './query';
import {
  READY_READS_AT_ONCE,
  formerKey,
  getFormerMember,
  loadReadyDetails,
  loadReadyToMint,
  matchReady,
  pickReadyToMint,
  lastAskedAt,
  parseReadySort,
  readyOrderKey,
  sortReady,
  type ReadyFacts,
} from './readyToMint';
import { formerMember } from '../rules/status';
import type { AccountInfo, BanRow, TxRow } from './types';

afterEach(() => vi.useRealTimers());

const jr = (joiner: string, groupId = MINTER_GROUP_ID) => ({ groupId, joiner });
const ban = (offender: string, expiry?: number): BanRow => ({
  groupId: MINTER_GROUP_ID,
  offender,
  admin: ADDR.admin,
  banned: NOW - 86_400_000,
  ...(expiry ? { expiry } : {}),
});

describe('pickReadyToMint', () => {
  it('keeps Core’s order, each address once, without members or anyone banned now', () => {
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map((s) => fakeAddress(`ready-${s}`));
    const people = pickReadyToMint({
      joinRequests: [jr(c), jr(a), jr(b), jr(a), jr(d), jr(e), jr(fakeAddress('other'), 2)],
      inGroup: new Set([b]),
      bans: [ban(d), ban(e, NOW - 1000)],
      now: NOW,
    });
    // b is a member, d is banned; e's ban ran out; another group's request is ignored.
    expect(people).toEqual([c, a, e]);
  });
});

describe('matchReady', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((s) => fakeAddress(`match-${s}`));
  const people = [a, b, c, d];
  const names: Record<string, string> = { [b]: 'Kit Kicked' };
  const nameOf = (address: string) => names[address] ?? null;
  const none = new Set<string>();

  it('keeps everyone, in Core’s order, for an empty search', () => {
    expect(matchReady(people, '', none)).toEqual(people);
    expect(matchReady(people, '   ', none)).toEqual(people);
  });

  it('matches a whole address only to that person, and nobody for an address not listed', () => {
    expect(matchReady(people, ` ${c} `, none)).toEqual([c]);
    expect(matchReady(people, fakeAddress('elsewhere'), none)).toEqual([]);
  });

  it('matches part of an address, from 4 characters, case kept', () => {
    expect(matchReady(people, d.slice(0, 6), none)).toContain(d);
    expect(matchReady(people, d.slice(-4), none)).toContain(d);
    expect(matchReady(people, d.slice(-4).toLowerCase() + '!', none)).toEqual([]);
    // Too short to tell addresses apart.
    expect(matchReady(people, d.slice(0, 3), none)).toEqual([]);
  });

  it('matches the owners of a typed name, and names already read, in Core’s order', () => {
    expect(matchReady(people, 'lou', new Set([d, a, fakeAddress('not-listed')]))).toEqual([a, d]);
    expect(matchReady(people, 'kick', none, nameOf)).toEqual([b]);
    expect(matchReady(people, '@KIT', none, nameOf)).toEqual([b]);
    expect(matchReady(people, 'kit', new Set([c]), nameOf)).toEqual([b, c]);
  });
});

describe('loadReadyToMint', () => {
  it('reads the join requests the nominations already read: no extra GETs', async () => {
    installWorld();
    await loadNominations();
    const before = fetchCallsFor(/^\/groups\//).length;
    const ready = await loadReadyToMint();
    expect(fetchCallsFor(/^\/groups\//).length).toBe(before);
    // The mock world's join requests, all outside MINTER and not banned.
    expect(ready.people).toEqual([
      ADDR.nominatedSigning,
      ADDR.urgent,
      ADDR.met,
      fakeAddress('jr-1'),
      fakeAddress('jr-2'),
      fakeAddress('jr-3'),
    ]);
    expect(ready.truncated).toBe(false);
  });

  it('leaves out members, admins and banned accounts', async () => {
    const { world } = installWorld();
    world.joinRequests.push(
      jr(ADDR.learner),
      jr(ADDR.admin),
      jr(ADDR.banned),
      jr(fakeAddress('old-ban')),
      jr(ADDR.kicked)
    );
    const { people } = await loadReadyToMint();
    expect(people).not.toContain(ADDR.learner);
    expect(people).not.toContain(ADDR.admin);
    expect(people).not.toContain(ADDR.banned);
    // A ban that ran out, and a former member, are ready again.
    expect(people).toContain(fakeAddress('old-ban'));
    expect(people).toContain(ADDR.kicked);
  });
});

describe('formerMember', () => {
  const me = fakeAddress('former-rule');
  const tip = { height: 2_000_000, timestamp: NOW };
  const msPerBlock = 60_000;
  const at = (height: number) => NOW - (tip.height - height) * msPerBlock;
  const tx = (type: string, height: number, extra: Partial<TxRow> = {}): TxRow => ({
    type,
    timestamp: at(height) - 10_000,
    signature: `${type}-${height}`,
    txGroupId: MINTER_GROUP_ID,
    groupId: MINTER_GROUP_ID,
    blockHeight: height,
    approvalStatus: 'APPROVED',
    ...extra,
  });
  const invite = tx('GROUP_INVITE', 1_000_000, { invitee: me });
  const kick = tx('GROUP_KICK', 1_500_000, { member: me, approvalHeight: 1_500_100 });
  const ban = tx('GROUP_BAN', 1_600_000, { offender: me, approvalHeight: 1_600_050 });
  const leave = tx('LEAVE_GROUP', 1_700_000, {
    creatorAddress: me,
    txGroupId: 0,
    approvalStatus: 'NOT_REQUIRED',
  });
  const former = (history: TxRow[]) => formerMember(me, history, tip, msPerBlock);

  it('marks a member who was kicked, banned once or left, dated by when it took effect', () => {
    expect(former([invite, kick])).toEqual({ kind: 'removed', at: at(1_500_100) });
    // A ban says how it ended (a permanent one with no lift on record: no date).
    expect(former([invite, ban])).toEqual({
      kind: 'banned',
      at: at(1_600_050),
      ban: { how: 'ended', at: null },
    });
    expect(former([invite, leave])).toEqual({ kind: 'left', at: at(1_700_000) });
    // The newest way out counts.
    expect(former([invite, kick, leave])).toMatchObject({ kind: 'left' });
    expect(former([leave, invite, ban])).toMatchObject({ kind: 'left' });
  });

  it('leaves out anyone who was never a member', () => {
    expect(former([])).toBeNull();
    // A kicked join request is not a membership.
    expect(former([kick])).toBeNull();
    expect(former([ban])).toBeNull();
    // An invite only after the kick: no membership before it.
    expect(former([kick, tx('GROUP_INVITE', 1_800_000, { invitee: me })])).toBeNull();
    // A kick still waiting for signatures removed nobody.
    expect(former([invite, { ...kick, approvalStatus: 'PENDING' }])).toBeNull();
    // Someone else's kick.
    expect(former([invite, { ...kick, member: fakeAddress('other') }])).toBeNull();
  });
});

describe('getFormerMember', () => {
  it('reads one history per person, and keeps the answer', async () => {
    installWorld();
    const histories = () => fetchCallsFor(/^\/transactions\/search\?address=/);
    expect(await getFormerMember(ADDR.kicked)).toMatchObject({ kind: 'removed' });
    expect(await getFormerMember(ADDR.left)).toMatchObject({ kind: 'left' });
    expect(await getFormerMember(fakeAddress('jr-1'))).toBeNull();
    expect(histories()).toHaveLength(3);
    await getFormerMember(ADDR.kicked);
    expect(histories()).toHaveLength(3);
  });
});

describe('loadReadyDetails', () => {
  it('reads each row’s account, name and history, six at a time, and only once', async () => {
    const { world } = installWorld();
    let active = 0;
    let most = 0;
    const histories = () => fetchCallsFor(/^\/transactions\/search\?address=/);
    mockFetchRoute(/^\/(addresses\/|names\/primary\/|transactions\/search)/, async (url: URL) => {
      active++;
      most = Math.max(most, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return answerCore(world, url.pathname, url.searchParams)?.body;
    });
    const rows = Array.from({ length: 10 }, (_, i) => fakeAddress(`detail-${i}`));
    rows[0] = ADDR.kicked;
    await loadReadyDetails(rows);
    expect(most).toBe(READY_READS_AT_ONCE);
    expect(fetchCallsFor('/addresses/')).toHaveLength(10);
    expect(fetchCallsFor('/names/primary/')).toHaveLength(10);
    // One history search per row, bounded and paged.
    expect(histories()).toHaveLength(10);
    for (const call of histories()) {
      expect(call).toMatch(/[?&]limit=100(&|$)/);
      expect(call).toMatch(/[?&]confirmationStatus=CONFIRMED(&|$)/);
    }
    expect(peekQuery<AccountInfo>(`account:${ADDR.kicked}`)).toMatchObject({
      level: 3,
      blocksMinted: 210_000,
    });
    expect(peekQuery(`name:${ADDR.kicked}`)).toBe('Kit Kicked');
    expect(peekQuery(`name:${rows[1]}`)).toBeNull();
    expect(peekQuery(formerKey(ADDR.kicked))).toMatchObject({ kind: 'removed' });
    expect(peekQuery(formerKey(rows[1]))).toBeNull();

    // Cached: the same rows again cost nothing.
    await loadReadyDetails(rows);
    expect(fetchCallsFor('/addresses/')).toHaveLength(10);
    expect(histories()).toHaveLength(10);
  });

  it('starts no new reads once the rows leave the screen', async () => {
    installWorld();
    const controller = new AbortController();
    const rows = Array.from({ length: 20 }, (_, i) => fakeAddress(`gone-${i}`));
    const done = loadReadyDetails(rows, { signal: controller.signal });
    controller.abort();
    await done;
    // Only the first batch had started: two rows' account, name and history.
    expect(
      fetchCallsFor('/addresses/').length +
        fetchCallsFor('/names/primary/').length +
        fetchCallsFor(/^\/transactions\/search\?address=/).length
    ).toBe(READY_READS_AT_ONCE);
  });

  it('keeps going when one read fails, and leaves that key in error', async () => {
    installWorld();
    const broken = fakeAddress('broken');
    mockFetchRoute(`/addresses/${broken}`, () => new Response('', { status: 500 }));
    const fine = fakeAddress('fine');
    await loadReadyDetails([broken, fine]);
    expect(peekQuery(`account:${broken}`)).toBeUndefined();
    expect(peekQuery<AccountInfo>(`account:${fine}`)).toMatchObject({ level: 0 });
  });
});

describe('Requested to join MINTER Group: the order', () => {
  const A = fakeAddress('ord-a');
  const B = fakeAddress('ord-b');
  const C = fakeAddress('ord-c');
  const D = fakeAddress('ord-d');

  it('finds when someone last asked to join MINTER in their history', () => {
    const join = (at: number, extra: Partial<TxRow> = {}): TxRow => ({
      type: 'JOIN_GROUP',
      signature: `s${at}`,
      timestamp: at,
      creatorAddress: A,
      groupId: MINTER_GROUP_ID,
      txGroupId: 0,
      approvalStatus: 'NOT_REQUIRED',
      ...extra,
    });
    expect(lastAskedAt(A, [join(100), join(300), join(200)])).toBe(300);
    // Other groups, other people and invalid ones don't count.
    expect(
      lastAskedAt(A, [
        join(100),
        join(500, { groupId: 2 }),
        join(600, { creatorAddress: B }),
        join(700, { approvalStatus: 'INVALID' }),
      ])
    ).toBe(100);
    expect(lastAskedAt(A, [])).toBeNull();
  });

  it('at the same level, puts more blocks minted first', () => {
    const facts: Record<string, ReadyFacts> = {
      [A]: { level: 7, blocks: 1_555_748 },
      [B]: { level: 7, blocks: 1_938_372 },
      [C]: { level: 8, blocks: 2_222_968 },
    };
    expect(sortReady([A, B, C], 'level', (x) => facts[x] ?? {})).toEqual([C, B, A]);
  });

  it('sorts each way, unknowns last, ties in the node’s order', () => {
    const facts: Record<string, ReadyFacts> = {
      [A]: { askedAt: 100, level: 3, blocks: 10, name: 'bravo' },
      [B]: { askedAt: 300, level: 5, blocks: 5, name: 'Alpha' },
      [C]: { askedAt: null, level: 3, blocks: null, name: null },
      [D]: { askedAt: 200, level: null, blocks: 50, name: 'charlie 10' },
    };
    const of = (address: string) => facts[address] ?? {};
    const people = [A, B, C, D];
    expect(sortReady(people, 'newest', of)).toEqual([B, D, A, C]);
    expect(sortReady(people, 'oldest', of)).toEqual([A, D, B, C]);
    expect(sortReady(people, 'level', of)).toEqual([B, A, C, D]);
    expect(sortReady(people, 'blocks', of)).toEqual([D, A, B, C]);
    expect(sortReady(people, 'name', of)).toEqual([B, A, D, C]);
    expect(sortReady(people, 'node', of)).toEqual(people);
    expect(parseReadySort(null)).toBe('newest');
    expect(parseReadySort('name')).toBe('name');
    expect(parseReadySort('sideways')).toBe('newest');
  });

  it('keys an order by the whole list, so someone new anywhere in it orders it again', () => {
    expect(readyOrderKey([A, B, C], 'newest')).toBe(readyOrderKey([A, B, C], 'newest'));
    expect(readyOrderKey([A, B, C], 'newest')).not.toBe(readyOrderKey([A, D, C], 'newest'));
    expect(readyOrderKey([A, B, C], 'newest')).not.toBe(readyOrderKey([A, B, C], 'oldest'));
  });
});
