import { describe, expect, it } from 'vitest';
import { offersLine, shareText } from './tradesWords';

/** The words as read: the space before % never breaks the line. */
const share = (part: bigint, whole: bigint) => shareText(part, whole).replace('\u00a0', ' ');

describe('a coin’s share', () => {
  it('in whole percent, with a decimal below 10 % and near all of it, never 100 % for less', () => {
    expect(share(13_567n, 18_820n)).toBe('72 %');
    expect(share(4_535n, 188_205n)).toBe('2.4 %');
    expect(share(138_942n, 139_192n)).toBe('99.8 %');
    expect(share(999_950n, 1_000_000n)).toBe('over 99.9 %');
    expect(share(5n, 5n)).toBe('100 %');
    expect(share(1n, 10_000n)).toBe('under 0.1 %');
    expect(share(0n, 10n)).toBe('0 %');
  });
});

describe('the offers in a line', () => {
  it('names the states it has, in order', () => {
    expect(offersLine({ made: 4, completed: 3, ended: 0, open: 1, openQort: 0n })).toBe(
      '3 completed · 1 open'
    );
    expect(offersLine({ made: 0, completed: 0, ended: 0, open: 0, openQort: 0n })).toBe('none yet');
  });
});
