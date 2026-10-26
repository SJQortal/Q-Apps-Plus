import { describe, expect, it } from 'vitest';
import { offersLine, shareText } from './tradesWords';

describe('a coin’s share', () => {
  it('in whole percent, with a decimal below 10 % and near all of it, never 100 % for less', () => {
    expect(shareText(13_567n, 18_820n)).toBe('72 %');
    expect(shareText(4_535n, 188_205n)).toBe('2.4 %');
    expect(shareText(138_942n, 139_192n)).toBe('99.8 %');
    expect(shareText(999_950n, 1_000_000n)).toBe('over 99.9 %');
    expect(shareText(5n, 5n)).toBe('100 %');
    expect(shareText(1n, 10_000n)).toBe('under 0.1 %');
    expect(shareText(0n, 10n)).toBe('0 %');
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
