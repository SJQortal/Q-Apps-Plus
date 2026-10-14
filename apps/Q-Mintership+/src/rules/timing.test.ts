import { describe, expect, it } from 'vitest';
import {
  blocksUntilExpiry,
  decisionWindow,
  signatureBlocksLeft,
  waitingWindowBlocks,
  windowPhase,
} from './timing';

const MINTER = { minimumBlockDelay: 5, maximumBlockDelay: 10080 };

describe('decisionWindow (Core Block.processGroupApprovalTransactions)', () => {
  it('MINTER: earliest decision h+6, last useful signature h+10079, last decision h+10080, expiry h+10081', () => {
    const w = decisionWindow(2750075, MINTER);
    expect(w.earliestDecisionHeight).toBe(2750081);
    expect(w.lastUsefulSignatureHeight).toBe(2760154);
    expect(w.lastDecisionHeight).toBe(2760155);
    // The live pending ADD_GROUP_ADMIN at 2750075 expires at 2760156 (verdict.md §2).
    expect(w.expiresAtHeight).toBe(2760156);
  });

  it('matches the live invite that was approved the block after its 8th signature', () => {
    // QkBFcwzn… confirmed at 2750698, 8th approval at 2751961, APPROVED at 2751962.
    const w = decisionWindow(2750698, MINTER);
    expect(2751961).toBeLessThanOrEqual(w.lastUsefulSignatureHeight);
    expect(2751962).toBeGreaterThanOrEqual(w.earliestDecisionHeight);
  });

  it('matches the live expiries at exactly +10081', () => {
    for (const h of [2713574, 2657801, 2601773]) {
      expect(decisionWindow(h, MINTER).expiresAtHeight - h).toBe(10081);
    }
  });
});

describe('windowPhase and blocks left', () => {
  const w = decisionWindow(1000, MINTER);

  it('is early until the minimum delay has passed', () => {
    // Tip 1000: the next block is 1001, earliest decision is 1006.
    expect(windowPhase(w, 1000)).toBe('early');
    expect(windowPhase(w, 1004)).toBe('early');
    expect(windowPhase(w, 1005)).toBe('open');
  });

  it('stays open while a new signature can land at or before h+10079', () => {
    // Tip 11078: a signature lands in 11079 = h+10079, the last useful block.
    expect(windowPhase(w, 11078)).toBe('open');
    expect(signatureBlocksLeft(w, 11078)).toBe(1);
  });

  it('is too late once the next block is the last decision block', () => {
    expect(windowPhase(w, 11079)).toBe('tooLate');
    expect(signatureBlocksLeft(w, 11079)).toBe(0);
  });

  it('is expired once the next block is the expiry block', () => {
    expect(windowPhase(w, 11080)).toBe('expired');
    expect(windowPhase(w, 20000)).toBe('expired');
    expect(blocksUntilExpiry(w, 11080)).toBe(1);
    expect(blocksUntilExpiry(w, 11081)).toBe(0);
  });

  it('counts the waiting window for unsigned nominations in blocks', () => {
    expect(waitingWindowBlocks(MINTER)).toBe(10080);
  });
});
