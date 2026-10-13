/**
 * MINTER's on-chain story as plain events: who was added, removed, banned or
 * made an admin, who joined or left, and when. Built from confirmed group
 * transactions: one address's history (person pages) or a block window for
 * the whole group (History).
 *
 * Only APPROVED transactions (and NOT_REQUIRED ones from before group
 * approval) happened. The rest are proposals that are still collecting
 * signatures, expired, or were rejected, and read as such.
 *
 * Whether a JOIN_GROUP made someone a member or only asked to join, and
 * whether an approved invite added them at once, depends on what came
 * before; this is worked out from the transactions in hand, oldest first.
 */
import { KIND_LABEL, decisionKind, decisionSubject, type DecisionKind } from '../rules/decision';
import type { TargetStep } from '../rules/targetShift';
import { formatDuration, plural } from '../utils/format';
import { getBlockAtTime } from './chain';
import { fetchQuery } from './query';
import { getDecisionsInRange, getGroupTxsInRange, isMinterTx } from './txs';
import { APPROVAL_GATED_TYPES, type TxRow } from './types';

export type TimelineOutcome = 'done' | 'pending' | 'expired' | 'rejected';
export type TimelineKind = DecisionKind | 'join' | 'leave';
export type TimelineTone = 'good' | 'bad' | 'neutral';

export interface TimelineEvent {
  signature: string;
  kind: TimelineKind;
  outcome: TimelineOutcome;
  /** Who it is about (null for a cancelled invite: Core's answer leaves the invitee out). */
  subject: string | null;
  /** Who proposed it (the Minter Admin), or who joined or left. */
  creator: string | null;
  proposedAt: number;
  proposedHeight: number | null;
  /** When it took effect or was decided (ms), estimated from block heights; the proposal time while pending. */
  at: number;
  atHeight: number | null;
  title: string;
  /** "Permanent", "For 3 days", "Not enough signatures in time", … */
  detail: string | null;
  reason: string | null;
  tone: TimelineTone;
  /** This event made the subject a MINTER member. */
  becameMember: boolean;
  /** This event ended the subject's membership. */
  endedMembership: boolean;
  tx: TxRow;
}

export interface TimelineContext {
  msPerBlock: number;
  /** MINTER's maximumBlockDelay (10,080): when an unapproved proposal expires. */
  maximumBlockDelay: number;
}

const GOOD: ReadonlySet<TimelineKind> = new Set(['invite', 'join', 'addAdmin', 'cancelBan']);
const BAD: ReadonlySet<TimelineKind> = new Set(['kick', 'ban', 'leave', 'removeAdmin']);

const DONE_TITLE: Record<Exclude<TimelineKind, 'invite' | 'join'>, string> = {
  cancelInvite: 'Approved invite cancelled',
  kick: 'Removed from MINTER',
  ban: 'Banned from MINTER',
  cancelBan: 'Ban lifted',
  addAdmin: 'Made a Minter Admin',
  removeAdmin: 'No longer a Minter Admin',
  leave: 'Left MINTER',
  other: 'Group change',
};

export const OUTCOME_LABEL: Record<Exclude<TimelineOutcome, 'done'>, string> = {
  pending: 'Collecting signatures',
  expired: 'Expired',
  rejected: 'Rejected',
};

function outcomeOf(tx: TxRow): TimelineOutcome | null {
  switch (tx.approvalStatus) {
    case 'PENDING':
      return 'pending';
    case 'EXPIRED':
      return 'expired';
    case 'REJECTED':
      return 'rejected';
    case 'INVALID':
      return null;
    default:
      return 'done';
  }
}

function kindOf(tx: TxRow): TimelineKind | null {
  if (tx.type === 'JOIN_GROUP') return 'join';
  if (tx.type === 'LEAVE_GROUP') return 'leave';
  if (tx.type === 'GROUP_APPROVAL' || tx.type === 'UPDATE_GROUP') return null;
  return decisionKind(tx);
}

/** "Permanent" or "For 3 days": how long a ban lasts (0 seconds = permanent). */
export function banLength(seconds: number): string {
  return seconds > 0 ? `For ${formatDuration(seconds * 1000)}` : 'Permanent';
}

function effectHeight(tx: TxRow, outcome: TimelineOutcome, maxDelay: number): number | null {
  const confirmed = typeof tx.blockHeight === 'number' ? tx.blockHeight : null;
  if (outcome === 'done')
    return typeof tx.approvalHeight === 'number' ? tx.approvalHeight : confirmed;
  if (outcome === 'expired') return confirmed === null ? null : confirmed + maxDelay + 1;
  if (outcome === 'rejected')
    return typeof tx.approvalHeight === 'number' ? tx.approvalHeight : null;
  return null;
}

interface PersonState {
  member: boolean;
  invite: boolean;
  request: boolean;
}

/**
 * Events from confirmed MINTER group transactions, newest first. Rows that
 * aren't about MINTER, approvals and duplicates are left out.
 */
export function buildTimeline(rows: TxRow[], ctx: TimelineContext): TimelineEvent[] {
  const seen = new Set<string>();
  const base: Array<Omit<TimelineEvent, 'title' | 'becameMember' | 'endedMembership'>> = [];
  for (const tx of rows) {
    if (!tx || seen.has(tx.signature) || !isMinterTx(tx)) continue;
    const kind = kindOf(tx);
    // Joins and leaves need no approval; anything else waits for the admins.
    const outcome =
      kind === 'join' || kind === 'leave'
        ? tx.approvalStatus === 'INVALID'
          ? null
          : 'done'
        : outcomeOf(tx);
    if (!kind || !outcome) continue;
    seen.add(tx.signature);
    const proposedHeight = typeof tx.blockHeight === 'number' ? tx.blockHeight : null;
    const atHeight = effectHeight(tx, outcome, ctx.maximumBlockDelay);
    const at =
      atHeight !== null && proposedHeight !== null
        ? tx.timestamp + Math.max(0, atHeight - proposedHeight) * ctx.msPerBlock
        : tx.timestamp;
    const reason = typeof tx.reason === 'string' && tx.reason.trim() ? tx.reason.trim() : null;
    let detail: string | null = null;
    if (kind === 'ban' && outcome === 'done') detail = banLength(Number(tx.timeToLive ?? 0));
    if (kind === 'invite' && outcome === 'expired')
      detail = 'Not enough signatures in time. They can be nominated again.';
    if (outcome === 'rejected')
      detail =
        kind === 'invite'
          ? 'Enough Minter Admins rejected it. They can be nominated again.'
          : 'Enough Minter Admins rejected it.';
    base.push({
      signature: tx.signature,
      kind,
      outcome,
      subject:
        kind === 'join' || kind === 'leave' ? (tx.creatorAddress ?? null) : decisionSubject(tx),
      creator: tx.creatorAddress ?? null,
      proposedAt: tx.timestamp,
      proposedHeight,
      at,
      atHeight,
      detail,
      reason,
      tone:
        outcome === 'done'
          ? GOOD.has(kind)
            ? 'good'
            : BAD.has(kind)
              ? 'bad'
              : 'neutral'
          : 'neutral',
      tx,
    });
  }

  // Walk forward in time to tell joins from join requests.
  const chronological = [...base].sort(
    (a, b) => a.at - b.at || (a.atHeight ?? 0) - (b.atHeight ?? 0)
  );
  const states = new Map<string, PersonState>();
  const stateOf = (address: string) => {
    let s = states.get(address);
    if (!s) {
      s = { member: false, invite: false, request: false };
      states.set(address, s);
    }
    return s;
  };
  const events: TimelineEvent[] = chronological.map((e) => {
    let title: string;
    let becameMember = false;
    let endedMembership = false;
    const s = e.subject ? stateOf(e.subject) : null;
    if (e.outcome !== 'done') {
      title =
        e.kind === 'invite'
          ? 'Nominated for MINTER'
          : `Proposed: ${KIND_LABEL[e.kind as DecisionKind]}`;
    } else if (e.kind === 'invite') {
      const old = e.tx.approvalStatus === 'NOT_REQUIRED';
      if (s?.request) {
        title = 'Approved and added to MINTER';
        becameMember = !s.member;
        Object.assign(s, { member: true, request: false, invite: false });
      } else {
        title = old ? 'Invited to MINTER' : 'Approved for MINTER';
        if (s) s.invite = true;
      }
    } else if (e.kind === 'join') {
      if (s?.invite || s?.member) {
        title = 'Joined MINTER';
        becameMember = !s.member;
        Object.assign(s, { member: true, invite: false, request: false });
      } else {
        title = 'Asked to join MINTER';
        if (s) s.request = true;
      }
    } else {
      title = DONE_TITLE[e.kind];
      if (s && (e.kind === 'kick' || e.kind === 'ban')) {
        endedMembership = s.member || e.kind === 'kick';
        Object.assign(s, { member: false, request: false });
      }
      if (s && e.kind === 'leave') {
        endedMembership = true;
        s.member = false;
      }
    }
    return {
      ...e,
      title,
      tone: e.kind === 'join' && title !== 'Joined MINTER' ? 'neutral' : e.tone,
      becameMember,
      endedMembership,
    };
  });
  return events.sort(
    (a, b) =>
      b.at - a.at || (b.atHeight ?? b.proposedHeight ?? 0) - (a.atHeight ?? a.proposedHeight ?? 0)
  );
}

/** "Target 9 → 8 signatures (21 → 20 admin seats)": what an approved admin change did to the target. */
export function targetStepDetail(step: TargetStep): string {
  return step.neededBefore !== step.neededAfter
    ? `Target ${step.neededBefore} → ${plural(step.neededAfter, 'signature')} (${step.countBefore} → ${step.countAfter} admin seats)`
    : `Admin seats ${step.countBefore} → ${step.countAfter}; the target stayed at ${plural(step.neededAfter, 'signature')}`;
}

/**
 * Approved admin changes say what they did to the target (from
 * rules/targetShift.ts targetSteps); other events are left as they are.
 */
export function withTargetSteps(events: TimelineEvent[], steps: TargetStep[]): TimelineEvent[] {
  if (!steps.length) return events;
  const bySignature = new Map(steps.map((step) => [step.signature, step]));
  return events.map((event) => {
    const step = bySignature.get(event.signature);
    if (!step || event.outcome !== 'done') return event;
    if (event.kind !== 'addAdmin' && event.kind !== 'removeAdmin') return event;
    return { ...event, detail: targetStepDetail(step) };
  });
}

/**
 * One address's own history rows, with the invitee filled in on cancelled
 * invites: Core's answer leaves it out, but a cancellation in someone's
 * history that they didn't create is about them.
 */
export function withOwnSubject(rows: TxRow[], address: string): TxRow[] {
  return rows.map((tx) =>
    tx.type === 'CANCEL_GROUP_INVITE' && !tx.invitee && tx.creatorAddress !== address
      ? { ...tx, invitee: address }
      : tx
  );
}

/** Events about one person (their own joins and leaves included), newest first. */
export function eventsAbout(events: TimelineEvent[], address: string): TimelineEvent[] {
  return events.filter((e) => e.subject === address);
}

/** What a Minter Admin proposed for others, newest first. */
export function proposalsBy(events: TimelineEvent[], address: string): TimelineEvent[] {
  return events.filter(
    (e) => e.creator === address && e.subject !== address && e.kind !== 'join' && e.kind !== 'leave'
  );
}

/**
 * When the person's current membership started, from their events (null
 * when it began before the history in hand, or they aren't a member).
 */
export function memberSince(events: TimelineEvent[], address: string): number | null {
  for (const e of eventsAbout(events, address)) {
    if (e.endedMembership) return null;
    if (e.becameMember) return e.at;
  }
  return null;
}

// ---- the whole group, by window ------------------------------------------

export const HISTORY_WINDOW_DAYS = 30;
const WINDOW_MS = HISTORY_WINDOW_DAYS * 86_400_000;
/** Windows History reads at most (about two years). */
export const HISTORY_MAX_WINDOWS = 24;

export interface HistoryAnchor {
  height: number;
  timestamp: number;
}

export interface HistoryWindow {
  index: number;
  startHeight: number;
  endHeight: number;
  startMs: number;
  endMs: number;
  rows: TxRow[];
  truncated: boolean;
}

/**
 * MINTER's group transactions in window `index` (0 = the last 30 days before
 * `anchor`, 1 = the 30 days before that, …): decisions with txGroupId 694 and
 * MINTER joins and leaves (key `timeline:<anchor height>:<index>`).
 */
export function loadHistoryWindow(
  anchor: HistoryAnchor,
  index: number,
  options: { force?: boolean } = {}
): Promise<HistoryWindow> {
  return fetchQuery(
    `timeline:${anchor.height}:${index}`,
    async () => {
      const endMs = anchor.timestamp - index * WINDOW_MS;
      const startMs = endMs - WINDOW_MS;
      const [startBlock, endBlock] = await Promise.all([
        getBlockAtTime(startMs),
        index === 0 ? Promise.resolve({ height: anchor.height }) : getBlockAtTime(endMs),
      ]);
      const startHeight = Math.max(1, startBlock.height + 1);
      const endHeight = Math.min(anchor.height, endBlock.height);
      if (endHeight < startHeight)
        return { index, startHeight, endHeight, startMs, endMs, rows: [], truncated: false };
      const [decisions, joins] = await Promise.all([
        getDecisionsInRange(APPROVAL_GATED_TYPES, startHeight, endHeight, options),
        getGroupTxsInRange(['JOIN_GROUP', 'LEAVE_GROUP'], startHeight, endHeight, options),
      ]);
      return {
        index,
        startHeight,
        endHeight,
        startMs,
        endMs,
        rows: [...decisions.rows, ...joins.rows],
        truncated: decisions.truncated || joins.truncated,
      };
    },
    { ttlMs: index === 0 ? 2 * 60_000 : 30 * 60_000, force: options.force }
  );
}

/**
 * The newest `count` windows together (key `timelines:<anchor height>:<count>`).
 * Each window is cached on its own, so "Load older" fetches only the new one,
 * and a refresh reloads only the newest.
 */
export function loadHistoryWindows(
  anchor: HistoryAnchor,
  count: number,
  options: { force?: boolean } = {}
): Promise<HistoryWindow[]> {
  return fetchQuery(
    `timelines:${anchor.height}:${count}`,
    () =>
      Promise.all(
        Array.from({ length: Math.max(1, count) }, (_, i) =>
          loadHistoryWindow(anchor, i, { force: Boolean(options.force) && i === 0 })
        )
      ),
    { ttlMs: 2 * 60_000, force: options.force }
  );
}
