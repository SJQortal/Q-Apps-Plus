/**
 * Decisions by type, for "By type" on the Decisions page: each kind of
 * change in a section of its own, named as its cards are, in a fixed order
 * (new minters first), each keeping the queue's order (most urgent first).
 * A kick that declines a join request is its own type; removals and bans
 * share one; making, removing, becoming a Minter Admin and stepping down
 * share another. Pure, so the order and the names are pinned by tests.
 */
import type { Decision } from '../../rules/decision';

export type DecisionGroup =
  'invite' | 'decline' | 'removal' | 'liftBan' | 'cancelInvite' | 'admins' | 'other';

export const DECISION_GROUPS: ReadonlyArray<{ key: DecisionGroup; label: string }> = [
  { key: 'invite', label: 'Add to MINTER' },
  { key: 'decline', label: 'Decline a join request' },
  { key: 'removal', label: 'Remove or ban' },
  { key: 'liftBan', label: 'Lift a ban' },
  { key: 'cancelInvite', label: 'Cancel an approved invite' },
  { key: 'admins', label: 'Minter Admin changes' },
  { key: 'other', label: 'Other group changes' },
];

export function decisionGroup(d: Pick<Decision, 'kind' | 'decline'>): DecisionGroup {
  switch (d.kind) {
    case 'invite':
      return 'invite';
    case 'kick':
      return d.decline ? 'decline' : 'removal';
    case 'ban':
      return 'removal';
    case 'cancelBan':
      return 'liftBan';
    case 'cancelInvite':
      return 'cancelInvite';
    case 'addAdmin':
    case 'removeAdmin':
      return 'admins';
    default:
      return 'other';
  }
}

/** The groups that have decisions, in DECISION_GROUPS order, each in the given order. */
export function groupDecisions<D extends Pick<Decision, 'kind' | 'decline'>>(
  decisions: readonly D[]
): Array<{ key: DecisionGroup; label: string; decisions: D[] }> {
  return DECISION_GROUPS.map((g) => ({
    ...g,
    decisions: decisions.filter((d) => decisionGroup(d) === g.key),
  })).filter((g) => g.decisions.length > 0);
}

/** The DOM id of a group's section, for the jump links. */
export function decisionGroupId(key: DecisionGroup): string {
  return `collecting-${key}`;
}
