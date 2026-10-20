/**
 * How much of the time an account's node was online for minting (Simon,
 * 2026-10-17: "in minter profiles you can also show the % of the node
 * online"), from Qortal's own count.
 *
 * Core adds to an account's blocks minted for every reward it is online
 * for, as the minter or the recipient of a reward share: one per block up
 * to block 1,508,000, then 1,000 at each reward round (every 1,000th
 * block), for the accounts online in one of the 25 blocks before it
 * (Block.increaseAccountLevels). So its blocks minted, over the rewards it
 * could have had since its first reward share, is the share of them it was
 * online for. Since block 1,945,900 only minting under a MINTER member's
 * reward share counts.
 *
 * When a minting level moved away (TRANSFER_PRIVS), it can't be worked out
 * here: the count went with it. When it moved here, Core added the sender's
 * blocks minted to this account's, so the share is over the rewards the
 * level could have had on every account it was on (lineageShare; Simon,
 * 2026-10-20).
 */

/** The last block rewarded on its own; from the next 1,000th block on, rewards come in rounds. */
export const REWARD_ROUNDS_FROM = 1_508_000;
export const REWARD_ROUND = 1_000;
/** From this block on, only minting under a MINTER member's reward share is counted. */
export const MEMBERS_ONLY_FROM = 1_945_900;

/**
 * The blocks minted an account online for every reward could have gained
 * after block `first` (its first reward share) up to `tip`.
 */
export function countableBlocks(first: number, tip: number): number {
  if (tip <= first) return 0;
  const single = Math.max(0, Math.min(tip, REWARD_ROUNDS_FROM) - first);
  const from = Math.max(first, REWARD_ROUNDS_FROM);
  const rounds = tip > from ? Math.floor(tip / REWARD_ROUND) - Math.floor(from / REWARD_ROUND) : 0;
  return single + rounds * REWARD_ROUND;
}

/** The first reward round after block `first`. */
export function firstRoundAfter(first: number): number {
  return first < REWARD_ROUNDS_FROM
    ? first + 1
    : (Math.floor(first / REWARD_ROUND) + 1) * REWARD_ROUND;
}

export type OnlineShare =
  | { kind: 'share'; percent: number; first: number; countable: number }
  | { kind: 'lineage'; percent: number; countable: number; lineage: LevelLineage }
  | { kind: 'never' }
  | { kind: 'soon'; first: number; round: number }
  | { kind: 'moved'; height: number; to: boolean };

/** An account a minting level moved from (data/explorer/account.ts getLevelLineage). */
export interface LevelSource {
  address: string;
  name: string | null;
  /** The account it moved its level to. */
  to: string;
  /** The block of the move. */
  height: number;
  timestamp: number;
  signature: string;
  /** Its first reward share before the move, or null when it minted nothing before it. */
  firstShare: number | null;
}

/** Where a minting level was minted: each account's span, the account itself last (`to` null: to now). */
export interface LevelLineage {
  periods: Array<{ address: string; from: number; to: number | null }>;
  sources: LevelSource[];
  /** More moves back than were followed. */
  truncated: boolean;
}

/**
 * The share of the rewards a minting level could have had, across the
 * accounts it was on: the account's blocks minted now (which hold the
 * senders' at their moves) over the rewards each account could have had,
 * from its first reward share to its move (or to `tip`).
 */
export function lineageShare(
  blocksMinted: number,
  lineage: LevelLineage,
  tip: number
): OnlineShare {
  const countable = lineage.periods.reduce(
    (sum, period) => sum + countableBlocks(period.from, period.to ?? tip),
    0
  );
  if (!lineage.periods.length) return { kind: 'never' };
  if (!countable) {
    const first = Math.min(...lineage.periods.map((period) => period.from));
    return { kind: 'soon', first, round: firstRoundAfter(first) };
  }
  return {
    kind: 'lineage',
    percent: Math.min(100, Math.max(0, (blocksMinted / countable) * 100)),
    countable,
    lineage,
  };
}

/** Where an account started minting, from its reward shares and level moves. */
export interface MintingStart {
  /** Its oldest reward share, as the minter or the recipient. */
  firstShare: { height: number; timestamp: number; signature?: string } | null;
  /** Its newest minting-level move, and whether it moved the level away. */
  moved: { height: number; away: boolean } | null;
}

/**
 * `lineage`: where its level was minted, for an account whose level moved
 * here (without it, such an account's share can't be told).
 */
export function onlineShare(
  blocksMinted: number,
  start: MintingStart,
  tip: number,
  lineage?: LevelLineage | null
): OnlineShare {
  // Only when the accounts it came from were found: without them, its count can't be told.
  if (start.moved && !start.moved.away && lineage?.sources.length)
    return lineageShare(blocksMinted, lineage, tip);
  if (start.moved) return { kind: 'moved', height: start.moved.height, to: start.moved.away };
  if (!start.firstShare) return { kind: 'never' };
  const first = start.firstShare.height;
  const countable = countableBlocks(first, tip);
  if (!countable) return { kind: 'soon', first, round: firstRoundAfter(first) };
  return {
    kind: 'share',
    percent: Math.min(100, Math.max(0, (blocksMinted / countable) * 100)),
    first,
    countable,
  };
}

/** "95%", "100%", "under 1%", "0%". */
export function percentWords(percent: number): string {
  if (percent <= 0) return '0%';
  if (percent < 1) return 'under 1%';
  if (percent >= 99.5 && percent < 100) return 'over 99%';
  return `${Math.round(percent)}%`;
}
