/**
 * The target moves with the admin count, for every decision still waiting,
 * including ones that have collected signatures for days. Core recounts
 * MINTER's admin rows (the null owner included) each time it evaluates a
 * waiting decision, in every block (Core 6.1.4,
 * Block.processGroupApprovalTransactions → Transaction.getApprovalDecision):
 *
 * - An approved ADD_GROUP_ADMIN or REMOVE_GROUP_ADMIN is applied inside that
 *   same pass. Decisions Core evaluates after it in that block already see
 *   the new count; the others see it in the next block. So a change in the
 *   count reaches every waiting decision "in the same block or the next".
 * - Approvals are checked before rejections: when both reach the target, it
 *   is approved.
 * - Only confirmed decisions count, each admin's latest (rules/tally.ts).
 *
 * So a decision with k signatures and a target of n > k is applied at once,
 * with no new signature, when an admin change brings the target down to k.
 * This module projects that before it happens, from the admin changes that
 * are waiting, and works out the target's past changes from approved ones
 * (History, Activity). Pure; the screens feed it.
 *
 * How a waiting admin change moves the count, checked against today's admin
 * rows: making someone a Minter Admin who isn't one adds a row, if they are
 * still in MINTER; making an admin an admin again changes nothing; removing
 * an admin takes a row away;
 * removing someone who isn't an admin, or the group's owner (it can never be
 * removed), changes nothing. Several changes about one account count once.
 * A change that only follows on (projectShift) is checked against the rows
 * the changes before it leave, so a removal can make a waiting addition of
 * the same account count again.
 */
import { MINTER_GROUP_ID } from '../data/constants';
import type { TxRow } from '../data/types';
import type { Decision, DecisionKind } from './decision';
import { approvalsNeeded, meetsThreshold, type ApprovalThreshold } from './threshold';

export type AdminChangeKind = 'addAdmin' | 'removeAdmin';

export function isAdminChangeKind(kind: DecisionKind): kind is AdminChangeKind {
  return kind === 'addAdmin' || kind === 'removeAdmin';
}

/** A waiting decision as far as the target is concerned. */
export interface ShiftDecision {
  signature: string;
  kind: DecisionKind;
  subject: string | null;
  /** Confirmed approvals that count (each admin's latest). */
  approvals: number;
  /** Confirmed rejections that count (each admin's latest). */
  rejections: number;
}

/** An admin change assumed to pass: a waiting one (with its signature) or a proposal not made yet. */
export interface AdminChangeInput {
  signature?: string;
  kind: AdminChangeKind;
  subject: string | null;
}

export interface ShiftState {
  threshold: ApprovalThreshold;
  /** Core's admin count, the null owner included: the threshold's denominator. */
  adminCount: number;
  /** Today's admin rows (addresses), the null owner included. */
  admins: ReadonlySet<string> | readonly string[];
  /** The group's owner: an admin row that can never be removed. */
  owner?: string | null;
  /**
   * Today's MINTER member rows, when known in full. An add whose subject
   * isn't a member changes nothing (Core finds it invalid when it comes to
   * apply it). Unknown: every add for a non-admin counts.
   */
  members?: ReadonlySet<string> | readonly string[] | null;
}

export type ShiftEffectKind =
  /** Not enough signatures now, enough at the new target: applied at once. */
  | 'applies'
  /** Its rejections reach the new target and its approvals don't: ends as rejected at once. */
  | 'rejected'
  /** The target rises: it would need more signatures than now. */
  | 'needsMore';

export interface ShiftEffect {
  signature: string;
  effect: ShiftEffectKind;
  approvals: number;
  rejections: number;
  neededNow: number;
  neededThen: number;
  /** needsMore: the approvals it would still be missing at the new target. */
  more: number;
  /** It has enough signatures now and wouldn't then (needsMore only). */
  wasMet: boolean;
  /** Only once an admin change that itself applies at once (followOn) has passed too. */
  cascade: boolean;
}

export type ShiftScope =
  /** One admin change on its own. */
  | 'one'
  /** Every waiting removal together. */
  | 'removals'
  /** Every waiting addition together. */
  | 'adds'
  /** Every waiting admin change together. */
  | 'all';

export interface ShiftScenario {
  scope: ShiftScope;
  /** The admin changes assumed to pass. */
  changes: AdminChangeInput[];
  /** Waiting admin changes that would then apply at once too, in the order they follow. */
  followOn: string[];
  countNow: number;
  /** The admin count once the changes (and those that follow) have passed. */
  countThen: number;
  neededNow: number;
  neededThen: number;
  /**
   * The lowest count on the way there (every removal first, those that
   * follow included) and its target: where 'applies' and 'rejected' are
   * worked out. Never above countNow.
   */
  countLow: number;
  neededLow: number;
  /**
   * The highest count on the way there (every addition among `changes`
   * first) and its target: where 'needsMore' is worked out. Never below
   * countNow.
   */
  countHigh: number;
  neededHigh: number;
  /** Most at risk first: applies, rejected, then needsMore (those met now first). */
  effects: ShiftEffect[];
}

function adminSet(state: ShiftState): ReadonlySet<string> {
  return state.admins instanceof Set
    ? (state.admins as ReadonlySet<string>)
    : new Set(state.admins as readonly string[]);
}

/** Today's member rows as a set, or null when they aren't known. */
function memberSet(state: ShiftState): ReadonlySet<string> | null {
  if (!state.members) return null;
  return state.members instanceof Set
    ? (state.members as ReadonlySet<string>)
    : new Set(state.members as readonly string[]);
}

/** The admin rows `changes` add and take away, checked against today's admin (and member) rows. */
function seatMoves(
  state: ShiftState,
  changes: readonly AdminChangeInput[]
): { added: string[]; removed: string[] } {
  const admins = adminSet(state);
  const members = memberSet(state);
  const owner = state.owner ?? null;
  const touched = new Map<string, { add: boolean; remove: boolean }>();
  for (const change of changes) {
    if (!change.subject) continue;
    const t = touched.get(change.subject) ?? { add: false, remove: false };
    if (change.kind === 'addAdmin') t.add = true;
    else t.remove = true;
    touched.set(change.subject, t);
  }
  const added: string[] = [];
  const removed: string[] = [];
  for (const [address, t] of touched) {
    if (address === owner) continue;
    if (admins.has(address)) {
      if (t.remove) removed.push(address);
    } else if (t.add && (!members || members.has(address))) added.push(address);
  }
  return { added, removed };
}

/** The admin count once `changes` have passed, checked against today's admin (and member) rows. */
export function adminCountAfter(state: ShiftState, changes: readonly AdminChangeInput[]): number {
  const { added, removed } = seatMoves(state, changes);
  return Math.max(0, state.adminCount + added.length - removed.length);
}

/** The admin rows and count once `changes` have passed, for what follows them. */
function stateAfter(state: ShiftState, changes: readonly AdminChangeInput[]): ShiftState {
  const { added, removed } = seatMoves(state, changes);
  const admins = new Set(adminSet(state));
  for (const address of removed) admins.delete(address);
  for (const address of added) admins.add(address);
  return { ...state, admins, adminCount: adminCountAfter(state, changes) };
}

/** How one admin change on its own moves the count: −1, 0 or +1. */
export function adminChangeDelta(state: ShiftState, change: AdminChangeInput): number {
  return adminCountAfter(state, [change]) - Math.max(0, state.adminCount);
}

const RANK: Record<ShiftEffectKind, number> = { applies: 0, rejected: 1, needsMore: 2 };

/**
 * What happens to each decision when the count moves from `countNow` to
 * `countThen`, in the order given (callers pass the most urgent first).
 * Decisions in `exclude` are left out.
 */
export function effectsBetween(
  threshold: ApprovalThreshold,
  countNow: number,
  countThen: number,
  decisions: readonly ShiftDecision[],
  exclude: ReadonlySet<string> = new Set()
): Array<Omit<ShiftEffect, 'cascade'>> {
  const neededNow = approvalsNeeded(threshold, countNow);
  const neededThen = approvalsNeeded(threshold, countThen);
  const out: Array<Omit<ShiftEffect, 'cascade'>> = [];
  const seen = new Set<string>();
  for (const d of decisions) {
    if (exclude.has(d.signature) || seen.has(d.signature)) continue;
    seen.add(d.signature);
    const metNow = meetsThreshold(threshold, d.approvals, countNow);
    const metThen = meetsThreshold(threshold, d.approvals, countThen);
    const base = {
      signature: d.signature,
      approvals: d.approvals,
      rejections: d.rejections,
      neededNow,
      neededThen,
    };
    if (!metNow && metThen) {
      out.push({ ...base, effect: 'applies', more: 0, wasMet: false });
      continue;
    }
    if (metThen) continue;
    const rejectedNow = meetsThreshold(threshold, d.rejections, countNow);
    const rejectedThen = meetsThreshold(threshold, d.rejections, countThen);
    if (rejectedThen && !rejectedNow) {
      out.push({ ...base, effect: 'rejected', more: 0, wasMet: false });
      continue;
    }
    if (neededThen > neededNow)
      out.push({
        ...base,
        effect: 'needsMore',
        more: Math.max(0, neededThen - d.approvals),
        wasMet: metNow,
      });
  }
  return out;
}

function sortEffects(effects: ShiftEffect[]): ShiftEffect[] {
  const order = new Map(effects.map((e, i) => [e.signature, i]));
  const rank = (e: ShiftEffect) =>
    RANK[e.effect] * 2 + (e.effect === 'needsMore' && !e.wasMet ? 1 : 0);
  return [...effects].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(a.cascade) - Number(b.cascade) ||
      (order.get(a.signature) ?? 0) - (order.get(b.signature) ?? 0)
  );
}

/**
 * What the waiting decisions would do if `changes` pass: the new count and
 * target, and each decision that would apply at once, end as rejected at
 * once, or need more signatures. A waiting admin change that would itself
 * apply at once moves the count again; that is followed through
 * (`followOn`), and what only happens after it is marked `cascade`. Each
 * effect is worked out at the count where it can happen on the way there
 * (`countLow` or `countHigh`), so an addition that brings the count back
 * up doesn't hide what the drop before it does.
 */
export function projectShift(
  state: ShiftState,
  decisions: readonly ShiftDecision[],
  changes: readonly AdminChangeInput[],
  scope: ShiftScope = 'one'
): ShiftScenario {
  const countNow = Math.max(0, state.adminCount);
  const exclude = new Set(changes.map((c) => c.signature).filter((s): s is string => Boolean(s)));
  const assumed: AdminChangeInput[] = [...changes];
  const followOn: string[] = [];
  const bySignature = new Map(decisions.map((d) => [d.signature, d]));

  // Core applies each admin change on its own approval, in any order and in
  // any block, so the count can pass through values the net result hides.
  // The lowest it can reach is every removal first (follow-ons included):
  // the only count where a decision can newly apply or end as rejected. The
  // highest is every addition among `changes` first: a follow-on addition
  // only applies at a count below today's, so it never goes higher. That is
  // the only count where a decision can need more.
  const low = () =>
    adminCountAfter(
      state,
      assumed.filter((c) => c.kind === 'removeAdmin')
    );
  const high = adminCountAfter(
    state,
    changes.filter((c) => c.kind === 'addAdmin')
  );
  const merged = () => {
    const best = new Map<string, Omit<ShiftEffect, 'cascade'>>();
    for (const e of [
      ...effectsBetween(state.threshold, countNow, low(), decisions, exclude),
      ...effectsBetween(state.threshold, countNow, high, decisions, exclude),
    ]) {
      const had = best.get(e.signature);
      if (!had || RANK[e.effect] < RANK[had.effect]) best.set(e.signature, e);
    }
    const out: Array<Omit<ShiftEffect, 'cascade'>> = [];
    for (const d of decisions) {
      const e = best.get(d.signature);
      if (!e) continue;
      out.push(e);
      best.delete(d.signature);
    }
    return out;
  };
  let effects = merged();
  const firstRound = new Map(effects.map((e) => [e.signature, e.effect]));
  // A follow-on stays in `effects` as 'applies': the lowest count only falls.
  for (;;) {
    const next = effects
      .filter((e) => e.effect === 'applies' && !followOn.includes(e.signature))
      .map((e) => bySignature.get(e.signature))
      .filter((d): d is ShiftDecision => Boolean(d && isAdminChangeKind(d.kind)));
    if (!next.length) break;
    for (const d of next) {
      followOn.push(d.signature);
      assumed.push({ signature: d.signature, kind: d.kind as AdminChangeKind, subject: d.subject });
    }
    effects = merged();
  }
  // What follows on applies once the changes have passed: checked against the
  // rows they leave, so an addition of someone a removal took out counts again.
  const countThen = adminCountAfter(stateAfter(state, changes), assumed.slice(changes.length));
  const countLow = Math.min(low(), countNow);
  const countHigh = Math.max(high, countNow);

  return {
    scope,
    changes: [...changes],
    followOn,
    countNow,
    countThen,
    neededNow: approvalsNeeded(state.threshold, countNow),
    neededThen: approvalsNeeded(state.threshold, countThen),
    countLow,
    neededLow: approvalsNeeded(state.threshold, countLow),
    countHigh,
    neededHigh: approvalsNeeded(state.threshold, countHigh),
    effects: sortEffects(
      effects.map((e) => ({
        ...e,
        cascade: firstRound.get(e.signature) !== e.effect,
      }))
    ),
  };
}

/** A waiting admin change as an input to projectShift. */
export function asAdminChange(d: ShiftDecision): AdminChangeInput | null {
  return isAdminChangeKind(d.kind)
    ? { signature: d.signature, kind: d.kind, subject: d.subject }
    : null;
}

/**
 * Every projection worth showing: each waiting admin change on its own,
 * every removal together, every addition together, and all of them
 * together (each combination only when it differs from the others).
 */
export function shiftScenarios(
  state: ShiftState,
  decisions: readonly ShiftDecision[]
): ShiftScenario[] {
  const changes = decisions.map(asAdminChange).filter((c): c is AdminChangeInput => c !== null);
  const scenarios = changes.map((c) => projectShift(state, decisions, [c], 'one'));
  const removals = changes.filter((c) => c.kind === 'removeAdmin');
  const adds = changes.filter((c) => c.kind === 'addAdmin');
  if (removals.length > 1) scenarios.push(projectShift(state, decisions, removals, 'removals'));
  if (adds.length > 1) scenarios.push(projectShift(state, decisions, adds, 'adds'));
  if (removals.length && adds.length)
    scenarios.push(projectShift(state, decisions, changes, 'all'));
  return scenarios;
}

/** The one-change projection for a waiting admin change, if it is one. */
export function scenarioFor(
  scenarios: readonly ShiftScenario[],
  signature: string
): ShiftScenario | null {
  return scenarios.find((s) => s.scope === 'one' && s.changes[0]?.signature === signature) ?? null;
}

/** True when the projection changes the outcome of at least one decision. */
export function hasImpact(scenario: ShiftScenario | null | undefined): boolean {
  return Boolean(scenario && (scenario.effects.length || scenario.followOn.length));
}

export interface DecisionRisk {
  effect: ShiftEffect;
  scenario: ShiftScenario;
}

/**
 * The likeliest way an admin change flips this decision, for its chip:
 * applying or ending at once before anything else (or, for a rising target,
 * losing the signatures it has enough of now), then the fewest changes, then
 * the smallest move in the target. Null when no projection touches it that
 * way (a decision that only needs one more signature like every other isn't
 * flagged).
 */
export function riskFor(
  signature: string,
  scenarios: readonly ShiftScenario[]
): DecisionRisk | null {
  let best: DecisionRisk | null = null;
  const weight = (r: DecisionRisk) => [
    r.effect.effect === 'needsMore' ? 1 : 0,
    r.scenario.changes.length + r.scenario.followOn.length,
    // The target where this effect was worked out, not the net one.
    Math.abs(r.effect.neededNow - r.effect.neededThen),
  ];
  for (const scenario of scenarios) {
    const effect = scenario.effects.find((e) => e.signature === signature);
    if (!effect || (effect.effect === 'needsMore' && !effect.wasMet)) continue;
    const candidate = { effect, scenario };
    if (!best) {
      best = candidate;
      continue;
    }
    const a = weight(candidate);
    const b = weight(best);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] < b[i]) best = candidate;
      break;
    }
  }
  return best;
}

/** A Decision (with its tally) as the projection reads it; null for one with no tally. */
export function toShiftDecision(d: Decision): ShiftDecision | null {
  if (!d.tally) return null;
  return {
    signature: d.signature,
    kind: d.kind,
    subject: d.subject,
    approvals: d.tally.approvalCount,
    rejections: d.tally.rejectionCount,
  };
}

/**
 * The decisions Core still evaluates: everything waiting but the expired
 * ones. Doubles (rules/double.ts) stay in: one that changes nothing today
 * can still apply once another change removes or adds its subject, and a
 * repeat of a waiting change is the same change, counted once. The panel
 * and chip of one that changes nothing are kept quiet in useShift
 * (impactIn, riskIn).
 */
export function shiftDecisionsOf(decisions: readonly Decision[]): ShiftDecision[] {
  return decisions
    .filter((d) => d.phase !== 'expired')
    .map(toShiftDecision)
    .filter((d): d is ShiftDecision => d !== null);
}

// ---- the target's past changes -------------------------------------------

export interface ApprovedAdminChange {
  signature?: string;
  address: string;
  added: boolean;
  /** The block it was approved (and applied) in. */
  height: number;
}

/** The approved ADD_GROUP_ADMIN / REMOVE_GROUP_ADMIN rows among `rows`, each once, for targetSteps. */
export function approvedAdminChanges(rows: readonly TxRow[]): ApprovedAdminChange[] {
  const seen = new Set<string>();
  const out: ApprovedAdminChange[] = [];
  for (const tx of rows) {
    if (!tx || seen.has(tx.signature)) continue;
    if (tx.approvalStatus !== 'APPROVED' || typeof tx.approvalHeight !== 'number') continue;
    const address =
      tx.type === 'ADD_GROUP_ADMIN'
        ? tx.member
        : tx.type === 'REMOVE_GROUP_ADMIN'
          ? tx.admin
          : null;
    if (typeof address !== 'string' || !address) continue;
    seen.add(tx.signature);
    out.push({
      signature: tx.signature,
      address,
      added: tx.type === 'ADD_GROUP_ADMIN',
      height: tx.approvalHeight,
    });
  }
  return out;
}

/** A MINTER LEAVE_GROUP, and whether the leaver was a Minter Admin when they left. */
export interface AdminLeave {
  signature?: string;
  address: string;
  /** The block it is in. */
  height: number;
  /**
   * Null when nothing in the rows read says. targetSteps then takes it as a
   * member's leave, as most are: with nothing on record either way, counting
   * every such leave as unknown would leave almost no step with a number.
   */
  wasAdmin: boolean | null;
}

function isMinterRow(tx: TxRow): boolean {
  return typeof tx.groupId === 'number'
    ? tx.groupId === MINTER_GROUP_ID
    : tx.txGroupId === MINTER_GROUP_ID;
}

/**
 * The confirmed MINTER LEAVE_GROUP rows among `rows`, each once, newest
 * first. Core deletes a leaving admin's admin row along with their member
 * row, with no approval, so a leave can move the admin count too. Whether
 * the leaver was an admin then: the newest approved admin change about them
 * before the leave (an add: yes; a removal: no), or their own JOIN_GROUP
 * after it (someone who joins is a member, not an admin); failing those,
 * yes when they signed a GROUP_APPROVAL before it (`approvals`: the caller
 * passes only those on MINTER decisions, which only its admins can sign).
 * Null when none of these is in the rows read. MINTER's owner can't leave
 * and is skipped.
 */
export function adminLeaves(
  rows: readonly TxRow[],
  changes: readonly ApprovedAdminChange[],
  options: { owner?: string | null; approvals?: readonly TxRow[] } = {}
): AdminLeave[] {
  const confirmed = (tx: TxRow | null | undefined, type: string): tx is TxRow =>
    Boolean(
      tx &&
      tx.type === type &&
      typeof tx.blockHeight === 'number' &&
      typeof tx.creatorAddress === 'string' &&
      tx.creatorAddress
    );
  const joins = rows.filter((tx) => confirmed(tx, 'JOIN_GROUP') && isMinterRow(tx));
  const signed = (options.approvals ?? []).filter((tx) => confirmed(tx, 'GROUP_APPROVAL'));
  const seen = new Set<string>();
  const out: AdminLeave[] = [];
  for (const tx of rows) {
    if (!confirmed(tx, 'LEAVE_GROUP') || !isMinterRow(tx) || seen.has(tx.signature)) continue;
    const address = tx.creatorAddress as string;
    const height = tx.blockHeight as number;
    if (options.owner && address === options.owner) continue;
    seen.add(tx.signature);
    let newest: { height: number; wasAdmin: boolean } | null = null;
    for (const c of changes) {
      if (c.address !== address || c.height >= height) continue;
      if (!newest || c.height > newest.height) newest = { height: c.height, wasAdmin: c.added };
    }
    for (const j of joins) {
      const at = j.blockHeight as number;
      if (j.creatorAddress !== address || at >= height) continue;
      if (!newest || at > newest.height) newest = { height: at, wasAdmin: false };
    }
    const wasAdmin =
      newest?.wasAdmin ??
      (signed.some((a) => a.creatorAddress === address && (a.blockHeight as number) < height)
        ? true
        : null);
    out.push({ signature: tx.signature, address, height, wasAdmin });
  }
  return out.sort((a, b) => b.height - a.height);
}

export interface TargetStep extends ApprovedAdminChange {
  countBefore: number;
  countAfter: number;
  neededBefore: number;
  neededAfter: number;
}

type CountEvent = { at: number; change: ApprovedAdminChange } | { at: number; leave: AdminLeave };

/** Approved changes and leaves, newest first (in one block, a change after a leave). */
function newestFirstEvents(
  changes: readonly ApprovedAdminChange[],
  leaves: readonly AdminLeave[]
): CountEvent[] {
  const events: CountEvent[] = [
    ...changes.map((change) => ({ at: change.height, change })),
    ...leaves.map((leave) => ({ at: leave.height, leave })),
  ];
  return events.sort((a, b) => b.at - a.at || Number('leave' in a) - Number('leave' in b));
}

/**
 * The admin count and target before and after each approved admin change,
 * newest first, worked back from today's count. Each approved change moved
 * the count by one, and so did each leave of an admin (`leaves`, with no
 * step of its own). `changes` and `leaves` must hold every approved admin
 * change and leave from the oldest one wanted up to now (one unbroken read),
 * or the counts drift. A leave with nothing on record about the leaver
 * (wasAdmin null) is taken as a member's.
 */
export function targetSteps(
  changes: readonly ApprovedAdminChange[],
  currentCount: number,
  threshold: ApprovalThreshold,
  leaves: readonly AdminLeave[] = []
): TargetStep[] {
  let running = Math.max(0, currentCount);
  const steps: TargetStep[] = [];
  for (const event of newestFirstEvents(changes, leaves)) {
    if ('leave' in event) {
      if (event.leave.wasAdmin === true) running += 1;
      continue;
    }
    const { change } = event;
    const countAfter = running;
    const countBefore = Math.max(0, change.added ? countAfter - 1 : countAfter + 1);
    running = countBefore;
    steps.push({
      ...change,
      countBefore,
      countAfter,
      neededBefore: approvalsNeeded(threshold, countBefore),
      neededAfter: approvalsNeeded(threshold, countAfter),
    });
  }
  return steps;
}

/**
 * The admin count at the end of block `height`, worked back from today's
 * count through the approved changes and leaves after it, as targetSteps
 * does.
 */
export function adminCountAt(
  changes: readonly ApprovedAdminChange[],
  leaves: readonly AdminLeave[],
  currentCount: number,
  height: number
): number {
  let running = Math.max(0, currentCount);
  for (const event of newestFirstEvents(changes, leaves)) {
    if (event.at <= height) break;
    if ('leave' in event) {
      if (event.leave.wasAdmin === true) running += 1;
    } else running = Math.max(0, event.change.added ? running - 1 : running + 1);
  }
  return running;
}

/** The steps that moved the target (not just the admin count). */
export function targetMoves(steps: readonly TargetStep[]): TargetStep[] {
  return steps.filter((s) => s.neededBefore !== s.neededAfter);
}
