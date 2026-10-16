import { describe, expect, it } from 'vitest';
import { hasBrailleBlank, markedNameNote } from './markedName';

const BLANK = String.fromCharCode(0x2800);

describe('hasBrailleBlank', () => {
  it('finds the blank Braille character anywhere in a name', () => {
    expect(hasBrailleBlank(`Ada${BLANK}`)).toBe(true);
    expect(hasBrailleBlank(`${BLANK}Ada`)).toBe(true);
    expect(hasBrailleBlank(`A${BLANK}da`)).toBe(true);
    expect(hasBrailleBlank(BLANK.repeat(3))).toBe(true);
  });

  it('leaves every other name alone, spaces and other Braille included', () => {
    expect(hasBrailleBlank('Ada')).toBe(false);
    expect(hasBrailleBlank('Ada Lovelace')).toBe(false);
    expect(hasBrailleBlank(String.fromCharCode(0x2801))).toBe(false);
    expect(hasBrailleBlank('')).toBe(false);
    expect(hasBrailleBlank(null)).toBe(false);
    expect(hasBrailleBlank(undefined)).toBe(false);
  });

  it('survives the short-address fallback: a trimmed name keeps the character', () => {
    expect(`Ada${BLANK}`.trim()).toBe(`Ada${BLANK}`);
  });
});

describe('markedNameNote', () => {
  it('says it in words where a name can’t be crossed out', () => {
    expect(markedNameNote(`Ada${BLANK}`)).toBe(' (written with a blank Braille character)');
    expect(markedNameNote('Ada')).toBe('');
  });
});
