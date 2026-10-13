/**
 * Facts about MINTER and Qortal Core this app is built on. Each one was
 * checked against Core 6.1.4–6.1.9 and a mainnet node on 2026-10-12
 * (docs/apps/Q-Mintership+.md → The new process).
 */

/**
 * The MINTER group: membership is what lets an account mint.
 *
 * Dev-only testnet runs (vite.testnet.config.ts) point the app at a test
 * group instead. `__QMP_TESTNET__` is false in every build, so the build
 * keeps only 694 and none of the testnet code.
 */
export const MINTER_GROUP_ID: number = __QMP_TESTNET__ ? testnetGroupId() : 694;

function testnetGroupId(): number {
  const config = (globalThis as { __QMP_TESTNET_CONFIG__?: { groupId?: unknown } })
    .__QMP_TESTNET_CONFIG__;
  const id = Number(config?.groupId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Testnet run without a test group');
  return id;
}

/**
 * MINTER's owner is the null account. It counts as one of the group's admins
 * but no one can sign for it.
 */
export const NULL_OWNER = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';

/**
 * The time-to-live sent with INVITE_TO_GROUP (10 days, as the original app
 * sends). Hub refuses inviteTime 0, so the app sends 864000.
 */
export const INVITE_TIME_SECONDS = 864_000;

/** Ban durations: 0 is permanent; the app offers at most 24 days. */
export const BAN_MAX_SECONDS = 24 * 24 * 60 * 60;

/** Core refuses a new transaction when the account already has this many unconfirmed. */
export const MAX_UNCONFIRMED_PER_ACCOUNT = 25;

/** Level a member needs to nominate in this app (also the node default for submitting blocks). */
export const NOMINATOR_MIN_LEVEL = 5;

/**
 * Cumulative blocks minted needed for each level, from Core's
 * blockchain.json `blocksNeededByLevel` [7200, 64800, 129600, 172800,
 * 244000, 345600, 518400, 691200, 864000, 1036800], summed.
 * Index i is the total for level i + 1.
 */
export const CUMULATIVE_BLOCKS_BY_LEVEL = [
  7_200, 72_000, 201_600, 374_400, 618_400, 964_000, 1_482_400, 2_173_600, 3_037_600, 4_074_400,
] as const;

/**
 * Seconds per block measured on mainnet (72.9 s over the last 10,080 blocks,
 * 2026-10-12). Only a fallback: the app measures live block times and says
 * so when it has to use this.
 */
export const FALLBACK_MS_PER_BLOCK = 72_900;

/** Hub's 30-second limit on every non-publish request. */
export const HUB_REQUEST_TIMEOUT_MS = 30_000;

/** Hub keeps its confirmation dialog up for 60 s and still applies a late Accept. */
export const HUB_DIALOG_MAX_MS = 60_000;

/** Fallback fee when Core's unitfee can't be read: 0.01 QORT for every group transaction. */
export const FALLBACK_FEE_ATOMIC = 1_000_000;
export const ATOMIC_PER_QORT = 100_000_000;
