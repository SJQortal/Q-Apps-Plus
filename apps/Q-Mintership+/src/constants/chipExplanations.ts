/**
 * What a status chip means, said on hover, on focus and on a tap (Simon,
 * 2026-10-17: "when there are these minting penalty and so on, can you
 * explain to users on hover what it means"). From Core's own rules and the
 * Qortal wiki (qortal.dev/wiki: Minting, Q-Mintership), in plain words:
 * facts, never a verdict about the account.
 */
import { formatCount } from '../utils/format';

/** A minting level: what it is, and what level 5 and up add. */
export function levelExplanation(level: number): string {
  if (level <= 0)
    return 'Level 0: no minting level yet. Level 1 takes about 7,200 blocks minted, and levels rise with the blocks an account helps mint.';
  return `Minting level ${level} of 10, from the blocks this account has helped mint. Level 5 and up can nominate new minters; higher levels share more of each block’s reward.`;
}

/**
 * A minting penalty: Core's self-sponsorship check (SelfSponsorshipAlgo V1
 * at block 1,092,400; V2 and V3 at blocks 1,611,200 and 1,612,200) set
 * −5,000,000 on an account's blocks minted, which holds its level at 0.
 * `penalty`: Core's `blocksMintedPenalty`, when known.
 */
export function penaltyExplanation(penalty?: number | null): string {
  const amount =
    typeof penalty === 'number' && penalty !== 0
      ? `${formatCount(Math.abs(penalty))} blocks`
      : 'a large number of blocks';
  return `Core’s self-sponsorship check took ${amount} off what this account has minted, which holds it at level 0. ${PENALTY_WHY}`;
}

/** What the self-sponsorship check was and what it looked for (after the penalty itself). */
export const PENALTY_WHY =
  'Core ran that check over the whole chain in December 2022 and February 2024, looking for patterns from the days when accounts were sponsored into minting: sponsored accounts passing their rewards on to the same few accounts, sponsorships given out in bulk, minting levels moved on to other accounts. The chain doesn’t record which pattern matched.';

export const MEMBER_EXPLANATION =
  'In the MINTER group: its node can mint blocks. New members are nominated by a level 5+ minter and approved by the Minter Admins.';
export const OUTSIDE_EXPLANATION =
  'Not in the MINTER group, so it doesn’t mint. To join, a level 5+ minter nominates it and the Minter Admins approve.';
export const FORMER_EXPLANATION =
  'It was in the MINTER group and isn’t now: it left, or the Minter Admins removed it.';
export const BANNED_EXPLANATION =
  'The Minter Admins banned it from the MINTER group: it can’t join while the ban lasts.';
export const ADMIN_EXPLANATION =
  'A Minter Admin: one of the community-elected admins of the MINTER group, who add and remove minters together, by group approval.';
export const DEV_ADMIN_EXPLANATION =
  'A Dev Admin: an admin of the Dev group, which looks after Core’s updates. Separate from the Minter Admins.';
export const MINTING_EXPLANATION =
  'Minting now: Core lists it among the accounts online and minting the latest blocks.';
export const GROUP_OWNER_EXPLANATION = 'It owns this group.';
export const GROUP_ADMIN_EXPLANATION = 'An admin of this group.';
export const PRIMARY_NAME_EXPLANATION = 'Its primary name: the name Qortal shows for this account.';
export const NOMINATED_EXPLANATION =
  'A level 5+ minter has nominated it for MINTER; the Minter Admins decide.';
export const APPROVED_INVITE_EXPLANATION =
  'Enough Minter Admins approved its invite to MINTER: it joins by pressing Join now.';
export const JOIN_REQUEST_EXPLANATION =
  'It asked to join the MINTER group; the Minter Admins can accept or decline the request.';

/** A nomination's state chip (rules/nomination.ts NominationState). */
export const NOMINATION_STATE_EXPLANATION = {
  waiting: 'Nominated. No Minter Admin has proposed the MINTER invite yet.',
  signing:
    'A Minter Admin proposed the MINTER invite. It takes effect once enough Minter Admins approve it.',
  approved: 'Enough Minter Admins approved the invite. The nominee finishes by pressing Join now.',
  joined: 'The nominee is in the MINTER group.',
  expired: 'The invite’s time for approvals ran out before enough Minter Admins approved it.',
  rejected: 'Enough Minter Admins rejected the invite.',
  lapsed: 'No Minter Admin proposed the invite before the nomination’s time ran out.',
  blocked: 'The nominee is banned from MINTER. The ban has to be lifted before they can join.',
} as const;

/** A decision's phase chip (rules/decision.ts DecisionPhase). */
export const DECISION_PHASE_EXPLANATION = {
  unconfirmed: 'Sent, but not in a block yet.',
  early:
    'Minter Admins can approve or reject it now. Core can’t decide it for a few more blocks, whatever the count.',
  open: 'Minter Admins can approve or reject it now; Core decides it once enough have.',
  thresholdMet: 'Enough Minter Admins approved it: Core applies it in its next decision block.',
  rejectedMet: 'Enough Minter Admins rejected it: Core ends it as rejected.',
  tooLate:
    'Its time is nearly up: an approval sent now would land too late to count. Core ends it soon.',
  expired: 'Its time ran out before enough Minter Admins approved it.',
} as const;
