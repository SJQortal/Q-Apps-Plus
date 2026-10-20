import { describe, expect, it } from 'vitest';
import { fakeAddress, fakeKey } from '../../e2e/world.mjs';
import { commentRef, decisionCommentKey, type CommentRecord } from './commentRecords';
import {
  ADDRESS_LOOKBACK_MS,
  ROUND_SLACK_MS,
  buildThreads,
  commentRowsFor,
  commentTarget,
  decisionCommentTarget,
  missingParents,
  nominationCommentTarget,
  resolveHides,
  targetId,
  targetSince,
  type CommentBody,
  type CommentRow,
  type NominationForComments,
} from './commentThread';
import type { QdnRow } from './types';

const DAY = 86_400_000;
const NOW = 1_791_830_000_000;
const NOMINEE = fakeAddress('thread-nominee');
const SIG = fakeKey('thread-decision', 64);
const OLD_SIG = fakeKey('thread-old-decision', 64);
const DKEY = decisionCommentKey(SIG);
const ident = (key: string, id: string) => `qmp-comment-${key}-${id}`;

function nomination(overrides: Partial<NominationForComments> = {}): NominationForComments {
  return {
    nominee: NOMINEE,
    state: 'waiting',
    publishedAt: NOW - 2 * DAY,
    nomination: { publishedAt: NOW - 2 * DAY },
    decision: null,
    latestInvite: null,
    ...overrides,
  };
}

describe('comment targets', () => {
  it('a waiting nomination: its nominee’s address, from 30 days before it was published', () => {
    expect(nominationCommentTarget(nomination())).toEqual({
      postKey: NOMINEE,
      keys: [{ key: NOMINEE, since: NOW - 2 * DAY - ADDRESS_LOOKBACK_MS }],
    });
  });

  it('never reaches back past an earlier round’s invite', () => {
    const target = nominationCommentTarget(
      nomination({ latestInvite: { signature: OLD_SIG, timestamp: NOW - 20 * DAY } })
    );
    expect(target.keys).toEqual([{ key: NOMINEE, since: NOW - 20 * DAY }]);
  });

  it('once signing: posts under the decision, still reads the comments from before', () => {
    const target = nominationCommentTarget(
      nomination({ state: 'signing', decision: { signature: SIG, createdAt: NOW - DAY } })
    );
    expect(target).toEqual({
      postKey: DKEY,
      keys: [
        { key: DKEY, since: NOW - DAY - ROUND_SLACK_MS },
        { key: NOMINEE, since: NOW - 2 * DAY - ADDRESS_LOOKBACK_MS },
      ],
    });
    // The decision's own card reads the same keys.
    expect(
      decisionCommentTarget(
        { signature: SIG, kind: 'invite', subject: NOMINEE, createdAt: NOW - DAY },
        nomination({ state: 'signing', decision: { signature: SIG, createdAt: NOW - DAY } })
      )
    ).toEqual(target);
  });

  it('a decided nomination stays under the invite that decided it', () => {
    const target = nominationCommentTarget(
      nomination({
        state: 'expired',
        latestInvite: { signature: OLD_SIG, timestamp: NOW - 12 * DAY },
      })
    );
    expect(target.postKey).toBe(decisionCommentKey(OLD_SIG));
    expect(target.keys.map((k) => k.key)).toEqual([decisionCommentKey(OLD_SIG), NOMINEE]);
  });

  it('a lapsed nomination with an older invite stays on the address', () => {
    const target = nominationCommentTarget(
      nomination({
        state: 'lapsed',
        latestInvite: { signature: OLD_SIG, timestamp: NOW - 90 * DAY },
      })
    );
    expect(target.postKey).toBe(NOMINEE);
  });

  it('a nomination made on chain only has no address comments', () => {
    const target = nominationCommentTarget(
      nomination({
        state: 'signing',
        nomination: null,
        decision: { signature: SIG, createdAt: NOW - DAY },
      })
    );
    expect(target.keys.map((k) => k.key)).toEqual([DKEY]);
  });

  it('other decisions: their own key only', () => {
    const kick = decisionCommentTarget(
      { signature: SIG, kind: 'kick', subject: NOMINEE, createdAt: NOW },
      nomination()
    );
    expect(kick.keys).toEqual([{ key: DKEY, since: NOW - ROUND_SLACK_MS }]);
    // An invite whose nomination is someone else's: no address key.
    const invite = decisionCommentTarget(
      { signature: SIG, kind: 'invite', subject: fakeAddress('other'), createdAt: NOW },
      nomination()
    );
    expect(invite.keys).toHaveLength(1);
  });

  it('from a key kind and a value; ids and the earliest time', () => {
    expect(commentTarget('decision', SIG)).toEqual({
      postKey: DKEY,
      keys: [{ key: DKEY, since: null }],
    });
    expect(commentTarget('nomination', NOMINEE, 5).keys).toEqual([{ key: NOMINEE, since: 5 }]);
    expect(targetSince(commentTarget('decision', SIG))).toBeNull();
    const signing = nominationCommentTarget(
      nomination({ state: 'signing', decision: { signature: SIG, createdAt: NOW - DAY } })
    );
    expect(targetSince(signing)).toBe(NOW - 2 * DAY - ADDRESS_LOOKBACK_MS);
    expect(targetId(signing)).toContain(`${DKEY}@`);
    expect(targetId(signing)).not.toBe(targetId(nominationCommentTarget(nomination())));
  });
});

function qdnRow(name: string, identifier: string, created: number, updated?: number): QdnRow {
  return {
    name,
    service: 'JSON',
    identifier,
    created,
    ...(updated ? { updated } : {}),
    latestSignature: `sig:${name}:${identifier}:${updated ?? created}`,
  };
}

describe('commentRowsFor', () => {
  const target = nominationCommentTarget(
    nomination({ state: 'signing', decision: { signature: SIG, createdAt: NOW - DAY } })
  );

  it('keeps this target’s comments, newest first, each once', () => {
    const rows = commentRowsFor(target, [
      qdnRow('Ada', ident(NOMINEE, 'aaaaaa'), NOW - 3 * DAY),
      qdnRow('Bob', ident(DKEY, 'bbbbbb'), NOW - 2 * 3_600_000),
      qdnRow('Bob', ident(DKEY, 'bbbbbb'), NOW - 2 * 3_600_000, NOW - 3_600_000),
      qdnRow('Cy', ident(DKEY, 'cccccc'), NOW - 3_600_000),
      // Another decision, a malformed identifier, a hide record, a nameless row.
      qdnRow('Dee', ident(decisionCommentKey(OLD_SIG), 'dddddd'), NOW),
      qdnRow('Dee', `qmp-comment-${DKEY}-x`, NOW),
      qdnRow('Dee', `qmp-hide-${DKEY}-eeeeee`, NOW),
      qdnRow('', ident(DKEY, 'ffffff'), NOW),
      // Too old for this round.
      qdnRow('Old', ident(NOMINEE, 'oooooo'), NOW - 2 * DAY - ADDRESS_LOOKBACK_MS - 1),
    ]);
    expect(rows.map((r) => [r.name, r.identifier.slice(-6)])).toEqual([
      ['Cy', 'cccccc'],
      ['Bob', 'bbbbbb'],
      ['Ada', 'aaaaaa'],
    ]);
    expect(rows[1]).toMatchObject({
      ref: commentRef('Bob', ident(DKEY, 'bbbbbb')),
      key: DKEY,
      postedAt: NOW - 2 * 3_600_000,
      updatedAt: NOW - 3_600_000,
      version: `sig:Bob:${ident(DKEY, 'bbbbbb')}:${NOW - 3_600_000}`,
    });
  });

  it('two names with one identifier are two comments', () => {
    const rows = commentRowsFor(target, [
      qdnRow('Ada', ident(DKEY, 'same11'), NOW - 10),
      qdnRow('Bob', ident(DKEY, 'same11'), NOW - 5),
    ]);
    expect(rows).toHaveLength(2);
  });
});

function row(name: string, id: string, postedAt: number, updatedAt = postedAt): CommentRow {
  const identifier = ident(DKEY, id);
  return {
    ref: commentRef(name, identifier),
    name,
    identifier,
    key: DKEY,
    postedAt,
    updatedAt,
    version: updatedAt,
  };
}

function ok(text: string, extra: Partial<CommentRecord> = {}): CommentBody {
  return { status: 'ok', record: { v: 1, key: DKEY, text, ...extra } };
}

describe('missingParents', () => {
  it('asks for the first comment published with each identifier a reply answers', () => {
    const parent = row('Ada', 'parent', 100);
    const copy = row('Copycat', 'parent', 200);
    const reply = row('Bob', 'reply1', 300);
    const bodies = new Map<string, CommentBody>([
      [reply.ref, ok('Agreed', { replyTo: parent.identifier })],
    ]);
    expect(missingParents([reply, copy, parent], bodies)).toEqual([parent]);
    bodies.set(parent.ref, ok('Original'));
    expect(missingParents([reply, copy, parent], bodies)).toEqual([]);
  });
});

describe('resolveHides', () => {
  const comment = ident(DKEY, 'spam11');
  const hide = (name: string, updatedAt: number, hidden: boolean) => ({
    name,
    updatedAt,
    record: { v: 1 as const, commentName: 'Spam', commentIdentifier: comment, hidden },
  });
  const admins = new Set(['Avery Admin', 'Admin B']);

  it('counts Minter Admins only, and the newest record wins', () => {
    const ref = commentRef('Spam', comment);
    expect(resolveHides([hide('Avery Admin', 10, true)], (n) => admins.has(n)).get(ref)).toBe(true);
    expect(resolveHides([hide('Leo Learner', 10, true)], (n) => admins.has(n)).has(ref)).toBe(
      false
    );
    const shownAgain = resolveHides(
      [hide('Avery Admin', 10, true), hide('Admin B', 20, false), hide('Leo Learner', 30, true)],
      (n) => admins.has(n)
    );
    expect(shownAgain.get(ref)).toBe(false);
    // A tie hides.
    expect(
      resolveHides([hide('Admin B', 10, false), hide('Avery Admin', 10, true)], (n) =>
        admins.has(n)
      ).get(ref)
    ).toBe(true);
  });
});

describe('buildThreads', () => {
  const none = new Map<string, boolean>();
  const muted = new Set<string>();

  it('newest first, replies one level deep and oldest first, each reply says whom it answers', () => {
    const a = row('Ada', 'aaaaaa', 100);
    const b = row('Bob', 'bbbbbb', 200);
    const r1 = row('Cy', 'rrrrr1', 300);
    const r2 = row('Dee', 'rrrrr2', 400);
    const bodies = new Map<string, CommentBody>([
      [a.ref, ok('First')],
      [b.ref, ok('Second')],
      [r1.ref, ok('Reply to Ada', { replyTo: a.identifier })],
      [r2.ref, ok('Reply to Cy', { replyTo: r1.identifier })],
    ]);
    const threads = buildThreads({ rows: [r2, r1, b, a], bodies, hides: none, muted });
    expect(threads.map((t) => t.comment.name)).toEqual(['Bob', 'Ada']);
    expect(
      threads[1].replies.map((r) => [r.name, r.replyToName, r.replyToRef, r.replyToExcerpt])
    ).toEqual([
      ['Cy', 'Ada', a.ref, 'First'],
      ['Dee', 'Cy', r1.ref, 'Reply to Ada'],
    ]);
    expect(threads[1].comment.replyToName).toBeNull();
  });

  it('a reply quotes the start of what it answers, on one line, and nothing it wouldn’t show', () => {
    const long = row('Ada', 'aaaaaa', 100);
    const hidden = row('Bob', 'bbbbbb', 200);
    const gone = row('Eve', 'eeeeee', 250);
    const loud = row('Loud', 'llllll', 260);
    const replies = [
      row('Cy', 'rrrrr1', 300),
      row('Cy', 'rrrrr2', 400),
      row('Cy', 'rrrrr3', 500),
      row('Cy', 'rrrrr4', 600),
    ];
    const text = `Line one\n\n  line   two ${'x'.repeat(200)}`;
    const bodies = new Map<string, CommentBody>([
      [long.ref, ok(text)],
      [hidden.ref, ok('Cheap QORT here')],
      [gone.ref, ok('', { deleted: true })],
      [loud.ref, ok('LOUD')],
      [replies[0].ref, ok('a', { replyTo: long.identifier })],
      [replies[1].ref, ok('b', { replyTo: hidden.identifier })],
      [replies[2].ref, ok('c', { replyTo: gone.identifier })],
      [replies[3].ref, ok('d', { replyTo: loud.identifier })],
    ]);
    const threads = buildThreads({
      rows: [...replies, long, hidden, gone, loud],
      bodies,
      hides: new Map([[hidden.ref, true]]),
      muted: new Set(['Loud']),
    });
    const quote = (name: string) =>
      threads.find((t) => t.comment.name === name)?.replies[0]?.replyToExcerpt;
    const first = quote('Ada');
    expect(first).toBe(`Line one line two ${'x'.repeat(140 - 'Line one line two '.length)}…`);
    expect(quote('Bob')).toBeNull();
    expect(quote('Eve')).toBeNull();
    expect(quote('Loud')).toBeNull();
  });

  it('a deleted comment keeps its place and its replies; an invalid one is left out', () => {
    const a = row('Ada', 'aaaaaa', 100, 500_000);
    const r = row('Bob', 'rrrrrr', 200);
    const bad = row('Eve', 'eeeeee', 300);
    const lost = row('Lou', 'llllll', 400);
    const threads = buildThreads({
      rows: [lost, bad, r, a],
      bodies: new Map<string, CommentBody>([
        [a.ref, ok('', { deleted: true })],
        [r.ref, ok('Still readable', { replyTo: a.identifier })],
        [bad.ref, { status: 'invalid' }],
        [lost.ref, { status: 'unavailable' }],
      ]),
      hides: none,
      muted,
    });
    expect(threads.map((t) => [t.comment.name, t.comment.status])).toEqual([
      ['Lou', 'unavailable'],
      ['Ada', 'shown'],
    ]);
    expect(threads[1].comment).toMatchObject({ deleted: true, text: '', edited: false });
    expect(threads[1].replies[0].text).toBe('Still readable');
  });

  it('marks edits, hidden comments and muted names', () => {
    const a = row('Ada', 'aaaaaa', 100_000, 500_000);
    const b = row('Spam', 'bbbbbb', 200_000);
    const threads = buildThreads({
      rows: [b, a],
      bodies: new Map<string, CommentBody>([
        [a.ref, ok('Edited text', { edited: true })],
        [b.ref, ok('Buy now')],
      ]),
      hides: new Map([[b.ref, true]]),
      muted: new Set(['Ada']),
    });
    expect(threads[0].comment).toMatchObject({ name: 'Spam', hidden: true, muted: false });
    expect(threads[1].comment).toMatchObject({
      name: 'Ada',
      edited: true,
      editedAt: 500_000,
      muted: true,
      hidden: false,
    });
  });

  it('a reply whose comment isn’t read stands on its own', () => {
    const r = row('Bob', 'rrrrrr', 200);
    const threads = buildThreads({
      rows: [r],
      bodies: new Map([[r.ref, ok('Orphan', { replyTo: ident(DKEY, 'gone11') })]]),
      hides: none,
      muted,
    });
    expect(threads).toHaveLength(1);
    expect(threads[0].replies).toEqual([]);
  });

  it('a reply goes under the first comment with that identifier, not a later copy', () => {
    const original = row('Ada', 'same11', 100);
    const copy = row('Copycat', 'same11', 150);
    const r = row('Bob', 'rrrrrr', 200);
    const threads = buildThreads({
      rows: [r, copy, original],
      bodies: new Map<string, CommentBody>([
        [original.ref, ok('Original')],
        [copy.ref, ok('Copy')],
        [r.ref, ok('Reply', { replyTo: original.identifier })],
      ]),
      hides: none,
      muted,
    });
    expect(threads.map((t) => [t.comment.name, t.replies.length])).toEqual([
      ['Copycat', 0],
      ['Ada', 1],
    ]);
  });

  it('survives replies that answer each other', () => {
    const a = row('Ada', 'aaaaaa', 100);
    const b = row('Bob', 'bbbbbb', 200);
    const threads = buildThreads({
      rows: [b, a],
      bodies: new Map<string, CommentBody>([
        [a.ref, ok('A', { replyTo: b.identifier })],
        [b.ref, ok('B', { replyTo: a.identifier })],
      ]),
      hides: none,
      muted,
    });
    expect(
      threads
        .flatMap((t) => [t.comment, ...t.replies])
        .map((v) => v.name)
        .sort()
    ).toEqual(['Ada', 'Bob']);
  });

  it('shows what the viewer just published, edited, deleted or hid, until QDN has it', () => {
    const a = row('Ada', 'aaaaaa', 100);
    const mineNew = {
      ref: commentRef('Me', ident(DKEY, 'mine11')),
      name: 'Me',
      identifier: ident(DKEY, 'mine11'),
      key: DKEY,
      record: { v: 1 as const, key: DKEY, text: 'Just posted', replyTo: a.identifier },
      at: 1_000,
    };
    const editA = {
      ref: a.ref,
      name: 'Ada',
      identifier: a.identifier,
      key: DKEY,
      record: { v: 1 as const, key: DKEY, text: 'New words', edited: true as const },
      at: 900,
    };
    const threads = buildThreads({
      rows: [a],
      bodies: new Map([[a.ref, ok('Old words')]]),
      hides: none,
      muted,
      optimistic: [mineNew, editA],
      optimisticHides: new Map([[a.ref, true]]),
    });
    expect(threads).toHaveLength(1);
    expect(threads[0].comment).toMatchObject({
      text: 'New words',
      pending: true,
      edited: true,
      editedAt: 900,
      hidden: true,
    });
    expect(threads[0].replies[0]).toMatchObject({ text: 'Just posted', pending: true });

    // Once QDN has the same version, it isn't pending any more.
    const settled = buildThreads({
      rows: [a],
      bodies: new Map([[a.ref, ok('New words', { edited: true })]]),
      hides: none,
      muted,
      optimistic: [editA],
    });
    expect(settled[0].comment.pending).toBe(false);
  });
});
