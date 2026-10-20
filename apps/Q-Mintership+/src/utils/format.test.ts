import { describe, expect, it } from 'vitest';
import { blockNumber, formatRoughDuration, formatTimeSpan, sentenceStart } from './format';

const DAY = 86_400_000;

describe('formatRoughDuration', () => {
  it('says days up to eight weeks, then months, then years and months', () => {
    expect(formatRoughDuration(22 * DAY)).toBe('22 days');
    expect(formatRoughDuration(55 * DAY)).toBe('55 days');
    expect(formatRoughDuration(90 * DAY)).toBe('3 months');
    expect(formatRoughDuration(365 * DAY)).toBe('1 year');
    expect(formatRoughDuration(457 * DAY)).toBe('1 year 3 months');
    expect(formatRoughDuration(800 * DAY)).toBe('2 years 2 months');
  });
});

describe('formatTimeSpan', () => {
  it('says a span within a day by its hours, across days by its dates', () => {
    const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).getTime();
    expect(formatTimeSpan(at(16, 21, 36), at(16, 21, 55))).toBe('16 Oct 2026, 21:36–21:55');
    expect(formatTimeSpan(at(16, 21, 36), at(16, 21, 36))).toBe('16 Oct 2026, 21:36');
    expect(formatTimeSpan(at(7, 9, 0), at(2, 9, 0))).toBe('2 Oct 2026 – 7 Oct 2026');
  });
});

describe('blockNumber', () => {
  it('reads a block number with the separators people type, as the app shows it', () => {
    for (const text of [
      '1519621',
      '1,519,621',
      ' 1 519 621 ',
      '1.519.621',
      "1'519'621",
      '1\u00a0519\u00a0621',
      '1\u202f519\u202f621',
      'block 1,519,621',
      'Block 1519621',
      '#1,519,621',
    ])
      expect(blockNumber(text), text).toBe(1_519_621);
    expect(blockNumber('621')).toBe(621);
  });

  it('turns down what isn’t one', () => {
    for (const text of [
      '',
      '0',
      '0,000',
      '1.5',
      '1,51,9621',
      '15,19621',
      'abc',
      '-5',
      '1e6',
      '1,234,567,890',
    ])
      expect(blockNumber(text), text).toBeNull();
  });
});

describe('sentenceStart', () => {
  it('capitalises the first letter only, and leaves a name as it is', () => {
    expect(sentenceStart('the original app')).toBe('The original app');
    expect(sentenceStart('original-app')).toBe('Original-app');
    expect(sentenceStart('Q-Mintership 3')).toBe('Q-Mintership 3');
    expect(sentenceStart('')).toBe('');
  });
});
