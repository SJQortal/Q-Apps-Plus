/** The signed-in person's own nomination and next step (OwnNomination.tsx shows them). */
import { nomineeStep, type NomineeStep } from '../../components/nomination/nomineeStep';
import type { Nomination, NominationsData } from '../../data/nominations';
import type { MyStatus } from '../../rules/status';

export interface OwnNominationFacts {
  /** Their open nomination, if any. */
  own: Nomination | null;
  /** Their next step (Accept, Join now…), if any. */
  step: NomineeStep;
  /** Their nomination shows: one is open, or they were approved and only joining is left. */
  shown: boolean;
}

/** The signed-in person's own nomination and next step, from the nominations and their status. */
export function ownNominationOf(
  data: NominationsData | undefined,
  me: string,
  status: MyStatus | undefined
): OwnNominationFacts {
  const own = data && me ? (data.open.find((n) => n.nominee === me) ?? null) : null;
  const step =
    me && status
      ? nomineeStep({
          isMember: status.isMember,
          activeBan: Boolean(status.activeBan),
          hasJoinRequest: status.hasJoinRequest || Boolean(own?.hasJoinRequest),
          storedInvite: Boolean(status.storedInvite) || Boolean(own?.hasStoredInvite),
          state: own?.state ?? null,
          rejectedEnd: own?.decision?.phase === 'rejectedMet',
        })
      : null;
  return { own, step, shown: Boolean(own) || step === 'join' };
}
