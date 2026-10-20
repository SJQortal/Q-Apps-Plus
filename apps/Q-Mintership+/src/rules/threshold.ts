/**
 * Group approval thresholds, exactly as Qortal Core decides them
 * (org.qortal.group.Group.ApprovalThreshold, Core 6.1.4–6.1.9):
 *
 * - NONE: `approvals >= 0`, always met;
 * - ONE: `approvals >= 1`;
 * - PCTn: `approvals * 100 >= totalAdmins * n`, integer arithmetic.
 *
 * `totalAdmins` is Core's count of the group's admin rows, re-read in every
 * block. For MINTER it includes the group's null owner, which counts as an
 * admin but can never sign, so the denominator is the admin count Core
 * reports, not the number of people who can sign.
 */

export type ApprovalThreshold = 'NONE' | 'ONE' | 'PCT20' | 'PCT40' | 'PCT60' | 'PCT80' | 'PCT100';

export const APPROVAL_THRESHOLDS: readonly ApprovalThreshold[] = [
  'NONE',
  'ONE',
  'PCT20',
  'PCT40',
  'PCT60',
  'PCT80',
  'PCT100',
];

const VALUES: Record<ApprovalThreshold, { value: number; isPercentage: boolean }> = {
  NONE: { value: 0, isPercentage: false },
  ONE: { value: 1, isPercentage: false },
  PCT20: { value: 20, isPercentage: true },
  PCT40: { value: 40, isPercentage: true },
  PCT60: { value: 60, isPercentage: true },
  PCT80: { value: 80, isPercentage: true },
  PCT100: { value: 100, isPercentage: true },
};

export function isApprovalThreshold(value: unknown): value is ApprovalThreshold {
  return typeof value === 'string' && value in VALUES;
}

/** Core's `meetsApprovalThreshold(currentApprovals, totalAdmins)`. */
export function meetsThreshold(
  threshold: ApprovalThreshold,
  approvals: number,
  totalAdmins: number
): boolean {
  const { value, isPercentage } = VALUES[threshold];
  if (!isPercentage) return approvals >= value;
  return approvals * 100 >= totalAdmins * value;
}

/**
 * The smallest number of approvals that meets the threshold. For a
 * percentage this is ceil(totalAdmins × n / 100), computed in integers.
 */
export function approvalsNeeded(threshold: ApprovalThreshold, totalAdmins: number): number {
  const { value, isPercentage } = VALUES[threshold];
  if (!isPercentage) return value;
  return Math.ceil((Math.max(0, totalAdmins) * value) / 100);
}

/** The percentage for display ("40%"), or null for NONE and ONE. */
export function thresholdPercent(threshold: ApprovalThreshold): number | null {
  const { value, isPercentage } = VALUES[threshold];
  return isPercentage ? value : null;
}

/** "40% of admins", "one admin", "no approval". */
export function describeThreshold(threshold: ApprovalThreshold): string {
  if (threshold === 'NONE') return 'no approval';
  if (threshold === 'ONE') return 'one admin';
  return `${VALUES[threshold].value}% of admins`;
}
