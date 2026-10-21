import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { FUNDER, SPONSEES, SPONSOR } from '../../../e2e/world.mjs';
import { groupFirstPayers, sponseesOf } from '../../rules/explorer/connections';
import { peekQuery, resetQueries } from '../query';
import { getLinks } from './links';
import { getSponsorshipReport, sponsorKey } from './sponsorship';
import {
  checkFirstFunding,
  checkPaymentsSent,
  joinSponsees,
  runPool,
  type SetProgress,
} from './sets';
import type { Funding } from './account';

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => resetQueries());
afterEach(() => vi.useRealTimers());

describe('runPool', () => {
  it('runs a few at a time and starts no new ones once stopped', async () => {
    let running = 0;
    let most = 0;
    const started: number[] = [];
    const stop = new AbortController();
    const done = runPool(
      [1, 2, 3, 4, 5, 6],
      2,
      async (item) => {
        started.push(item);
        running += 1;
        most = Math.max(most, running);
        await tick();
        running -= 1;
        if (item === 3) stop.abort();
      },
      stop.signal
    );
    await done;
    expect(most).toBe(2);
    // 3 and 4 were running when it stopped; nothing after them started.
    expect(started).toEqual([1, 2, 3, 4]);
  });

  it('is fine with an empty list', async () => {
    await expect(runPool([], 2, async () => undefined)).resolves.toBeUndefined();
  });
});

describe('the sponsees joined with MINTER and minting now', () => {
  it('marks members, minting now and bans', () => {
    const a = `Q${'a'.repeat(33)}`;
    const b = `Q${'b'.repeat(33)}`;
    const c = `Q${'c'.repeat(33)}`;
    const sponsee = (address: string) => ({
      address,
      percent: '0',
      start: { height: 1, timestamp: 1, signature: 'x' },
      removal: null,
      blocks: null,
      active: true,
      shares: 1,
      txs: [],
    });
    const rows = joinSponsees([sponsee(a), sponsee(b), sponsee(c)], {
      members: [{ member: a, joined: 5 }],
      online: [{ minterAddress: c, recipientAddress: b }],
      bans: [
        { groupId: 694, offender: c, admin: a, banned: 1 },
        { groupId: 694, offender: b, admin: a, banned: 1, expiry: 10 },
      ],
      now: 100,
    });
    expect(rows.map((r) => [Boolean(r.member), r.mintingNow, r.banned])).toEqual([
      [true, false, false],
      [false, true, false],
      [false, true, true],
    ]);
    expect(rows[0].member?.joined).toBe(5);
    // Before the lists load, nothing is claimed.
    expect(joinSponsees([sponsee(a)], {})[0]).toMatchObject({
      member: null,
      mintingNow: false,
      banned: false,
    });
  });
});

describe('checks across Sid Sponsor’s sponsees (mock world)', () => {
  async function sponsees() {
    const links = await getLinks(SPONSOR.address);
    return sponseesOf(links.rows, SPONSOR.address).map((s) => s.address);
  }

  it('where each one’s first QORT came from, with progress', async () => {
    installWorld('admin', { strict: true });
    const accounts = await sponsees();
    const progress: SetProgress[] = [];
    const results = await checkFirstFunding(accounts, { onProgress: (p) => progress.push(p) });
    expect(progress[0]).toEqual({ done: 0, total: 5 });
    expect(progress[progress.length - 1]).toEqual({ done: 5, total: 5 });
    const funding = new Map<string, Funding | null>();
    for (const [address, checked] of results) {
      expect(checked.ok).toBe(true);
      if (checked.ok) funding.set(address, checked.value);
    }
    const grouped = groupFirstPayers(funding);
    // Hal paid Tia and the unnamed sponsee first; Sid paid Sam first; Avery paid Leo.
    const payers = grouped.payers.map((p) => [p.from, p.accounts.length]);
    expect(payers[0]).toEqual([FUNDER.address, 2]);
    expect(payers.slice(1)).toEqual(
      expect.arrayContaining([
        [SPONSOR.address, 1],
        [ADDR.admin, 1],
      ])
    );
    // Ugo's first transaction was Sid's reward share.
    expect(grouped).toMatchObject({ other: 1, none: 0 });
  });

  it('stops starting new accounts when asked', async () => {
    installWorld('admin', { strict: true });
    const accounts = await sponsees();
    const stop = new AbortController();
    const results = await checkFirstFunding(accounts, {
      signal: stop.signal,
      onProgress: (p) => {
        if (p.done === 1) stop.abort();
      },
    });
    expect(results.size).toBeLessThan(5);
    expect(results.size).toBeGreaterThanOrEqual(1);
  });

  it('each one’s payments sent, as light reads', async () => {
    installWorld('admin', { strict: true });
    const accounts = await sponsees();
    const results = await checkPaymentsSent(accounts, { scope: SPONSOR.address });
    expect([...results.values()].every((r) => r.ok)).toBe(true);
    expect(peekQuery(`xpay:${ADDR.learner}:sent`)).toBeDefined();
    expect(fetchCallsFor('/transactions/search?address=Q').length).toBe(1);
  });

  it('a failed account is noted, the rest go on', async () => {
    installWorld('admin');
    mockFetchRoute(`/addresses/${SPONSEES[0].address}`, () => new Response('x', { status: 500 }));
    const results = await checkFirstFunding([SPONSEES[0].address, SPONSEES[1].address]);
    expect(results.get(SPONSEES[0].address)).toEqual({ ok: false });
    expect(results.get(SPONSEES[1].address)?.ok).toBe(true);
  });
});

describe('Core’s sponsorship report', () => {
  it('is read once on request, through the heavy limiter, and kept', async () => {
    installWorld('admin', { strict: true });
    const report = await getSponsorshipReport(SPONSOR.address);
    expect(report).toMatchObject({ address: SPONSOR.address, sponseeCount: 5 });
    expect(report.names).toEqual(expect.arrayContaining(['Sam Sprout', 'Leo Learner']));
    expect(peekQuery(sponsorKey(SPONSOR.address))).toBe(report);
    await getSponsorshipReport(SPONSOR.address);
    expect(fetchCallsFor('/addresses/sponsorship/')).toHaveLength(1);
  });
});
