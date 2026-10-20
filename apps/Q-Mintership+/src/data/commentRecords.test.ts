import { describe, expect, it } from 'vitest';
import { fakeAddress, fakeKey } from '../../e2e/world.mjs';
import {
  COMMENT_MAX,
  buildComment,
  buildDeletedComment,
  buildHide,
  commentKeyKind,
  commentLinks,
  commentRef,
  commentSearchPrefix,
  commentTextProblems,
  decisionCommentKey,
  hideIdentifier,
  hideSearchPrefix,
  isCommentKey,
  newCommentIdentifier,
  nominationCommentKey,
  normaliseCommentText,
  parseComment,
  parseCommentIdentifier,
  parseHide,
  parseHideIdentifier,
  randomCommentId,
} from './commentRecords';

const NOMINEE = fakeAddress('comment-nominee');
const SIG = fakeKey('comment-decision', 64);
const DKEY = decisionCommentKey(SIG);
const id = (key: string, suffix = 'abc123') => `qmp-comment-${key}-${suffix}`;

describe('comment keys', () => {
  it('a decision is the first 40 characters of its signature; a nomination its nominee', () => {
    expect(SIG.length).toBeGreaterThan(80);
    expect(DKEY).toBe(SIG.slice(0, 40));
    expect(commentKeyKind(DKEY)).toBe('decision');
    expect(nominationCommentKey(NOMINEE)).toBe(NOMINEE);
    expect(commentKeyKind(NOMINEE)).toBe('nomination');
  });

  it('refuses anything else', () => {
    for (const bad of [
      '',
      SIG,
      DKEY.slice(0, 39),
      `${DKEY.slice(0, 39)}0`, // 0 isn't base58
      `${DKEY.slice(0, 39)}-`,
      NOMINEE.slice(1),
      `X${NOMINEE.slice(1)}`, // 34 base58 characters, but not an address
      42,
      null,
    ]) {
      expect(isCommentKey(bad)).toBe(false);
    }
  });

  it('search prefixes end in a dash, so a key never matches a longer one', () => {
    expect(commentSearchPrefix(NOMINEE)).toBe(`qmp-comment-${NOMINEE}-`);
    expect(hideSearchPrefix(DKEY)).toBe(`qmp-hide-${DKEY}-`);
  });
});

describe('comment identifiers', () => {
  it('are qmp-comment-<key>-<6 characters>, within QDN’s 64', () => {
    const forDecision = newCommentIdentifier(DKEY, 'x1y2z3');
    expect(forDecision).toBe(`qmp-comment-${DKEY}-x1y2z3`);
    expect(forDecision.length).toBe(59);
    expect(newCommentIdentifier(NOMINEE, 'aaaaaa').length).toBe(53);
    expect(parseCommentIdentifier(forDecision)).toEqual({ key: DKEY, id: 'x1y2z3' });
    expect(parseCommentIdentifier(id(NOMINEE, 'AbC123'))).toEqual({ key: NOMINEE, id: 'AbC123' });
  });

  it('refuses malformed ones', () => {
    for (const bad of [
      `qmp-comment-${DKEY}-abc12`,
      `qmp-comment-${DKEY}-abc1234`,
      `qmp-comment-${DKEY}-abc_12`,
      `qmp-comment-${DKEY}abc123`,
      `qmp-comment-${SIG}-abc123`,
      `qmp-hide-${DKEY}-abc123`,
      `qmp-comment-not-an-address-abc123`,
      `QMP-COMMENT-${DKEY}-abc123`,
      undefined,
    ]) {
      expect(parseCommentIdentifier(bad)).toBeNull();
    }
    expect(() => newCommentIdentifier('nope', 'abc123')).toThrow();
    expect(() => newCommentIdentifier(DKEY, 'ab-123')).toThrow();
  });

  it('random ids are 6 lowercase letters or digits, unbiased (bytes ≥ 252 skipped)', () => {
    expect(randomCommentId()).toMatch(/^[a-z0-9]{6}$/);
    expect(randomCommentId()).not.toBe(randomCommentId());
    let call = 0;
    const fixed = (bytes: Uint8Array) => {
      call += 1;
      // First call: two bytes below 252 (0 → a, 35 → 9); the rest are skipped.
      bytes.fill(call === 1 ? 255 : 36);
      if (call === 1) {
        bytes[0] = 0;
        bytes[1] = 35;
      }
      return bytes;
    };
    expect(randomCommentId(fixed)).toBe('a9aaaa');
    expect(call).toBe(2);
  });

  it('a hide identifier is stable per comment, and differs between comments', () => {
    const a = hideIdentifier(DKEY, 'Nora Nominator', id(DKEY));
    expect(a).toMatch(new RegExp(`^qmp-hide-${DKEY}-[a-z0-9]{6}$`));
    expect(a.length).toBeLessThanOrEqual(64);
    expect(hideIdentifier(DKEY, 'Nora Nominator', id(DKEY))).toBe(a);
    expect(hideIdentifier(DKEY, 'Leo Learner', id(DKEY))).not.toBe(a);
    expect(hideIdentifier(DKEY, 'Nora Nominator', id(DKEY, 'zzz999'))).not.toBe(a);
    expect(parseHideIdentifier(a)?.key).toBe(DKEY);
    expect(parseHideIdentifier(id(DKEY))).toBeNull();
    expect(() => hideIdentifier('nope', 'a', id(DKEY))).toThrow();
  });

  it('a ref names one comment by publisher and identifier', () => {
    expect(commentRef('Ada', id(DKEY))).toBe(`Ada\n${id(DKEY)}`);
    expect(commentRef('Ada', id(DKEY))).not.toBe(commentRef('Ad', `a${id(DKEY)}`));
  });
});

describe('comment text', () => {
  it('is plain text: line breaks kept, control and bidi override characters dropped', () => {
    expect(normaliseCommentText('  Hi\r\nthere  \r\n\r\n\r\n\r\nbye ‮\u0007 ')).toBe(
      'Hi\nthere\n\nbye'
    );
    expect(normaliseCommentText('<b>not</b> HTML')).toBe('<b>not</b> HTML');
  });

  it('says what is wrong in plain words', () => {
    expect(commentTextProblems('   ')).toEqual(['Write something first.']);
    expect(commentTextProblems('x'.repeat(COMMENT_MAX))).toEqual([]);
    expect(commentTextProblems('x'.repeat(COMMENT_MAX + 1))).toEqual([
      'Keep it under 1,000 characters.',
    ]);
    expect(commentTextProblems(`  ${'x'.repeat(COMMENT_MAX)}\n\n`)).toEqual([]);
  });

  it('finds qortal:// links once each, at most 5, without trailing punctuation', () => {
    expect(
      commentLinks(
        'See qortal://APP/Q-Tube/channel/Ada, and qortal://APP/Q-Tube/channel/Ada. Also (qortal://WEBSITE/Ada). https://example.com'
      )
    ).toEqual(['qortal://APP/Q-Tube/channel/Ada', 'qortal://WEBSITE/Ada']);
    const many = Array.from({ length: 7 }, (_, i) => `qortal://APP/A${i}`).join(' ');
    expect(commentLinks(many)).toHaveLength(5);
    expect(commentLinks(`qortal://APP/${'x'.repeat(400)}`)).toEqual([]);
    expect(commentLinks('no links here')).toEqual([]);
  });
});

describe('parseComment', () => {
  const ident = id(DKEY);
  const ok = { v: 1, key: DKEY, text: 'A good minter.' };

  it('accepts a valid comment, a reply, an edit and a deletion', () => {
    expect(parseComment(ok, ident)).toEqual(ok);
    const replyTo = id(DKEY, 'parent');
    expect(parseComment({ ...ok, replyTo, edited: true, extra: 'ignored' }, ident)).toEqual({
      ...ok,
      replyTo,
      edited: true,
    });
    expect(parseComment({ v: 1, key: DKEY, text: '', deleted: true, replyTo }, ident)).toEqual({
      v: 1,
      key: DKEY,
      text: '',
      deleted: true,
      replyTo,
    });
    // A deletion drops any text it still carries.
    expect(parseComment({ ...ok, deleted: true }, ident)?.text).toBe('');
  });

  it('a reply may answer a comment under another key (a nomination before its first approval)', () => {
    const replyTo = id(NOMINEE, 'parent');
    expect(parseComment({ ...ok, replyTo }, ident)?.replyTo).toBe(replyTo);
  });

  it('refuses malformed bodies', () => {
    const bad: unknown[] = [
      null,
      'text',
      [ok],
      { ...ok, v: 2 },
      { ...ok, key: NOMINEE },
      { ...ok, text: '' },
      { ...ok, text: '  \n ' },
      { ...ok, text: 'x'.repeat(COMMENT_MAX + 1) },
      { ...ok, text: 42 },
      { v: 1, key: DKEY },
      { ...ok, replyTo: 'qmp-comment-nope' },
      { ...ok, replyTo: ident },
      { ...ok, edited: 'yes' },
      { ...ok, deleted: false },
    ];
    for (const body of bad) expect(parseComment(body, ident)).toBeNull();
    expect(parseComment(ok, `qmp-comment-${DKEY}-bad`)).toBeNull();
    expect(parseComment(ok, hideIdentifier(DKEY, 'a', ident))).toBeNull();
  });

  it('cleans the text it shows', () => {
    expect(parseComment({ ...ok, text: ' Hi\r\n\r\n\r\nthere‮ ' }, ident)?.text).toBe(
      'Hi\n\nthere'
    );
  });
});

describe('parseHide', () => {
  const comment = id(DKEY);
  const ident = hideIdentifier(DKEY, 'Spam Name', comment);
  const ok = { v: 1, commentName: 'Spam Name', commentIdentifier: comment, hidden: true };

  it('accepts hiding and showing again', () => {
    expect(parseHide(ok, ident)).toEqual({ ...ok, key: DKEY });
    expect(parseHide({ ...ok, hidden: false }, ident)?.hidden).toBe(false);
  });

  it('refuses a hide for a comment under another key, or a malformed one', () => {
    const bad: unknown[] = [
      null,
      { ...ok, v: 2 },
      { ...ok, hidden: 'true' },
      { ...ok, commentName: '' },
      { ...ok, commentName: 'x'.repeat(41) },
      { ...ok, commentIdentifier: id(NOMINEE) },
      { ...ok, commentIdentifier: 'qmp-comment-x' },
    ];
    for (const body of bad) expect(parseHide(body, ident)).toBeNull();
    expect(parseHide(ok, comment)).toBeNull();
  });
});

describe('builders', () => {
  it('build a comment, a reply and an edit', () => {
    expect(buildComment({ key: NOMINEE, text: '  Hello\r\nthere ' })).toEqual({
      v: 1,
      key: NOMINEE,
      text: 'Hello\nthere',
    });
    const replyTo = id(NOMINEE, 'parent');
    expect(buildComment({ key: DKEY, text: 'Yes', replyTo, edited: true })).toEqual({
      v: 1,
      key: DKEY,
      text: 'Yes',
      replyTo,
      edited: true,
    });
    expect(buildComment({ key: DKEY, text: 'Yes', replyTo: null })).not.toHaveProperty('replyTo');
  });

  it('refuse an empty or long text, a bad key or a reply to nothing', () => {
    expect(() => buildComment({ key: DKEY, text: ' ' })).toThrow('Write something first.');
    expect(() => buildComment({ key: DKEY, text: 'x'.repeat(1001) })).toThrow(/1,000/);
    expect(() => buildComment({ key: 'nope', text: 'Hi' })).toThrow();
    expect(() => buildComment({ key: DKEY, text: 'Hi', replyTo: 'x' })).toThrow();
  });

  it('a deletion keeps the key and the reply link only', () => {
    expect(buildDeletedComment({ key: DKEY, replyTo: id(DKEY, 'parent') })).toEqual({
      v: 1,
      key: DKEY,
      text: '',
      deleted: true,
      replyTo: id(DKEY, 'parent'),
    });
    expect(buildDeletedComment({ key: DKEY })).not.toHaveProperty('replyTo');
    expect(() => buildDeletedComment({ key: 'x' })).toThrow();
  });

  it('a hide names the comment by publisher and identifier', () => {
    expect(
      buildHide({ commentName: 'Spam Name', commentIdentifier: id(DKEY), hidden: true })
    ).toEqual({ v: 1, commentName: 'Spam Name', commentIdentifier: id(DKEY), hidden: true });
    expect(() =>
      buildHide({ commentName: '', commentIdentifier: id(DKEY), hidden: true })
    ).toThrow();
    expect(() => buildHide({ commentName: 'A', commentIdentifier: 'x', hidden: true })).toThrow();
  });

  it('round-trip through the parsers', () => {
    const ident = newCommentIdentifier(DKEY);
    const record = buildComment({ key: DKEY, text: 'Round trip', replyTo: id(DKEY, 'parent') });
    expect(parseComment(JSON.parse(JSON.stringify(record)), ident)).toEqual(record);
    const hide = buildHide({ commentName: 'Ada', commentIdentifier: ident, hidden: false });
    expect(parseHide(hide, hideIdentifier(DKEY, 'Ada', ident))).toEqual({ ...hide, key: DKEY });
  });
});
