/** The set pages' summary words: every count with its denominator. */
import type { Funded } from '../../../data/explorer/funded';
import { formatCount, plural } from '../../../utils/format';

/** "in its first 100 payments" / "in its 6 payments" / "in its only payment". */
function within(funded: Pick<Funded, 'payments' | 'truncated'>): string {
  if (funded.truncated) return `in its first ${formatCount(funded.payments)} payments`;
  return funded.payments === 1
    ? 'in its only payment'
    : `in its ${plural(funded.payments, 'payment')}`;
}

/**
 * "Of the 96 accounts H paid in its first 100 payments, H made the first
 * QORT payment to 41." While some are unchecked: "Checked 50 of the 96
 * accounts … : H made the first QORT payment to 23 of them."
 */
export function fundedSummary(
  funded: Pick<Funded, 'payments' | 'truncated' | 'checked'> & { paid: readonly unknown[] },
  label: string,
  first: number
): string {
  const paid = funded.paid.length;
  if (funded.checked >= paid)
    return `Of the ${plural(paid, 'account')} ${label} paid ${within(funded)}, ${label} made the first QORT payment to ${formatCount(first)}.`;
  return `Checked ${formatCount(funded.checked)} of the ${plural(paid, 'account')} ${label} paid ${within(funded)}: ${label} made the first QORT payment to ${formatCount(first)} of them.`;
}
