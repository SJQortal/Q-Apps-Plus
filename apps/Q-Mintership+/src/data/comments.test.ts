import { afterEach, describe, expect, it, vi } from 'vitest';
import { addComments } from '../../e2e/world.mjs';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { ADDR, NOW, installWorld } from '../test/world';
import { commentRef } from './commentRecords';
import {
  INDEX_LOOKBACK_MS,
  commentThreadKey,
  indexCovers,
  loadCommentIndex,
  loadCommentRows,
  loadCommentThread,
  setCommentBodyWait,
} from './comments';
import {
  buildThreads,
  commentRowsFor,
  commentTarget,
  decisionCommentTarget,
  nominationCommentTarget,
} from './commentThread';
import { loadNominations } from './nominations';
import { getQueryState } from './query';
import type { CommentThreadData } from './comments';

afterEach(() => {
  vi.useRealTimers();
  setCommentBodyWait(3_000);
});

async function setup() {
  const installed = installWorld('learner');
  const added = addComments(installed.world);
  const nominations = await loadNominations();
  const wren = nominations.all.find((n) => n.nominee === ADDR.nominatedWaiting)!;
  const bob = nominations.all.find((n) => n.nominee === ADDR.nominatedSigning)!;
  return { ...installed, ...added, wren, bob, nominations };
}

describe('comment counts', () => {
  it('one search lists the last 45 days of comments for every card', async () => {
    const { wren, bob } = await setup();
    const index = await loadCommentIndex();
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('identifier=qmp-comment-&')
    );
    expect(searches).toHaveLength(1);
    const params = new URLSearchParams(searches[0].split('?')[1]);
    expect(params.get('prefix')).toBe('true');
    expect(Number(params.get('limit'))).toBe(100);
    expect(Number(params.get('after'))).toBe(index.after);
    expect(index.after).toBeLessThanOrEqual(NOW - INDEX_LOOKBACK_MS);
    expect(index.after).toBeGreaterThan(NOW - INDEX_LOOKBACK_MS - 3_600_000);
    expect(index.truncated).toBe(false);

    const wrenTarget = nominationCommentTarget(wren);
    const bobTarget = nominationCommentTarget(bob);
    expect(indexCovers(index, wrenTarget)).toBe(true);
    expect(commentRowsFor(wrenTarget, index.rows)).toHaveLength(8);
    expect(commentRowsFor(bobTarget, index.rows)).toHaveLength(3);
    // A second card reads the same list.
    await loadCommentIndex();
    expect(
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
        p.includes('identifier=qmp-comment-&')
      )
    ).toHaveLength(1);
  });

  it('an item older than the list, or a full list, needs its own search', async () => {
    const { wren } = await setup();
    const index = await loadCommentIndex();
    expect(indexCovers(index, commentTarget('nomination', ADDR.nominatedWaiting))).toBe(false);
    expect(indexCovers({ ...index, truncated: true }, nominationCommentTarget(wren))).toBe(false);
    const rows = await loadCommentRows(commentTarget('nomination', ADDR.nominatedWaiting));
    expect(rows.rows).toHaveLength(8);
    const own = fetchCallsFor('/arbitrary/resources/searchsimple').find((p) =>
      p.includes(`identifier=qmp-comment-${ADDR.nominatedWaiting}-`)
    );
    expect(own).toBeDefined();
    expect(own).not.toContain('limit=0');
  });
});

describe('loadCommentThread', () => {
  it('reads the newest page, what replies answer, and the Minter Admins’ hides', async () => {
    const { wren, ids } = await setup();
    const target = nominationCommentTarget(wren);
    const data = await loadCommentThread(target, 20);
    expect(data.rows).toHaveLength(8);
    expect([...data.bodies.values()].every((b) => b.status === 'ok')).toBe(true);
    // Avery Admin's hide counts; Leo Learner's doesn't.
    expect(data.hides.get(commentRef('Spam Name', ids.spam))).toBe(true);
    expect(data.hides.has(commentRef('Member 7', ids.helped))).toBe(false);

    const threads = buildThreads({ ...data, muted: new Set() });
    expect(threads.map((t) => t.comment.name)).toEqual([
      'Spam Name',
      'Member 7',
      'Lou Left',
      'Member 3',
    ]);
    expect(threads[0].comment.hidden).toBe(true);
    expect(threads[1].replies.map((r) => [r.name, r.replyToName])).toEqual([
      ['Nora Nominator', null],
      ['Zoë Newcomer', 'Nora Nominator'],
    ]);
    expect(threads[2].comment.edited).toBe(true);
    expect(threads[3].comment.deleted).toBe(true);
    expect(threads[3].replies[0].text).toMatch(/keep it about minting/);
  });

  it('a page of 2 reads 2 bodies plus the comments they answer', async () => {
    const { wren } = await setup();
    const before = fetchCallsFor('/arbitrary/JSON/').length;
    const data = await loadCommentThread(nominationCommentTarget(wren), 2);
    // Spam Name and Zoë's reply, then Nora's reply it answers, then Member 7's.
    expect([...data.bodies.keys()].map((ref) => ref.split('\n')[0]).sort()).toEqual([
      'Member 7',
      'Nora Nominator',
      'Spam Name',
      'Zoë Newcomer',
    ]);
    const bodyReads = fetchCallsFor('/arbitrary/JSON/').slice(before);
    expect(bodyReads.filter((p) => p.includes('qmp-comment-'))).toHaveLength(4);
  });

  it('a decision’s thread includes the nomination’s comments from before the first signature', async () => {
    const { bob, decisionKey, ids } = await setup();
    const decision = bob.decision!;
    const target = decisionCommentTarget(decision, bob);
    expect(target.postKey).toBe(decisionKey);
    const data = await loadCommentThread(target, 20);
    const threads = buildThreads({ ...data, muted: new Set() });
    expect(threads.map((t) => t.comment.identifier)).toEqual([ids.signed, ids.beforeSigning]);
    expect(threads[0].replies.map((r) => r.identifier)).toEqual([ids.agreed]);
  });

  it('a body that is slow to arrive shows as fetching, then fills in', async () => {
    const { wren, ids, world } = await setup();
    setCommentBodyWait(5);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockFetchRoute(/\/arbitrary\/JSON\/Member%207\//, async () => {
      await gate;
      return world.records.find((r: { identifier: string }) => r.identifier === ids.helped).body;
    });
    const target = nominationCommentTarget(wren);
    const data = await loadCommentThread(target, 20);
    const ref = commentRef('Member 7', ids.helped);
    expect(data.bodies.get(ref)).toEqual({ status: 'unavailable', fetching: true });
    release();
    await vi.waitFor(() => {
      const now = getQueryState<CommentThreadData>(commentThreadKey(target, 20)).data;
      expect(now?.bodies.get(ref)?.status).toBe('ok');
    });
  });

  it('never asks Core for limit=0, and never POSTs', async () => {
    const { wren, posts } = await setup();
    await loadCommentThread(nominationCommentTarget(wren), 20);
    expect(fetchCallsFor('/').filter((p) => p.includes('limit=0'))).toEqual([]);
    expect(posts).toEqual([]);
  });
});
