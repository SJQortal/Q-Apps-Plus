/**
 * The signed-in nominee's next step, as one pure rule so every screen words
 * it the same: Accept while the nomination waits or collects signatures and
 * no join request is open, ready once one is (however it was sent), Join
 * once approved, nothing for members, while a ban is in force, or once
 * enough Minter Admins have rejected the nomination.
 */
import type { NominationState } from '../../rules/nomination';

export type JoinMode = 'accept' | 'join';

export type NomineeStep = JoinMode | 'ready' | null;

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
  /**
   * Enough Minter Admins have rejected it: it ends as rejected, so there is
   * nothing to accept and nothing to be ready for.
   */
  rejectedEnd?: boolean;
}

export function nomineeStep(input: NomineeStepInput): NomineeStep {
  if (input.isMember || input.activeBan) return null;
  if (input.storedInvite || input.state === 'approved') return 'join';
  if (input.rejectedEnd) return null;
  if (input.hasJoinRequest) return 'ready';
  if (input.state === 'waiting' || input.state === 'signing') return 'accept';
  return null;
}
