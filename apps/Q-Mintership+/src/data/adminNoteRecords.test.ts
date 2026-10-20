import { describe, expect, it } from 'vitest';
import {
  ADMIN_NOTE_MAX,
  adminCommentSearchPrefix,
  adminNoteIdentifier,
  adminNoteTextProblems,
  buildAdminComment,
  buildAdminNote,
  buildDeletedAdminComment,
  isAnyCommentIdentifier,
  newAdminCommentIdentifier,
  parseAdminComment,
  parseAdminCommentIdentifier,
  parseAdminNote,
  parseAdminNoteIdentifier,
} from './adminNoteRecords';
import { parseComment } from './commentRecords';

// A decision's key (40 base58 characters) and a nominee's address.
const KEY = '5YiHUjTEhQwUZm9oHyyqy3L8gGRVpTxNPsaLSPxSJw2Ab';
const DECISION = KEY.slice(0, 40);
const NOMINEE = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';

describe('identifiers', () => {
  it('a note is one identifier per key; a comment carries 6 letters or digits', () => {
    expect(adminNoteIdentifier(DECISION)).toBe(`qmp-adminnote-${DECISION}`);
    expect(adminNoteIdentifier(NOMINEE)).toBe(`qmp-adminnote-${NOMINEE}`);
    expect(newAdminCommentIdentifier(DECISION, 'abc123')).toBe(`qmp-macomment-${DECISION}-abc123`);
    expect(newAdminCommentIdentifier(DECISION)).toMatch(
      new RegExp(`^qmp-macomment-${DECISION}-[a-z0-9]{6}$`)
    );
    expect(adminCommentSearchPrefix(NOMINEE)).toBe(`qmp-macomment-${NOMINEE}-`);
    // Within QDN's 64 characters.
    expect(newAdminCommentIdentifier(DECISION, 'abc123').length).toBeLessThanOrEqual(64);
    expect(() => adminNoteIdentifier('not-a-key')).toThrow(/decision or a nomination/);
    expect(() => newAdminCommentIdentifier(DECISION, 'ab')).toThrow(/6 letters/);
  });

  it('parses only its own prefix', () => {
    expect(parseAdminNoteIdentifier(`qmp-adminnote-${DECISION}`)).toEqual({ key: DECISION });
    expect(parseAdminNoteIdentifier(`qmp-adminnote-${DECISION}-x`)).toBeNull();
    expect(parseAdminCommentIdentifier(`qmp-macomment-${NOMINEE}-abc123`)).toEqual({
      key: NOMINEE,
      id: 'abc123',
    });
    expect(parseAdminCommentIdentifier(`qmp-comment-${NOMINEE}-abc123`)).toBeNull();
    expect(isAnyCommentIdentifier(`qmp-comment-${NOMINEE}-abc123`)).toBe(true);
    expect(isAnyCommentIdentifier(`qmp-macomment-${NOMINEE}-abc123`)).toBe(true);
    expect(isAnyCommentIdentifier(`qmp-adminnote-${NOMINEE}`)).toBe(false);
  });
});

describe('the note (pinned)', () => {
  it('{ v: 1, key, text } in plain trimmed text; edited marks a new version', () => {
    expect(
      buildAdminNote({ key: DECISION, text: '  Asked them twice.\r\n\n\n\nNo answer.  ' })
    ).toEqual({ v: 1, key: DECISION, text: 'Asked them twice.\n\nNo answer.' });
    expect(buildAdminNote({ key: NOMINEE, text: 'x', edited: true })).toEqual({
      v: 1,
      key: NOMINEE,
      text: 'x',
      edited: true,
    });
    expect(() => buildAdminNote({ key: DECISION, text: '   ' })).toThrow(/Write something/);
    expect(adminNoteTextProblems('a'.repeat(ADMIN_NOTE_MAX + 1))[0]).toMatch(/2,000/);
  });

  it('reads back only a valid note for its own identifier', () => {
    const id = adminNoteIdentifier(DECISION);
    const record = buildAdminNote({ key: DECISION, text: 'Offline since March.' });
    expect(parseAdminNote(record, id)).toEqual(record);
    expect(parseAdminNote({ ...record, key: NOMINEE }, id)).toBeNull();
    expect(parseAdminNote({ ...record, v: 2 }, id)).toBeNull();
    expect(parseAdminNote({ ...record, edited: 'yes' }, id)).toBeNull();
    expect(parseAdminNote({ ...record, text: '' }, id)).toBeNull();
    expect(parseAdminNote(record, `qmp-comment-${DECISION}-abc123`)).toBeNull();
  });
});

describe('a comment for the Minter Admins (pinned)', () => {
  const id = `qmp-macomment-${DECISION}-abc123`;

  it('has a public comment’s shape, and may answer either kind', () => {
    const reply = buildAdminComment({
      key: DECISION,
      text: ' Checked their payments. ',
      replyTo: `qmp-comment-${DECISION}-zzz999`,
    });
    expect(reply).toEqual({
      v: 1,
      key: DECISION,
      text: 'Checked their payments.',
      replyTo: `qmp-comment-${DECISION}-zzz999`,
    });
    expect(
      buildAdminComment({ key: DECISION, text: 'x', replyTo: `qmp-macomment-${DECISION}-aaa111` })
        .replyTo
    ).toBe(`qmp-macomment-${DECISION}-aaa111`);
    expect(() =>
      buildAdminComment({ key: DECISION, text: 'x', replyTo: 'qmp-adminnote-x' })
    ).toThrow(/nothing to answer/);
    expect(buildDeletedAdminComment({ key: DECISION })).toEqual({
      v: 1,
      key: DECISION,
      text: '',
      deleted: true,
    });
  });

  it('reads back for its own identifier only; a public comment can’t answer one', () => {
    const record = buildAdminComment({ key: DECISION, text: 'Worth asking them.' });
    expect(parseAdminComment(record, id)).toEqual(record);
    expect(parseAdminComment(record, `qmp-comment-${DECISION}-abc123`)).toBeNull();
    expect(parseAdminComment({ ...record, replyTo: id }, id)).toBeNull();
    expect(parseAdminComment({ v: 1, key: DECISION, text: '', deleted: true }, id)).toEqual({
      v: 1,
      key: DECISION,
      text: '',
      deleted: true,
    });
    // The public parser never takes a reply to one for the Minter Admins.
    expect(
      parseComment(
        { v: 1, key: DECISION, text: 'x', replyTo: id },
        `qmp-comment-${DECISION}-xyz789`
      )
    ).toBeNull();
  });
});
