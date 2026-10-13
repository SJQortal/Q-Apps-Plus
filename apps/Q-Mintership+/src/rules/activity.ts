/**
 * Minter Admin Activity and the group's pulse, from decided and pending
 * MINTER decisions and the GROUP_APPROVALs on them. Pure; data/activity.ts
 * feeds it. Everything is measured in blocks: callers turn blocks into time
 * with the live block time.
 *
 * How an admin is counted against one decision (confirmed in block h):
 *
 * - The decision can collect signatures from h until its last useful block:
 *   h + max − 1, or the block before it was approved or rejected if that
 *   came first (an approval in block B counts from B + 1, rules/timing.ts).
 * - It is "eligible" for an admin when that stretch overlaps both the
 *   window and a time they were an admin. An answer always makes it
 *   eligible: only admins can answer.
 * - Only each admin's latest approval on a decision counts, as Core does,
 *   and only one that landed in time. `approval: false` is a rejection:
 *   counted apart, never as a signature.
 * - Answered: their latest answer is a signature or a rejection (Reject, or
 *   a withdrawn signature). Participation is answered ÷ eligible, so any
 *   answer is taking part.
 * - Decisions still waiting count once the admin has answered them; an
 *   unanswered open decision is neither a miss nor a gap yet.
 * - Missed: it ended (approved, rejected or expired), they were an admin
 *   until its last useful block, and they never answered it. Only doing
 *   nothing is a miss.
 * - Time to sign leaves out decisions the admin proposed themselves (the
 *   proposer signs in the next block, which says nothing about response).
 */
import type { TxRow } from '../data/types';
import { decisionKind, decisionSubject, toApprovalRow, type DecisionKind } from './decision';
import { isNewerDecision, type ApprovalRow } from './tally';

export interface BlockRange {
  startBlock: number;
  endBlock: number;
}

export type DecisionOutcome = 'approved' | 'rejected' | 'expired' | 'pending';

export interface DecisionSpan {
  signature: string;
  kind: DecisionKind;
  subject: string | null;
  creator: string | null;
  confirmedHeight: number;
  /** The last block a signature can land in and still count. */
  lastSignatureHeight: number;
  outcome: DecisionOutcome;
  /** The block it was approved, rejected or expired in; null while pending. */
  decidedHeight: number | null;
}

/**
 * One confirmed MINTER decision as a span of blocks, or null for rows that
 * are not decisions (unconfirmed, no approval needed, invalid).
 */
export function decisionSpan(tx: TxRow, maxDelay: number, tipHeight: number): DecisionSpan | null {
  const h = tx.blockHeight;
  if (typeof h !== 'number') return null;
  const lastUseful = h + maxDelay - 1;
  const expiresAt = h + maxDelay + 1;
  const approvalHeight = typeof tx.approvalHeight === 'number' ? tx.approvalHeight : null;
  let outcome: DecisionOutcome;
  let decidedHeight: number | null;
  switch (tx.approvalStatus) {
    case 'APPROVED':
    case 'REJECTED':
      outcome = tx.approvalStatus === 'APPROVED' ? 'approved' : 'rejected';
      decidedHeight = approvalHeight ?? h + maxDelay;
      break;
    case 'EXPIRED':
      outcome = 'expired';
      decidedHeight = approvalHeight ?? expiresAt;
      break;
    case 'PENDING':
      // A stale read can still say PENDING after Core expired it.
      outcome = tipHeight >= expiresAt ? 'expired' : 'pending';
      decidedHeight = outcome === 'expired' ? expiresAt : null;
      break;
    default:
      return null;
  }
  const lastSignatureHeight =
    outcome === 'approved' || outcome === 'rejected'
      ? Math.min(lastUseful, (decidedHeight as number) - 1)
      : lastUseful;
  return {
    signature: tx.signature,
    kind: decisionKind(tx),
    subject: decisionSubject(tx),
    creator: tx.creatorAddress ?? null,
    confirmedHeight: h,
    lastSignatureHeight,
    outcome,
    decidedHeight,
  };
}

// ---- who was an admin when -------------------------------------------------

export interface AdminChange {
  address: string;
  added: boolean;
  /** The block the change was approved in (it applies from this block). */
  height: number;
}

/** Approved ADD_GROUP_ADMIN / REMOVE_GROUP_ADMIN decisions, oldest first. */
export function adminChanges(decisions: TxRow[]): AdminChange[] {
  const changes: AdminChange[] = [];
  for (const tx of decisions) {
    if (tx.approvalStatus !== 'APPROVED' || typeof tx.approvalHeight !== 'number') continue;
    if (tx.type === 'ADD_GROUP_ADMIN' && tx.member)
      changes.push({ address: tx.member, added: true, height: tx.approvalHeight });
    if (tx.type === 'REMOVE_GROUP_ADMIN' && tx.admin)
      changes.push({ address: tx.admin, added: false, height: tx.approvalHeight });
  }
  return changes.sort((a, b) => a.height - b.height);
}

/** Inclusive block interval; the ends can be ±Infinity. */
export type Interval = readonly [number, number];

/**
 * The blocks `address` was an admin in, from the changes read plus whether
 * they are an admin now. With no change on record they were an admin
 * throughout if they are one now, or (`lastSeen`) until the last block they
 * signed in if they stopped some other way.
 */
export function tenureOf(
  address: string,
  changes: AdminChange[],
  isCurrent: boolean,
  lastSeen: number | null = null
): Interval[] {
  const mine = changes.filter((c) => c.address === address);
  const wasAdminBefore = mine.length ? !mine[0].added : isCurrent || lastSeen !== null;
  let open: number | null = wasAdminBefore ? Number.NEGATIVE_INFINITY : null;
  const intervals: Array<[number, number]> = [];
  for (const change of mine) {
    if (change.added && open === null) open = change.height;
    if (!change.added && open !== null) {
      intervals.push([open, change.height - 1]);
      open = null;
    }
  }
  if (open !== null) {
    intervals.push([open, isCurrent ? Number.POSITIVE_INFINITY : Math.max(open, lastSeen ?? open)]);
  } else if (isCurrent) {
    // Made an admin by a change this read doesn't hold: from the last one seen.
    const last = mine.length ? mine[mine.length - 1].height : Number.NEGATIVE_INFINITY;
    intervals.push([last, Number.POSITIVE_INFINITY]);
  }
  return intervals;
}

function overlaps(intervals: readonly Interval[], from: number, to: number): boolean {
  return from <= to && intervals.some(([a, b]) => a <= to && b >= from);
}

function contains(intervals: readonly Interval[], height: number): boolean {
  return intervals.some(([a, b]) => a <= height && height <= b);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---- per admin ---------------------------------------------------------------

export interface AdminActivity {
  address: string;
  /** An admin now. */
  current: boolean;
  /** Block of their newest approved ADD_GROUP_ADMIN that was read; null = before what was read. */
  adminSince: number | null;
  /** Removed earlier and made an admin again at `adminSince` (both counted). */
  adminAgain: boolean;
  /** Block of their newest approved REMOVE_GROUP_ADMIN that was read (former admins). */
  removedAt: number | null;
  /** Decisions they could have answered in the window. */
  eligible: number;
  /** Signed or rejected: signed + rejected. */
  answered: number;
  signed: number;
  /** Their latest answer on it was a rejection (not a signature). */
  rejected: number;
  /** Ended while they were an admin, and they never answered it. */
  missed: number;
  /** answered / eligible, or null when nothing was eligible. */
  participation: number | null;
  /** Median blocks from a decision's block to their signature's (own proposals left out). */
  medianBlocksToSign: number | null;
  proposed: number;
  proposedByKind: Partial<Record<DecisionKind, number>>;
  /** Their newest signature or proposal in the window. */
  lastActiveHeight: number | null;
}

export interface ActivityInput {
  range: BlockRange;
  tipHeight: number;
  /** The group's maximumBlockDelay (10,080 for MINTER). */
  maxDelay: number;
  /** MINTER decisions (txGroupId 694), any status; later rows replace earlier ones with the same signature. */
  decisions: TxRow[];
  /**
   * ADD_GROUP_ADMIN / REMOVE_GROUP_ADMIN decisions up to the tip, for who was
   * an admin when (a change approved after the window still shapes it).
   * Defaults to `decisions`.
   */
  adminChangeRows?: TxRow[];
  /** Confirmed GROUP_APPROVALs (any group's; the rest are ignored). */
  approvals: TxRow[];
  /** Admins now, null owner left out. */
  currentAdmins: string[];
  /** Never listed (the null owner). */
  exclude?: string[];
}

export interface ActivityReport {
  current: AdminActivity[];
  /** Admins during the window who aren't admins now. */
  former: AdminActivity[];
  /** Decisions waiting for signatures at some point in the window. */
  decisionCount: number;
  /** Approvals read that belong to other groups' transactions (ignored). */
  ignoredApprovals: number;
  spans: DecisionSpan[];
}

/** Each decision's spans by signature (later rows win). */
export function spansOf(decisions: TxRow[], maxDelay: number, tipHeight: number): DecisionSpan[] {
  const bySignature = new Map<string, DecisionSpan>();
  for (const tx of decisions) {
    const span = decisionSpan(tx, maxDelay, tipHeight);
    if (span) bySignature.set(span.signature, span);
  }
  return [...bySignature.values()];
}

export function computeActivity(input: ActivityInput): ActivityReport {
  const { startBlock: S, endBlock: E } = input.range;
  const tip = input.tipHeight;
  const spans = spansOf(input.decisions, input.maxDelay, tip);
  const spanBySig = new Map(spans.map((s) => [s.signature, s]));
  const exclude = new Set(input.exclude ?? []);

  // Latest counted row per (decision, admin), and every admin's newest row.
  const latest = new Map<string, Map<string, ApprovalRow>>();
  /** Newest signature per admin inside the window, and at all (for tenure). */
  const lastApproval = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  let ignoredApprovals = 0;
  for (const tx of input.approvals) {
    const row = toApprovalRow(tx);
    if (!row || typeof row.blockHeight !== 'number') continue;
    const span = spanBySig.get(row.pendingSignature);
    if (!span) {
      ignoredApprovals++;
      continue;
    }
    const who = row.creatorAddress;
    if (!who) continue;
    lastSeen.set(who, Math.max(lastSeen.get(who) ?? -1, row.blockHeight));
    if (row.blockHeight <= E)
      lastApproval.set(who, Math.max(lastApproval.get(who) ?? -1, row.blockHeight));
    if (row.blockHeight > span.lastSignatureHeight) continue; // landed too late to count
    let perAdmin = latest.get(span.signature);
    if (!perAdmin) latest.set(span.signature, (perAdmin = new Map()));
    const current = perAdmin.get(who);
    if (!current || isNewerDecision(row, current)) perAdmin.set(who, row);
  }

  const changes = adminChanges(input.adminChangeRows ?? input.decisions);
  const currentSet = new Set(input.currentAdmins.filter((a) => !exclude.has(a)));
  // Anyone who signed or had an admin change could have been an admin in the window.
  const candidates = new Set<string>(currentSet);
  for (const who of lastSeen.keys()) candidates.add(who);
  for (const change of changes) candidates.add(change.address);
  for (const who of exclude) candidates.delete(who);

  const inWindow = spans.filter(
    (s) => s.confirmedHeight <= E && Math.min(s.lastSignatureHeight, tip) >= S
  );

  const current: AdminActivity[] = [];
  const former: AdminActivity[] = [];
  for (const address of candidates) {
    const isCurrent = currentSet.has(address);
    const tenure = tenureOf(address, changes, isCurrent, lastSeen.get(address) ?? null);
    const servedInWindow = overlaps(tenure, S, E);
    if (!isCurrent && !servedInWindow) continue;

    let eligible = 0;
    let signed = 0;
    let rejected = 0;
    let missed = 0;
    const delays: number[] = [];
    for (const span of inWindow) {
      const from = Math.max(span.confirmedHeight, S);
      const to = Math.min(span.lastSignatureHeight, tip, E);
      const row = latest.get(span.signature)?.get(address);
      const byTenure = overlaps(tenure, from, to);
      const rowInWindow = row
        ? (row.blockHeight as number) >= S && (row.blockHeight as number) <= E
        : false;
      const isEligible =
        span.outcome === 'pending'
          ? Boolean(row) && (byTenure || rowInWindow)
          : byTenure || rowInWindow;
      if (!isEligible) continue;
      eligible++;
      if (row?.approval) {
        signed++;
        if (span.creator !== address)
          delays.push(Math.max(0, (row.blockHeight as number) - span.confirmedHeight));
      } else if (row) {
        rejected++;
      } else if (
        span.outcome !== 'pending' &&
        span.lastSignatureHeight >= S &&
        span.lastSignatureHeight <= E &&
        contains(tenure, span.lastSignatureHeight)
      ) {
        missed++;
      }
    }

    const proposedByKind: Partial<Record<DecisionKind, number>> = {};
    let proposed = 0;
    let lastProposal = -1;
    for (const span of spans) {
      if (span.creator !== address) continue;
      if (span.confirmedHeight <= E) lastProposal = Math.max(lastProposal, span.confirmedHeight);
      if (span.confirmedHeight < S || span.confirmedHeight > E) continue;
      proposed++;
      proposedByKind[span.kind] = (proposedByKind[span.kind] ?? 0) + 1;
    }
    const lastActive = Math.max(lastApproval.get(address) ?? -1, lastProposal);

    const adds = changes.filter((c) => c.address === address && c.added);
    const removes = changes.filter((c) => c.address === address && !c.added);
    const adminSince = adds.length ? adds[adds.length - 1].height : null;
    const activity: AdminActivity = {
      address,
      current: isCurrent,
      adminSince,
      adminAgain: adminSince !== null && removes.some((r) => r.height < adminSince),
      removedAt: !isCurrent && removes.length ? removes[removes.length - 1].height : null,
      eligible,
      answered: signed + rejected,
      signed,
      rejected,
      missed,
      participation: eligible ? (signed + rejected) / eligible : null,
      medianBlocksToSign: median(delays),
      proposed,
      proposedByKind,
      lastActiveHeight: lastActive >= S ? lastActive : null,
    };
    (isCurrent ? current : former).push(activity);
  }

  return {
    current,
    former,
    decisionCount: inWindow.length,
    ignoredApprovals,
    spans,
  };
}

// ---- sorting -----------------------------------------------------------------

export type ActivitySort = 'participation' | 'signatures' | 'lastActive' | 'name';

/**
 * Sort a copy: participation and signatures highest first (no eligible
 * decisions last), last active newest first, names A–Z. Ties fall back to
 * the name, so the order never jumps between refreshes.
 */
export function sortActivity(
  rows: AdminActivity[],
  sort: ActivitySort,
  nameOf: (address: string) => string
): AdminActivity[] {
  const byName = (a: AdminActivity, b: AdminActivity) =>
    nameOf(a.address).localeCompare(nameOf(b.address), undefined, { sensitivity: 'base' }) ||
    a.address.localeCompare(b.address);
  const desc = (x: number | null, y: number | null) => (y ?? -1) - (x ?? -1);
  return [...rows].sort((a, b) => {
    let order = 0;
    if (sort === 'participation')
      order = desc(a.participation, b.participation) || b.answered - a.answered;
    else if (sort === 'signatures')
      order = b.signed - a.signed || desc(a.participation, b.participation);
    else if (sort === 'lastActive') order = desc(a.lastActiveHeight, b.lastActiveHeight);
    return order || byName(a, b);
  });
}

// ---- the group's pulse -----------------------------------------------------

export interface PulseInput {
  range: BlockRange;
  /** The window in ms, for member join times. */
  startTime: number;
  endTime: number;
  spans: DecisionSpan[];
  /** Confirmed MINTER LEAVE_GROUP rows. */
  leaves: TxRow[];
  /** Members now, with the time they joined. */
  members: Array<{ joined?: number }>;
}

export interface Pulse {
  /** Members now who joined in the window. */
  joined: number;
  left: number;
  /** Approved removals and bans in the window. */
  kicked: number;
  banned: number;
  /** Invites decided in the window, by outcome. */
  invitesApproved: number;
  invitesExpired: number;
  invitesRejected: number;
  /** approved / decided, or null when none was decided. */
  approvalRate: number | null;
  /** Median blocks from an approved invite's block to its approval. */
  medianBlocksToApproval: number | null;
}

export function computePulse(input: PulseInput): Pulse {
  const { startBlock: S, endBlock: E } = input.range;
  const decidedIn = (s: DecisionSpan) =>
    s.outcome !== 'pending' &&
    s.decidedHeight !== null &&
    s.decidedHeight >= S &&
    s.decidedHeight <= E;
  const invites = input.spans.filter((s) => s.kind === 'invite' && decidedIn(s));
  const approved = invites.filter((s) => s.outcome === 'approved');
  const count = (kind: DecisionKind) =>
    input.spans.filter((s) => s.kind === kind && s.outcome === 'approved' && decidedIn(s)).length;
  return {
    joined: input.members.filter(
      (m) =>
        typeof m.joined === 'number' && m.joined >= input.startTime && m.joined <= input.endTime
    ).length,
    left: input.leaves.filter(
      (tx) => typeof tx.blockHeight === 'number' && tx.blockHeight >= S && tx.blockHeight <= E
    ).length,
    kicked: count('kick'),
    banned: count('ban'),
    invitesApproved: approved.length,
    invitesExpired: invites.filter((s) => s.outcome === 'expired').length,
    invitesRejected: invites.filter((s) => s.outcome === 'rejected').length,
    approvalRate: invites.length ? approved.length / invites.length : null,
    medianBlocksToApproval: median(
      approved.map((s) => (s.decidedHeight as number) - s.confirmedHeight)
    ),
  };
}

// ---- level spread ------------------------------------------------------------

export interface LevelSpread {
  /** Members per level, index = level (0–10). */
  byLevel: number[];
  /** Members whose level couldn't be read. */
  unknown: number;
  total: number;
  /** Level 5 and above (the level members can nominate from). */
  atLeast5: number;
}

export function levelSpread(levels: Array<number | null>): LevelSpread {
  const byLevel = Array.from({ length: 11 }, () => 0);
  let unknown = 0;
  for (const level of levels) {
    if (typeof level !== 'number' || !Number.isFinite(level)) unknown++;
    else byLevel[Math.max(0, Math.min(10, Math.floor(level)))]++;
  }
  return {
    byLevel,
    unknown,
    total: levels.length,
    atLeast5: byLevel.slice(5).reduce((a, b) => a + b, 0),
  };
}
