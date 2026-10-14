/**
 * The words for a moving target (rules/targetShift.ts), kept pure so tests
 * can pin them: what an admin change does to the target, what each waiting
 * decision would do then, the chip on an affected decision, and why the
 * target changed since the last visit.
 */
import type {
  AdminChangeInput,
  ApprovedAdminChange,
  DecisionRisk,
  ShiftEffect,
  ShiftScenario,
} from '../../rules/targetShift';
import { formatCount, plural } from '../../utils/format';

/** A decision's label by its signature ("Remove from MINTER: Kai Target"). */
export type LabelOf = (signature: string) => string;

/** "a and b", "a, b and c". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "drops from 9 to 8 signatures", "rises from 8 to 9 signatures", "stays at 8 signatures". */
export function targetMove(neededNow: number, neededThen: number): string {
  if (neededThen < neededNow)
    return `drops from ${neededNow} to ${plural(neededThen, 'signature')}`;
  if (neededThen > neededNow)
    return `rises from ${neededNow} to ${plural(neededThen, 'signature')}`;
  return `stays at ${plural(neededThen, 'signature')}`;
}

/**
 * "If this passes, MINTER has 20 admin seats and the target drops from 9 to
 * 8 signatures." `lead` names what passes ("If this passes"). When the
 * count can dip lower on the way (a removal first, an addition after), that
 * is said too.
 */
export function shiftSentence(s: ShiftScenario, lead: string): string {
  const seats = `MINTER has ${plural(s.countThen, 'admin seat')}`;
  const same = s.neededThen === s.neededNow;
  const dip =
    s.neededLow < Math.min(s.neededNow, s.neededThen)
      ? `, but on the way MINTER can drop to ${plural(s.countLow, 'admin seat')} (target ${s.neededLow})`
      : '';
  return `${lead}, ${seats}${same ? ';' : ' and'} the target ${targetMove(s.neededNow, s.neededThen)}${dip}.`;
}

/** What passes, for a scenario's lead: "If this passes", "If all 3 waiting removals pass", … */
export function scenarioLead(s: ShiftScenario, own = true): string {
  const n = s.changes.length;
  switch (s.scope) {
    case 'one':
      return own ? 'If this passes' : 'If it passes';
    case 'removals':
      return `If all ${n} waiting admin removals pass`;
    case 'adds':
      return `If all ${n} waiting new admins pass`;
    case 'all':
      return `If all ${n} waiting admin changes pass`;
  }
}

/** "Remove from MINTER: Kai Target (8 of 9)", with what changes for it. */
export function effectLine(e: ShiftEffect, label: string): string {
  switch (e.effect) {
    case 'applies':
      return `${label} (${e.approvals} of ${e.neededNow})`;
    case 'rejected':
      return `${label} (${plural(e.rejections, 'rejection')}; ${e.neededThen} would end it)`;
    case 'needsMore':
      return e.wasMet
        ? `${label} (${e.approvals} of ${e.neededNow}: enough now, ${e.more} short then)`
        : `${label} (${e.approvals} of ${e.neededNow} now, ${e.approvals} of ${e.neededThen} then)`;
  }
}

/** The admin changes a scenario assumes, by label (a proposal not made yet is `proposal`). */
export function changeNames(
  changes: readonly AdminChangeInput[],
  labelOf: LabelOf,
  proposal = 'this proposal'
): string {
  return joinAnd(changes.map((c) => (c.signature ? labelOf(c.signature) : proposal)));
}

/**
 * The chip on an affected decision: "Target may drop to 8". The target is
 * the one this decision's effect was worked out at, which can be lower (or
 * higher) on the way than once everything has passed.
 */
export function riskChipLabel(risk: DecisionRisk): string {
  const { neededNow, neededThen } = risk.effect;
  return neededThen < neededNow
    ? `Target may drop to ${neededThen}`
    : `Target may rise to ${neededThen}`;
}

/** The chip's explanation, one sentence each: why, then what would happen. */
export function riskExplanation(risk: DecisionRisk, labelOf: LabelOf): string[] {
  const { effect: e, scenario: s } = risk;
  const names = changeNames(s.changes, labelOf);
  const passes = s.changes.length === 1 ? 'passes' : 'pass';
  const via = s.followOn.length
    ? ` (with ${joinAnd(s.followOn.map(labelOf))}, which would then apply at once too)`
    : '';
  // A rising target is worked out at the highest count on the way, the rest
  // at the lowest; either can differ from where the count ends up.
  const count = e.effect === 'needsMore' ? s.countHigh : s.countLow;
  const seats =
    count === s.countThen
      ? `MINTER has ${plural(count, 'admin seat')} and`
      : `MINTER can ${count < s.countNow ? 'drop' : 'rise'} to ${plural(count, 'admin seat')} on the way, and then`;
  const why = `If ${names} ${passes}${via}, ${seats} the target ${targetMove(e.neededNow, e.neededThen)}.`;
  switch (e.effect) {
    case 'applies':
      return [
        why,
        `This decision has ${plural(e.approvals, 'signature')}, so Core would apply it at once, in the same block or the next, with no new signature.`,
      ];
    case 'rejected':
      return [
        why,
        `It has ${plural(e.rejections, 'rejection')}, so it would end as rejected at once, in the same block or the next.`,
      ];
    case 'needsMore':
      return [
        why,
        `It has ${plural(e.approvals, 'signature')}: enough today, but if the admin change comes first it needs ${formatCount(e.more)} more.`,
      ];
  }
}

/** What to do about it, for Minter Admins. */
export const ORDER_ADVICE =
  'Before an admin change passes, settle the decisions it would flip (or let them expire), or agree the order with the other Minter Admins.';

/**
 * The on-chain way back for an admin who signed a decision at risk, to do
 * before `deadline` ("the admin change passes", "block 1,233").
 */
export function withdrawAdvice(fee: string, deadline = 'the admin change passes'): string {
  return `Signed one of these and don’t want it to go through this way? You can withdraw your signature before ${deadline}. A withdrawal counts as a rejection, only each admin’s latest answer counts, and it costs ${fee}.`;
}

/** The banner's title: "The target changed from 9 to 7 signatures". */
export function targetChangedTitle(fromNeeded: number, toNeeded: number): string {
  return fromNeeded === toNeeded
    ? 'MINTER’s admin seats changed'
    : `The target changed from ${fromNeeded} to ${plural(toNeeded, 'signature')}`;
}

export interface TargetChangeReason {
  added: number;
  removed: number;
  /** True when the approved changes read explain the whole change in the count. */
  complete: boolean;
}

/**
 * Who moved the count between two visits, from the approved admin changes
 * read since (null when they weren't read, or don't add up to the change).
 */
export function changeReason(
  fromCount: number,
  toCount: number,
  changes: readonly ApprovedAdminChange[] | null
): TargetChangeReason {
  if (!changes) return { added: 0, removed: 0, complete: false };
  const added = changes.filter((c) => c.added).length;
  const removed = changes.length - added;
  return {
    added,
    removed,
    complete: added - removed === toCount - fromCount && changes.length > 0,
  };
}

/** "MINTER has 2 fewer admin seats (21; it had 23)". */
export function seatChange(fromCount: number, toCount: number): string {
  const diff = toCount - fromCount;
  if (diff === 0) return `MINTER still has ${plural(toCount, 'admin seat')}`;
  const n = Math.abs(diff);
  return `MINTER has ${formatCount(n)} ${diff < 0 ? 'fewer' : 'more'} admin seat${n === 1 ? '' : 's'} (${formatCount(toCount)}; it had ${formatCount(fromCount)})`;
}

/** "2 Minter Admins were removed", "1 was added and 2 were removed". */
export function reasonWords(reason: TargetChangeReason): string {
  const part = (n: number, verb: string, first: boolean) =>
    `${first ? plural(n, 'Minter Admin') : formatCount(n)} ${n === 1 ? 'was' : 'were'} ${verb}`;
  if (reason.added && reason.removed)
    return `${part(reason.added, 'added', true)} and ${part(reason.removed, 'removed', false)}`;
  if (reason.added) return part(reason.added, 'added', true);
  return part(reason.removed, 'removed', true);
}
