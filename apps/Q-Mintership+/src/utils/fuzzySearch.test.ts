import { describe, expect, it } from 'vitest';
import { editDistance, foldText, matchQuery, parseQuery, wordsOf } from './fuzzySearch';

const find = (typed: string, text: string) => matchQuery(parseQuery(typed)!, text);

describe('folding text for search', () => {
  it('ignores case, accents, invisible characters and digit groups', () => {
    expect(foldText('  Crowetic\u2800 ')).toBe('crowetic');
    expect(foldText('Café  Zoë')).toBe('cafe zoe');
    expect(foldText('block 1,371,641 · 1\u00a0371\u00a0641 · 2 100')).toBe(
      'block 1371641 · 1371641 · 2 100'
    );
    expect(foldText('0.01 QORT')).toBe('0.01 qort');
    expect(foldText('\uff31\uff4f\uff52\uff54\uff41\uff4c')).toBe('qortal');
    expect(wordsOf('sent 120 qort to q-maps')).toEqual(['sent', '120', 'qort', 'to', 'q', 'maps']);
  });

  it('reads nothing typed as no search', () => {
    expect(parseQuery('   ')).toBeNull();
    expect(parseQuery(' Crow  120 ')).toEqual({ text: 'Crow  120', words: ['crow', '120'] });
  });
});

describe('edit distance', () => {
  it('counts changes, swaps included, and stops past the limit', () => {
    expect(editDistance('crowetic', 'crowetic', 2)).toBe(0);
    expect(editDistance('crowtic', 'crowetic', 2)).toBe(1);
    expect(editDistance('crowteic', 'crowetic', 2)).toBe(1);
    expect(editDistance('kitten', 'sitting', 3)).toBe(3);
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2);
  });
});

describe('finding typed words', () => {
  it('finds a word typed in part, anywhere, in any case', () => {
    expect(find('crow', 'Paid crowetic 120 QORT')).toBe('match');
    expect(find('WETIC', 'Paid crowetic')).toBe('match');
    expect(find('qcf3cj', 'Got its minting level from Qcf3cJXYhP5')).toBe('match');
    expect(find('1371641', 'block 1,371,641')).toBe('match');
    expect(find('1,371', 'block 1,371,641')).toBe('match');
  });

  it('needs every word typed, in any order', () => {
    expect(find('120 crow', 'Paid crowetic 120 QORT')).toBe('match');
    expect(find('crow 500', 'Paid crowetic 120 QORT')).toBeNull();
  });

  it('finds similar words: one letter off, swapped, missing, or typed in part with a slip', () => {
    expect(find('crowtic', 'Paid crowetic')).toBe('similar');
    expect(find('crowetik', 'Paid crowetic')).toBe('similar');
    expect(find('crowteic', 'Paid crowetic')).toBe('similar');
    expect(find('crowte', 'Paid crowetic')).toBe('similar');
    expect(find('crwet', 'Paid crowetic')).toBe('similar');
    // The letters in order from its first, covering half of it.
    expect(find('crwtc', 'Paid crowetic')).toBe('similar');
    expect(find('ctc', 'Paid crowetic')).toBeNull();
    // Two letters off only from 8 letters on.
    expect(find('kroweitc', 'Paid crowetic')).toBe('similar');
    expect(find('krwt', 'Paid crowetic')).toBeNull();
  });

  it('finds a number from the start of a number only', () => {
    expect(find('60', 'Sent 60 QORT')).toBe('match');
    expect(find('60', 'block 1,364,600')).toBeNull();
    expect(find('1364', 'block 1,364,600')).toBe('match');
    expect(find('5.43', 'Received 5.4321 QORT')).toBe('match');
    expect(find('5', 'Received 10.5 QORT')).toBeNull();
    expect(find('#823', 'group #823')).toBe('match');
  });

  it('finds one or two letters from the start of a word only', () => {
    expect(find('aa ma', 'holds AA Maps')).toBe('match');
    expect(find('ma', 'QaaMarb7 paid')).toBeNull();
    expect(find('q', 'paid 5 QORT')).toBe('match');
  });

  it('is exact for numbers and short words', () => {
    expect(find('121', 'Paid 120 QORT')).toBeNull();
    expect(find('bpb', 'Paid bob')).toBeNull();
    expect(find('bob', 'Paid bob')).toBe('match');
  });

  it('is similar when any word typed is only similar', () => {
    expect(find('crowtic 120', 'Paid crowetic 120 QORT')).toBe('similar');
  });

  it('finds a name written with a blank Braille character by its letters', () => {
    expect(find('crowetic', 'Paid crowetic\u2800')).toBe('match');
  });
});
