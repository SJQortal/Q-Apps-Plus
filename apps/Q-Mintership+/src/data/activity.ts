/**
 * Minter Admin Activity's reads, for a window measured in blocks (the block
 * at the window's start comes from /blocks/timestamp, never an assumed
 * block time):
 *
 *   /groups/694, admins, the tip and block time, one or two block lookups,
 *   MINTER's decisions from one approval window (10,080 blocks) before the
 *   window to its end, the pending ones, every GROUP_APPROVAL over the same
 *   blocks (joined to the decisions on pendingSignature), LEAVE_GROUP rows
 *   in the window, the member list (names and join times, shared with the
 *   other screens) and the join requests.
 *
 * Each search is paged at 100 with a ceiling; about 20 GETs for 30 days and
 * 30 for 180. The result is cached for 5 minutes per window. The level
 * spread is a separate read, only when someone asks for it.
 */
import {
  computeActivity,
  computePulse,
  levelSpread,
  type ActivityReport,
  type BlockRange,
  type LevelSpread,
  type Pulse,
} from '../rules/activity';
import { approvalsNeeded, type ApprovalThreshold } from '../rules/threshold';
import type { ActivityWindow } from '../state/settings';
import { getAccount, primeNames } from './accounts';
import { getBlockAtTime, getChainNow, msToBlocks, type ChainNow } from './chain';
import { NULL_OWNER } from './constants';
import { getAdmins, getGroupInfo, getJoinRequests, getMembers } from './group';
import { mapLimit } from './qdn';
import { fetchQuery } from './query';
import { getApprovalsInRange, getDecisionsInRange, getGroupTxsInRange, getPending } from './txs';
import { APPROVAL_GATED_TYPES } from './types';

export const ACTIVITY_TTL_MS = 5 * 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Approvals can land a few blocks before the transaction they approve is confirmed. */
const APPROVAL_SLACK_BLOCKS = 10;

/** A preset window in days, or a custom range in ms (both ends inclusive). */
export type ActivityChoice = { days: ActivityWindow } | { fromMs: number; toMs: number };

export interface ActivityRange extends BlockRange {
  startTime: number;
  endTime: number;
  /** The preset's days; null for a custom range. */
  days: number | null;
  /** True when a block lookup failed and the start was worked out from the block time. */
  estimated: boolean;
}

export interface ActivityPulse extends Pulse {
  /** False when the member list or the LEAVE_GROUP read failed (those numbers are unknown). */
  joinedKnown: boolean;
  leftKnown: boolean;
}

export interface ActivityData {
  range: ActivityRange;
  now: ChainNow;
  report: ActivityReport;
  pulse: ActivityPulse;
  /** Address → primary name, from the member and admin lists. */
  names: Record<string, string>;
  /** Members now (for the level spread); empty when the list couldn't be read. */
  members: string[];
  memberCount: number;
  /** Core's admin count (the null owner included): the threshold's denominator. */
  adminCount: number;
  /** Admins who can sign. */
  signerCount: number;
  threshold: ApprovalThreshold;
  needed: number;
  joinRequests: number | null;
  /** A paged read stopped at its ceiling. */
  truncated: boolean;
  loadedAt: number;
}

export function activityKey(choice: ActivityChoice): string {
  return 'days' in choice
    ? `activity:days:${choice.days}`
    : `activity:custom:${choice.fromMs}:${choice.toMs}`;
}

/** The block at or before `ms`; worked out from the block time if the lookup fails. */
async function blockAt(ms: number, now: ChainNow): Promise<{ height: number; estimated: boolean }> {
  if (ms >= now.timestamp) return { height: now.height, estimated: false };
  try {
    const block = await getBlockAtTime(ms);
    if (block.height > 0) return { height: Math.min(block.height, now.height), estimated: false };
  } catch {
    // Older Core, or the lookup failed: fall back to the measured block time.
  }
  return {
    height: Math.max(1, now.height - msToBlocks(now, now.timestamp - ms)),
    estimated: true,
  };
}

/**
 * The window in blocks. A preset starts `days` before the tip's time,
 * rounded down to the hour so refreshes share one block lookup.
 */
export async function resolveRange(choice: ActivityChoice, now: ChainNow): Promise<ActivityRange> {
  if ('days' in choice) {
    const startTime = Math.floor((now.timestamp - choice.days * DAY_MS) / HOUR_MS) * HOUR_MS;
    const start = await blockAt(startTime, now);
    return {
      startBlock: start.height,
      endBlock: now.height,
      startTime,
      endTime: now.timestamp,
      days: choice.days,
      estimated: start.estimated,
    };
  }
  const startTime = Math.min(choice.fromMs, choice.toMs);
  const endTime = Math.min(Math.max(choice.fromMs, choice.toMs), now.timestamp);
  const [start, end] = await Promise.all([blockAt(startTime, now), blockAt(endTime, now)]);
  return {
    startBlock: start.height,
    endBlock: Math.max(start.height, end.height),
    startTime,
    endTime,
    days: null,
    estimated: start.estimated || end.estimated,
  };
}

const NONE = { rows: [], truncated: false, pages: 0 };

export function loadActivity(
  choice: ActivityChoice,
  options: { force?: boolean } = {}
): Promise<ActivityData> {
  return fetchQuery(
    activityKey(choice),
    async () => {
      const force = options.force;
      const [group, admins, now] = await Promise.all([
        getGroupInfo({ force }),
        getAdmins({ force }),
        getChainNow({ force }),
      ]);
      const range = await resolveRange(choice, now);
      const max = group.maximumBlockDelay;
      // Decisions confirmed up to one window before the start were still waiting in it.
      const from = Math.max(1, range.startBlock - max);
      const [decided, pending, approvals, leaves, members, joinRequests] = await Promise.all([
        getDecisionsInRange(APPROVAL_GATED_TYPES, from, range.endBlock, {
          force,
          ttlMs: ACTIVITY_TTL_MS,
        }),
        getPending({ force }).catch(() => NONE),
        getApprovalsInRange(
          from - APPROVAL_SLACK_BLOCKS,
          Math.min(now.height, range.endBlock + max),
          { force, ttlMs: ACTIVITY_TTL_MS }
        ),
        getGroupTxsInRange(['LEAVE_GROUP'], range.startBlock, range.endBlock, { force }).catch(
          () => null
        ),
        getMembers().catch(() => null),
        getJoinRequests({ force }).catch(() => null),
      ]);

      const names: Record<string, string> = {};
      for (const row of [...(members?.members ?? []), ...admins.admins]) {
        if (row.primaryName) names[row.member] = row.primaryName;
      }
      primeNames(Object.entries(names).map(([address, name]) => ({ address, name })));

      // Fresh pending rows replace the (up to 5-minute-old) search rows.
      const confirmedPending = pending.rows.filter(
        (tx) => typeof tx.blockHeight === 'number' && tx.blockHeight <= range.endBlock
      );
      const report = computeActivity({
        range,
        tipHeight: now.height,
        maxDelay: max,
        decisions: [...decided.rows, ...confirmedPending],
        approvals: approvals.rows,
        currentAdmins: admins.signers.map((row) => row.member),
        exclude: [NULL_OWNER],
      });
      const pulse = computePulse({
        range,
        startTime: range.startTime,
        endTime: range.endTime,
        spans: report.spans,
        leaves: leaves?.rows ?? [],
        members: members?.members ?? [],
      });

      return {
        range,
        now,
        report,
        pulse: { ...pulse, joinedKnown: members !== null, leftKnown: leaves !== null },
        names,
        members: members?.members.map((row) => row.member) ?? [],
        memberCount: admins.memberCount || members?.memberCount || group.memberCount || 0,
        adminCount: admins.adminCount,
        signerCount: admins.signers.length,
        threshold: group.approvalThreshold,
        needed: approvalsNeeded(group.approvalThreshold, admins.adminCount),
        joinRequests: joinRequests ? joinRequests.length : null,
        truncated: Boolean(
          decided.truncated ||
          approvals.truncated ||
          pending.truncated ||
          leaves?.truncated ||
          members?.truncated
        ),
        loadedAt: Date.now(),
      };
    },
    { ttlMs: ACTIVITY_TTL_MS, force: options.force }
  );
}

// ---- the level spread (only on request) -------------------------------------

export interface LevelReadProgress {
  done: number;
  total: number;
}

let levelProgress: LevelReadProgress = { done: 0, total: 0 };
const levelListeners = new Set<() => void>();

function setLevelProgress(next: LevelReadProgress): void {
  levelProgress = next;
  for (const listener of [...levelListeners]) listener();
}

export function subscribeLevelProgress(listener: () => void): () => void {
  levelListeners.add(listener);
  return () => {
    levelListeners.delete(listener);
  };
}

export function getLevelProgress(): LevelReadProgress {
  return levelProgress;
}

export function levelSpreadKey(memberCount: number): string {
  return `activity:levels:${memberCount}`;
}

/**
 * Every member's level: one cached `/addresses/{a}` read each, six at a time,
 * kept for 30 minutes. Hundreds of reads, so the screen only starts it when
 * someone opens "Level spread"; a read that fails counts as unknown.
 */
export function loadLevelSpread(members: string[]): Promise<LevelSpread> {
  return fetchQuery(
    levelSpreadKey(members.length),
    async () => {
      let done = 0;
      setLevelProgress({ done, total: members.length });
      const levels = await mapLimit(members, 6, async (address) => {
        const level = await getAccount(address).then(
          (account) => account.level,
          () => null
        );
        setLevelProgress({ done: ++done, total: members.length });
        return level;
      });
      return levelSpread(levels);
    },
    { ttlMs: 30 * 60_000 }
  );
}
