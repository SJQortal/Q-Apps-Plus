/**
 * What waiting admin changes would do to the target (each, and together),
 * shared by the Decisions queue and a decision's own page.
 */
import { useMemo } from 'react';
import { NULL_OWNER } from '../../data/constants';
import type { DecisionsData } from '../../data/decisions';
import type { MemberList } from '../../data/group';
import type { Decision } from '../../rules/decision';
import {
  isAdminChangeKind,
  riskFor,
  scenarioFor,
  shiftDecisionsOf,
  shiftScenarios,
  type ShiftState,
} from '../../rules/targetShift';

/**
 * `members`: MINTER's member list (the shared 'group:members' read), so an
 * addition for someone no longer in MINTER doesn't count as a new seat.
 * While it is unknown or cut short, every addition for a non-admin does.
 */
export function useShift(data: DecisionsData | null | undefined, members?: MemberList | null) {
  return useMemo(() => {
    if (!data) return null;
    const state: ShiftState = {
      threshold: data.group.approvalThreshold,
      adminCount: data.admins.adminCount,
      admins: new Set(data.admins.admins.map((a) => a.member)),
      owner: data.group.owner || NULL_OWNER,
      members:
        members && !members.truncated ? new Set(members.members.map((m) => m.member)) : undefined,
    };
    const list = shiftDecisionsOf(data.decisions);
    return { state, list, scenarios: shiftScenarios(state, list) };
  }, [data, members]);
}

export type Shift = NonNullable<ReturnType<typeof useShift>>;

/** A double that changes nothing (rules/double.ts: alreadyInEffect): no seat moves if it passes. */
function changesNothing(d: Decision): boolean {
  return d.double?.reason === 'alreadyInEffect';
}

/**
 * An admin change: what it does to the target if it passes. Nothing for a
 * double that changes nothing (rules/double.ts), so no impact to check
 * before Hub. A repeat of a waiting change shows the same as the earlier
 * one: either can pass first, and the one that does moves the seat.
 */
export function impactIn(shift: Shift | null, d: Decision) {
  return shift && isAdminChangeKind(d.kind) && !changesNothing(d)
    ? scenarioFor(shift.scenarios, d.signature)
    : null;
}

/** A waiting admin change would tip this decision over (the chip; never on a double that changes nothing). */
export function riskIn(shift: Shift | null, d: Decision) {
  return shift && !changesNothing(d) ? riskFor(d.signature, shift.scenarios) : null;
}
