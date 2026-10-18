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
 * It can't be worked out when a minting level moved (TRANSFER_PRIVS): the
 * count moves with it.
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
  | { kind: 'never' }
  | { kind: 'soon'; first: number; round: number }
  | { kind: 'moved'; height: number; to: boolean };

/** Where an account started minting, from its reward shares and level moves. */
export interface MintingStart {
  /** Its oldest reward share, as the minter or the recipient. */
  firstShare: { height: number; timestamp: number; signature?: string } | null;
  /** Its newest minting-level move, and whether it moved the level away. */
  moved: { height: number; away: boolean } | null;
}

export function onlineShare(blocksMinted: number, start: MintingStart, tip: number): OnlineShare {
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
