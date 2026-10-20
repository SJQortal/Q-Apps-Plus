/**
 * A Minter Admin's answers (answers.ts): read 5 pages a step through the
 * heavy-read slot, "more" goes on from where the last step stopped, Stop
 * ends a step after the page being read, and each answer is joined to
 * MINTER's decisions (and the waiting queue); the rest is counted, as left
 * out or, past the decisions read, as not matched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerCore, fakeAddress, fakeKey } from '../../../e2e/world.mjs';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld, type InstalledWorld } from '../../test/world';
import { queryLoadCounts } from '../query';
import type { TxRow } from '../types';
import { heavyLoad } from './heavy';
import {
  ANSWER_STEP_PAGES,
  DECISION_PAGES_MAX,
  joinAnswers,
  loadAnswers,
  loadMinterDecisionPage,
  minterDecisionsTo,
  stopAnswers,
  type ApprovalRow,
  type DecisionRef,
} from './answers';

afterEach(() => vi.useRealTimers());

type World = InstalledWorld['world'];

const ref = (signature: string, height: number): DecisionRef => ({
  signature,
  kind: 'invite',
  subject: null,
  creatorAddress: null,
  height,
  outcome: 'approved',
  decline: false,
});
const approval = (pendingSignature: string, height: number, ok = true): ApprovalRow => ({
  signature: `a-${pendingSignature}-${height}`,
  pendingSignature,
  approval: ok,
  height,
  timestamp: height * 1000,
});

/** Serve `/transactions/search` from `answer` when it says so, else from the world. */
function serveSearch(world: World, answer: (sp: URLSearchParams) => unknown | undefined) {
  mockFetchRoute('/transactions/search', (url: URL) => {
    const own = answer(url.searchParams);
    if (own !== undefined) return own;
    const reply = answerCore(world, url.pathname, url.searchParams);
    return new Response(JSON.stringify(reply?.body ?? null), { status: reply?.status ?? 404 });
  });
}

describe('joinAnswers', () => {
  const index = {
    bySignature: new Map([['d1', ref('d1', 50_000)]]),
    oldestHeight: 40_000,
    done: false,
  };

  it('joins answers to MINTER decisions and the waiting queue', () => {
    const result = joinAnswers(
      [approval('d1', 50_010), approval('q1', 60_000, false)],
      index,
      [ref('q1', 59_990)],
      10_080
    );
    expect(result.answers.map((a) => [a.pendingSignature, a.approval])).toEqual([
      ['d1', true],
      ['q1', false],
    ]);
    expect(result).toMatchObject({ leftOut: 0, unmatched: 0 });
  });

  it('leaves out what isn’t a MINTER decision, and only counts what the decisions read can’t reach', () => {
    const result = joinAnswers(
      // Covered: its decision would be at or after 51,000 - 10,080 - 1 = 40,919 ≥ 40,000.
      [approval('other', 51_000), approval('old', 45_000)],
      index,
      [],
      10_080
    );
    expect(result).toMatchObject({ answers: [], leftOut: 1, unmatched: 1 });
    expect(
      joinAnswers([approval('old', 45_000)], { ...index, done: true }, [], 10_080)
    ).toMatchObject({ leftOut: 1, unmatched: 0 });
  });
});

describe('loadAnswers', () => {
  it('reads a Minter Admin’s answers in the world: MINTER ones listed, the rest counted', async () => {
    installWorld('learner', { strict: true });
    const reading = loadAnswers(ADDR.admin);
    expect(heavyLoad().running).toBe(1);
    const read = await reading;
    expect(read.approvals).toHaveLength(53);
    expect(read.answers).toHaveLength(52);
    expect(read.leftOut).toBe(1);
    expect(read.unmatched).toBe(0);
    expect(read).toMatchObject({ done: true, stopped: false, nextOffset: 53 });
    expect(read.answers[0].decision).toMatchObject({ kind: 'invite', subject: ADDR.early });
    // The answers' own search, and MINTER's decisions (one page: fewer than 100).
    const searches = fetchCallsFor('/transactions/search').map(
      (path) => new URL(path, 'http://x').searchParams
    );
    // (The Decisions queue reads approvals by block range: not by address.)
    const own = searches.filter((sp) => sp.get('txType') === 'GROUP_APPROVAL' && sp.has('address'));
    expect(
      own.map((sp) => [sp.get('address'), sp.get('limit'), sp.get('offset'), sp.get('reverse')])
    ).toEqual([[ADDR.admin, '100', '0', 'true']]);
    const minter = searches.filter((sp) => sp.get('txGroupId') === '694');
    expect(minter).toHaveLength(1);
    expect(minter[0].getAll('txType')).toEqual([
      'GROUP_INVITE',
      'CANCEL_GROUP_INVITE',
      'GROUP_KICK',
      'GROUP_BAN',
      'CANCEL_GROUP_BAN',
      'ADD_GROUP_ADMIN',
      'REMOVE_GROUP_ADMIN',
    ]);
    expect(queryLoadCounts().xanswers).toBe(1);
    expect(queryLoadCounts().activity).toBeUndefined();
  });

  it('reads 5 pages a step, goes on from there, and can be stopped', async () => {
    const { world } = installWorld('learner', { strict: true });
    const admin = fakeAddress('answers-busy-admin');
    const minterInvite = world.decided.find((t: TxRow) => t.type === 'GROUP_INVITE');
    const rows = Array.from({ length: 650 }, (_, i) => ({
      type: 'GROUP_APPROVAL',
      timestamp: 1_000_000 - i,
      signature: fakeKey(`answer-${i}`, 64),
      txGroupId: 0,
      blockHeight: minterInvite.blockHeight + 10,
      creatorAddress: admin,
      pendingSignature: i % 2 ? minterInvite.signature : fakeKey(`elsewhere-${i}`, 64),
      approval: i % 3 !== 0,
    }));
    let pages = 0;
    serveSearch(world, (sp) => {
      if (sp.get('address') !== admin) return undefined;
      pages += 1;
      // Stop is pressed while the second page of the third step is read.
      if (pages === 12) stopAnswers(admin);
      const offset = Number(sp.get('offset'));
      return rows.slice(offset, offset + Number(sp.get('limit')));
    });

    const first = await loadAnswers(admin);
    expect(pages).toBe(ANSWER_STEP_PAGES);
    expect(first).toMatchObject({ nextOffset: 500, done: false, stopped: false });
    expect(first.approvals).toHaveLength(500);
    expect(first.answers).toHaveLength(250);
    expect(first.leftOut).toBe(250);

    const second = await loadAnswers(admin, { more: true });
    expect(pages).toBe(ANSWER_STEP_PAGES + 2);
    expect(second).toMatchObject({ nextOffset: 650, done: true, stopped: false });
    expect(second.approvals).toHaveLength(650);
    expect(second.answers).toHaveLength(325);

    // A fresh read (Refresh) starts again from the newest, and Stop ends it after a page.
    pages = 10;
    const stopped = await loadAnswers(admin, { force: true });
    expect(stopped).toMatchObject({ nextOffset: 200, done: false, stopped: true });
    expect(stopped.approvals).toHaveLength(200);
  });
});

describe('MINTER decisions', () => {
  it('keeps the newest page’s earlier rows when it is read again', async () => {
    const { world } = installWorld('learner', { strict: true });
    let round = 0;
    serveSearch(world, (sp) => {
      if (sp.get('txGroupId') !== '694' || sp.get('address')) return undefined;
      round += 1;
      const tx = (i: number) => ({
        type: 'GROUP_INVITE',
        timestamp: i,
        signature: `round${round}-${i}`,
        txGroupId: 694,
        groupId: 694,
        blockHeight: 1_000 + i,
        approvalStatus: 'APPROVED',
        invitee: ADDR.learner,
      });
      return [tx(2), tx(1)];
    });
    await loadMinterDecisionPage(0);
    const again = await loadMinterDecisionPage(0, { force: true });
    expect(again.rows.map((r) => r.signature)).toEqual([
      'round2-2',
      'round2-1',
      'round1-2',
      'round1-1',
    ]);
  });

  it('reads back far enough, at most 30 pages, and says when it hit that ceiling', async () => {
    const { world } = installWorld('learner', { strict: true });
    serveSearch(world, (sp) => {
      if (sp.get('txGroupId') !== '694' || sp.get('address')) return undefined;
      const offset = Number(sp.get('offset'));
      return Array.from({ length: 100 }, (_, i) => ({
        type: 'GROUP_KICK',
        timestamp: 0,
        signature: `d${offset + i}`,
        txGroupId: 694,
        groupId: 694,
        blockHeight: 1_000_000 - (offset + i) * 10,
        approvalStatus: 'APPROVED',
        member: ADDR.learner,
      }));
    });
    const near = await minterDecisionsTo(1_000_000 - 1_500);
    expect(near).toMatchObject({ pages: 2, capped: false, done: false });
    const far = await minterDecisionsTo(0);
    expect(far).toMatchObject({ pages: DECISION_PAGES_MAX, capped: true });
    expect(far.bySignature.size).toBe(DECISION_PAGES_MAX * 100);
    // Pages read once stay for the session: the second read only added pages.
    expect(queryLoadCounts().xminterdecisions).toBe(DECISION_PAGES_MAX);
  });
});
