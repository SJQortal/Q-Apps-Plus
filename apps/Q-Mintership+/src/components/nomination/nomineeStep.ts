/**
 * The signed-in nominee's next step, as one pure rule so every screen words
 * it the same: Accept while the nomination waits or collects signatures and
 * no join request is open, Join once approved, nothing for members or while
 * a ban is in force.
 */
import type { NominationState } from '../../rules/nomination';

export type JoinMode = 'accept' | 'join';

export type NomineeStep = JoinMode | 'accepted' | null;

export const JOIN_LABEL: Record<JoinMode, string> = {
  accept: 'Accept nomination',
  join: 'Join now',
};

export interface NomineeStepInput {
  isMember: boolean;
  activeBan: boolean;
  hasJoinRequest: boolean;
  /** An approved invite is stored for them, unused. */
  storedInvite: boolean;
  /** Their open nomination's state, if they have one. */
  state: NominationState | null;
}

export function nomineeStep(input: NomineeStepInput): NomineeStep {
  if (input.isMember || input.activeBan) return null;
  if (input.storedInvite || input.state === 'approved') return 'join';
  if (input.hasJoinRequest) return 'accepted';
  if (input.state === 'waiting' || input.state === 'signing') return 'accept';
  return null;
}
