/**
 * Levels: Core keeps each account's level; these helpers measure how far an
 * account is from the next one, in blocks minted.
 */
import { CUMULATIVE_BLOCKS_BY_LEVEL } from '../data/constants';
import type { AccountInfo } from '../data/types';

/** Blocks minted as Core counts them for levels (adjustment and penalty included). */
export function effectiveBlocksMinted(
  account: Pick<AccountInfo, 'blocksMinted' | 'blocksMintedAdjustment' | 'blocksMintedPenalty'>
): number {
  return account.blocksMinted + account.blocksMintedAdjustment + account.blocksMintedPenalty;
}

export interface LevelProgress {
  level: number;
  /** Total blocks needed for the next level, or null at the top. */
  nextLevelAt: number | null;
  blocksToNextLevel: number | null;
  /** Blocks still needed to reach `target` (0 when reached). */
  blocksToTarget: number;
  /** 0–1 progress towards `target` from zero. */
  targetProgress: number;
}

/**
 * Where an account stands against the cumulative level table. Core keeps the
 * account's `level` itself; this only measures the distance in blocks.
 */
export function levelProgress(
  level: number,
  effectiveBlocks: number,
  targetLevel = 5
): LevelProgress {
  const nextLevelAt =
    level < CUMULATIVE_BLOCKS_BY_LEVEL.length ? CUMULATIVE_BLOCKS_BY_LEVEL[level] : null;
  const targetAt = CUMULATIVE_BLOCKS_BY_LEVEL[Math.max(0, targetLevel - 1)];
  const blocks = Math.max(0, effectiveBlocks);
  return {
    level,
    nextLevelAt,
    blocksToNextLevel: nextLevelAt === null ? null : Math.max(0, nextLevelAt - blocks),
    blocksToTarget: level >= targetLevel ? 0 : Math.max(0, targetAt - blocks),
    targetProgress: level >= targetLevel ? 1 : Math.min(1, blocks / targetAt),
  };
}
