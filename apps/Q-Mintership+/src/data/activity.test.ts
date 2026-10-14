import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerCore } from '../../e2e/world.mjs';
import { fetchCalls, mockFetchRoute } from '../test/setup';
import { ADDR, MS_PER_BLOCK, NULL_OWNER, TIP, installWorld } from '../test/world';
import {
  activityKey,
  getLevelProgress,
  loadActivity,
  loadLevelSpread,
  resolveRange,
} from './activity';
import { queryLoadCounts } from './query';

afterEach(() => vi.useRealTimers());

const DAY = Math.round(86_400_000 / MS_PER_BLOCK);

describe('Minter Admin Activity reads (mock world)', () => {
  it('measures the window in blocks from the block at its start time', async () => {
    installWorld();
    const data = await loadActivity({ days: 30 });
    expect(data.range.endBlock).toBe(TIP);
    expect(Math.abs(data.range.startBlock - (TIP - 30 * DAY))).toBeLessThan(DAY / 12);
    expect(data.range.estimated).toBe(false);
    expect(fetchCalls.some((c) => c.startsWith('/blocks/timestamp/'))).toBe(true);
  });

  it('lists every admin who can sign, never the null owner, and former admins of the window', async () => {
    const { world } = installWorld();
    const data = await loadActivity({ days: 30 });
    const current = data.report.current.map((a) => a.address);
    expect(current).toHaveLength(19);
    expect(current).not.toContain(NULL_OWNER);
    expect(data.report.former.map((a) => a.address)).toEqual([world.activity.former.fern]);
    const fern = data.report.former[0];
    expect(fern.removedAt).toBe(TIP - 12 * DAY);
    expect(data.names[fern.address]).toBeUndefined(); // she left MINTER: no member row

    const late = data.report.current.find(
      (a) => a.address === world.activity.addedAdmins.lateAdded
    );
    expect(late?.adminSince).toBe(TIP - 20 * DAY);
    expect(data.report.ignoredApprovals).toBeGreaterThan(0);
    expect(data.signerCount).toBe(19);
    expect(data.needed).toBe(8);
  });

  it('reaches further back for a longer window', async () => {
    const { world } = installWorld();
    const data = await loadActivity({ days: 180 });
    expect(data.report.former.map((a) => a.address).sort()).toEqual(
      [world.activity.former.fern, world.activity.former.gus].sort()
    );
    const avery = data.report.current.find((a) => a.address === ADDR.admin);
    expect(avery?.participation).toBeGreaterThan(0.75);
    const dex = data.report.current.find((a) => a.address === ADDR.demote);
    expect(dex?.participation).toBeLessThan(0.2);
    expect(data.pulse.invitesApproved).toBeGreaterThan(0);
    expect(data.pulse.approvalRate).toBeGreaterThan(0.5);
  });

  it('counts every answer as taking part: signed or rejected', async () => {
    installWorld();
    const data = await loadActivity({ days: 180 });
    const rows = [...data.report.current, ...data.report.former];
    for (const row of rows) {
      expect(row.answered).toBe(row.signed + row.rejected);
      if (row.eligible) expect(row.participation).toBeCloseTo(row.answered / row.eligible);
    }
    // The mock world's admins who rejected something: their rejections raise participation.
    const rejecters = rows.filter((row) => row.rejected > 0);
    expect(rejecters.length).toBeGreaterThan(0);
    for (const row of rejecters)
      expect(row.participation as number).toBeGreaterThan(row.signed / row.eligible);
  });

  it('summarises the group’s pulse for the window', async () => {
    installWorld();
    const data = await loadActivity({ days: 30 });
    // Members joined every 3 days in the mock: 10 in 30 days. Fern and Lou left.
    expect(data.pulse).toMatchObject({ joined: 10, left: 2, joinedKnown: true, leftKnown: true });
    expect(data.joinRequests).toBe(6);
    expect(data.memberCount).toBeGreaterThan(60);
  });

  it('pages every search and never asks for everything', async () => {
    installWorld();
    await loadActivity({ days: 180 });
    expect(fetchCalls.every((c) => !/[?&]limit=0(&|$)/.test(c))).toBe(true);
    const searches = fetchCalls.filter((c) => c.startsWith('/transactions/search'));
    expect(searches.every((c) => /[?&]limit=100(&|$)/.test(c))).toBe(true);
    expect(fetchCalls.length).toBeLessThan(45);
  });

  it('caches a window for five minutes', async () => {
    installWorld();
    await loadActivity({ days: 30 });
    const calls = fetchCalls.length;
    await loadActivity({ days: 30 });
    expect(fetchCalls.length).toBe(calls);
    expect(queryLoadCounts().activity).toBe(1);
  });

  it('falls back to the measured block time when the block lookup fails', async () => {
    installWorld();
    mockFetchRoute('/blocks/timestamp/', () => new Response('nope', { status: 500 }));
    const data = await loadActivity({ days: 30 });
    expect(data.range.estimated).toBe(true);
    expect(Math.abs(data.range.startBlock - (TIP - 30 * DAY))).toBeLessThan(DAY / 12);
  });

  it('resolves a custom range in the past to its own blocks', async () => {
    installWorld();
    const now = {
      height: TIP,
      timestamp: 1_791_830_000_000,
      msPerBlock: MS_PER_BLOCK,
      estimated: false,
    };
    const choice = {
      fromMs: now.timestamp - 60 * 86_400_000,
      toMs: now.timestamp - 30 * 86_400_000,
    };
    const range = await resolveRange(choice, now);
    expect(range.days).toBeNull();
    // The mock node answers /blocks/timestamp from its own 72.9 s blocks.
    expect(range.endBlock).toBe(TIP - Math.ceil((30 * 86_400_000) / MS_PER_BLOCK));
    expect(range.startBlock).toBe(TIP - Math.ceil((60 * 86_400_000) / MS_PER_BLOCK));
    expect(activityKey(choice)).toBe(`activity:custom:${choice.fromMs}:${choice.toMs}`);
  });

  it('knows an admin added after a past custom range was not one in it', async () => {
    const { world } = installWorld();
    const now = 1_791_830_000_000;
    const data = await loadActivity({
      fromMs: now - 60 * 86_400_000,
      toMs: now - 30 * 86_400_000,
    });
    const late = data.report.current.find(
      (a) => a.address === world.activity.addedAdmins.lateAdded
    )!;
    expect(late.adminSince).toBe(TIP - 20 * DAY);
    expect(late).toMatchObject({ eligible: 0, missed: 0, participation: null });
  });

  it('keeps going when the member list or departures can’t be read', async () => {
    const { world } = installWorld();
    mockFetchRoute(/^\/groups\/members\/694$/, (url: URL) => {
      if (url.searchParams.get('onlyAdmins') !== 'true')
        return new Response('down', { status: 500 });
      return answerCore(world, url.pathname, url.searchParams)?.body;
    });
    mockFetchRoute('/transactions/search', (url: URL) => {
      if (url.searchParams.get('txType') === 'LEAVE_GROUP')
        return new Response('down', { status: 500 });
      return answerCore(world, url.pathname, url.searchParams)?.body;
    });
    const data = await loadActivity({ days: 30 });
    expect(data.pulse).toMatchObject({ joinedKnown: false, leftKnown: false });
    expect(data.report.current).toHaveLength(19);
    expect(data.members).toEqual([]);
  });

  it('reads members’ levels six at a time, with progress', async () => {
    const { world } = installWorld();
    const members: string[] = world.members.slice(0, 20);
    const spread = await loadLevelSpread(members);
    expect(spread.total).toBe(20);
    expect(spread.byLevel.reduce((a, b) => a + b, 0) + spread.unknown).toBe(20);
    expect(getLevelProgress()).toEqual({ done: 20, total: 20 });
    expect(fetchCalls.filter((c) => /^\/addresses\/Q\w+$/.test(c))).toHaveLength(20);
  });
});
