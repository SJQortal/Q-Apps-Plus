/**
 * What waiting admin changes would do to the target (each, and together),
 * shared by the Decisions queue and a decision's own page.
 */
import { useMemo } from 'react';
import { NULL_OWNER } from '../../data/constants';
import type { DecisionsData } from '../../data/decisions';
import type { Decision } from '../../rules/decision';
import {
  isAdminChangeKind,
  riskFor,
  scenarioFor,
  shiftDecisionsOf,
  shiftScenarios,
  type ShiftState,
} from '../../rules/targetShift';

export function useShift(data: DecisionsData | null | undefined) {
  return useMemo(() => {
    if (!data) return null;
    const state: ShiftState = {
      threshold: data.group.approvalThreshold,
      adminCount: data.admins.adminCount,
      admins: new Set(data.admins.admins.map((a) => a.member)),
      owner: data.group.owner || NULL_OWNER,
    };
    const list = shiftDecisionsOf(data.decisions);
    return { state, list, scenarios: shiftScenarios(state, list) };
  }, [data]);
}

export type Shift = NonNullable<ReturnType<typeof useShift>>;

/** An admin change: what it does to the target if it passes. */
export function impactIn(shift: Shift | null, d: Decision) {
  return shift && isAdminChangeKind(d.kind) ? scenarioFor(shift.scenarios, d.signature) : null;
}

/** A waiting admin change would tip this decision over (the chip). */
export function riskIn(shift: Shift | null, d: Decision) {
  return shift ? riskFor(d.signature, shift.scenarios) : null;
}
