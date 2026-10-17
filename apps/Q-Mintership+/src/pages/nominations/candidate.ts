/**
 * What the Nominate form needs to know about a candidate before anyone writes
 * a word: who they are (name, level, blocks minted, MINTER role) and whether
 * they can be nominated now (rules/nomination.ts → nomineeBlock). Cached GETs
 * only; publishNomination checks again, fresh, right before Hub opens.
 */
import {
  effectiveBlocksMinted,
  getAccount,
  getPrimaryName,
  hasRegisteredName,
} from '../../data/accounts';
import { findOpenDecision, loadDecisions } from '../../data/decisions';
import {
  activeBanFor,
  getBans,
  getJoinRequestFor,
  getMembership,
  getStoredInviteFor,
} from '../../data/group';
import { loadNominationsFor, type Nomination } from '../../data/nominations';
import { fetchQuery } from '../../data/query';
import type { Decision } from '../../rules/decision';
import { isOpenState, nomineeBlock, type NomineeBlock } from '../../rules/nomination';

export interface Candidate {
  address: string;
  name: string | null;
  level: number;
  /** Blocks minted as Core counts them for levels. */
  blocksMinted: number;
  isMember: boolean;
  isAdmin: boolean;
  activeBan: boolean;
  /** They already sent JOIN_GROUP: an approval makes them a member at once. */
  hasJoinRequest: boolean;
  /** An approved invite is stored for them: they only need to join. */
  storedInvite: boolean;
  /** The invite collecting signatures for them, if any. */
  pendingInvite: Decision | null;
  /** Their open nomination (support it instead), if any. */
  openNomination: Nomination | null;
  /** They have registered a name: a nominee needs one. */
  hasName: boolean;
}

/** Key prefix of this screen's own reads. */
export const CANDIDATE_KEY = 'candidate:';

export function loadCandidate(
  address: string,
  options: { force?: boolean } = {}
): Promise<Candidate> {
  return fetchQuery(
    `${CANDIDATE_KEY}${address}`,
    async () => {
      const force = options.force;
      const [account, name, membership, bans, stored, joinRequest, nominations, decisions, named] =
        await Promise.all([
          getAccount(address, { force }),
          getPrimaryName(address).catch(() => null),
          getMembership(address, { force }),
          getBans({ force }),
          getStoredInviteFor(address, { force }),
          getJoinRequestFor(address, { force }),
          loadNominationsFor(address, { force }),
          loadDecisions({ force }),
          hasRegisteredName(address, { force }),
        ]);
      return {
        address,
        name,
        level: account.level,
        blocksMinted: effectiveBlocksMinted(account),
        isMember: membership.isMember || membership.isAdmin,
        isAdmin: membership.isAdmin,
        activeBan: Boolean(activeBanFor(bans, address, decisions.now.timestamp)),
        hasJoinRequest: Boolean(joinRequest),
        storedInvite: Boolean(stored),
        pendingInvite: findOpenDecision(decisions, address, 'invite'),
        openNomination: nominations.find((n) => isOpenState(n.state)) ?? null,
        hasName: named,
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** Why `candidate` can't be nominated by `me` now, or null. */
export function candidateBlock(candidate: Candidate, me: string): NomineeBlock | null {
  return nomineeBlock({
    self: candidate.address === me,
    isMember: candidate.isMember,
    activeBan: candidate.activeBan,
    openNomination: Boolean(candidate.openNomination),
    pendingInvite: Boolean(candidate.pendingInvite),
    storedInvite: candidate.storedInvite,
    hasName: candidate.hasName,
  });
}
