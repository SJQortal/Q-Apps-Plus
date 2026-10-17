import { describe, expect, it } from 'vitest';
import { countableBlocks, firstRoundAfter, onlineShare, percentWords } from './onlineShare';

describe('countableBlocks', () => {
  it('counts one per block before the reward rounds, then 1,000 a round', () => {
    // Magic Ink on 2026-10-17: a first share in block 609,585, the chain at 2,763,524.
    expect(countableBlocks(609_585, 2_763_524)).toBe(898_415 + 1_255_000);
    // A first share in block 2,345,646: rounds 2,346,000 to 2,763,000.
    expect(countableBlocks(2_345_646, 2_763_524)).toBe(418_000);
    // On a round's own block.
    expect(countableBlocks(2_345_000, 2_346_000)).toBe(1_000);
    expect(countableBlocks(1_507_990, 1_508_000)).toBe(10);
    expect(countableBlocks(1_507_990, 1_509_000)).toBe(1_010);
    expect(countableBlocks(2_345_646, 2_345_999)).toBe(0);
    expect(countableBlocks(10, 5)).toBe(0);
  });

  it('says when the first round comes', () => {
    expect(firstRoundAfter(2_345_646)).toBe(2_346_000);
    expect(firstRoundAfter(2_346_000)).toBe(2_347_000);
    expect(firstRoundAfter(100)).toBe(101);
  });
});

describe('onlineShare', () => {
  const start = (height: number) => ({ firstShare: { height, timestamp: 1 }, moved: null });

  it('is the blocks minted over the rewards it could have had', () => {
    const share = onlineShare(400_000, start(2_345_646), 2_763_524);
    expect(share.kind).toBe('share');
    expect(share.kind === 'share' && share.percent).toBeCloseTo(95.69, 1);
    expect(onlineShare(2_000_000, start(2_345_646), 2_763_524)).toMatchObject({ percent: 100 });
  });

  it('says when there is nothing to work it out from', () => {
    expect(onlineShare(0, { firstShare: null, moved: null }, 100)).toEqual({ kind: 'never' });
    expect(onlineShare(0, start(2_345_646), 2_345_900)).toEqual({
      kind: 'soon',
      first: 2_345_646,
      round: 2_346_000,
    });
    expect(onlineShare(5, { firstShare: null, moved: { height: 7, away: true } }, 100)).toEqual({
      kind: 'moved',
      height: 7,
      to: true,
    });
  });

  it('says the share in words', () => {
    expect(percentWords(95.69)).toBe('96%');
    expect(percentWords(99.7)).toBe('over 99%');
    expect(percentWords(100)).toBe('100%');
    expect(percentWords(0.4)).toBe('under 1%');
    expect(percentWords(0)).toBe('0%');
  });
});
