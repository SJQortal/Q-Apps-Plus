/**
 * A + Propose page's form as the write takes it, kept out of the component
 * files: the proposal from the kind, the person, the reason and a ban's
 * length (a decline is a kick, marked as one).
 */
import type { Proposal } from '../../../writes/flows';
import type { ProposeKind } from '../proposeKinds';

export function toProposal(
  kind: ProposeKind,
  subject: string,
  reason: string,
  banSeconds: number
): Proposal {
  switch (kind) {
    case 'kick':
      return { kind, subject, reason };
    case 'decline':
      return { kind: 'kick', subject, reason, decline: true };
    case 'ban':
      return { kind, subject, reason, banSeconds };
    default:
      return { kind, subject };
  }
}
