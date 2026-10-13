import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerCore, fakeAddress } from '../../e2e/world.mjs';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { ADDR, NOW, installWorld } from '../test/world';
import { MINTER_GROUP_ID } from './constants';
import { loadNominations } from './nominations';
import { peekQuery } from './query';
import {
  READY_READS_AT_ONCE,
  loadReadyDetails,
  loadReadyToMint,
  pickReadyToMint,
} from './readyToMint';
import type { AccountInfo, BanRow } from './types';

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

describe('loadReadyDetails', () => {
  it('reads each row’s account and name, six at a time, and only once', async () => {
    const { world } = installWorld();
    let active = 0;
    let most = 0;
    mockFetchRoute(/^\/(addresses|names\/primary)\//, async (url: URL) => {
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
    expect(peekQuery<AccountInfo>(`account:${ADDR.kicked}`)).toMatchObject({
      level: 3,
      blocksMinted: 210_000,
    });
    expect(peekQuery(`name:${ADDR.kicked}`)).toBe('Kit Kicked');
    expect(peekQuery(`name:${rows[1]}`)).toBeNull();

    // Cached: the same rows again cost nothing.
    await loadReadyDetails(rows);
    expect(fetchCallsFor('/addresses/')).toHaveLength(10);
  });

  it('starts no new reads once the rows leave the screen', async () => {
    installWorld();
    const controller = new AbortController();
    const rows = Array.from({ length: 20 }, (_, i) => fakeAddress(`gone-${i}`));
    const done = loadReadyDetails(rows, { signal: controller.signal });
    controller.abort();
    await done;
    // Only the first batch had started.
    expect(fetchCallsFor('/addresses/').length + fetchCallsFor('/names/primary/').length).toBe(
      READY_READS_AT_ONCE
    );
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
