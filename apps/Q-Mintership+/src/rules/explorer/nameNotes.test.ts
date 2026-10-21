import { describe, expect, it } from 'vitest';
import { invisibleCount, nameNotes, visibleName } from './nameNotes';

const OWNER = 'QZtxTabcdefghijkmnopqrstuvwxyzuY3k';

describe('nameNotes', () => {
  it('has nothing to say about an ordinary name', () => {
    expect(nameNotes('Simon James', OWNER)).toEqual([]);
    expect(nameNotes('Ünïcode Ñame', OWNER)).toEqual([]);
  });

  it('notes names written like an address', () => {
    expect(nameNotes('QMLmsx5abcdefghijkmnopqrstuvwxy', OWNER).map((n) => n.kind)).toEqual([
      'addressLike',
    ]);
    expect(nameNotes('QZtx...uY3k', OWNER)[0].text).toBe('This name is written like an address.');
    expect(nameNotes('Qab…xyz', OWNER)[0].kind).toBe('addressLike');
  });

  it('notes a name that starts or ends like its owner’s address, ignoring case', () => {
    expect(nameNotes('qztxt-fan', OWNER).map((n) => n.text)).toEqual([
      "This name starts with the same characters as its owner's address (QZtxT…).",
    ]);
    expect(nameNotes('club zuy3k', OWNER).map((n) => n.kind)).toEqual(['ownerSuffix']);
  });

  it('counts characters a reader cannot see', () => {
    const braille = '\u2800...?...\u2800';
    expect(invisibleCount(braille)).toBe(2);
    expect(nameNotes(braille, OWNER).map((n) => n.text)).toEqual([
      'This name contains 2 invisible or blank characters.',
    ]);
    expect(nameNotes('a\u200Bb', OWNER)[0].text).toBe(
      'This name contains an invisible or blank character.'
    );
    expect(nameNotes('two words', OWNER)).toEqual([]);
  });

  it('shows invisible characters as dots', () => {
    expect(visibleName('\u2800\u2800')).toBe('··');
    expect(visibleName('a\u200Bb')).toBe('a·b');
    expect(visibleName('Ada')).toBe('Ada');
  });
});
