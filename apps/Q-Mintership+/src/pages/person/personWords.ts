/** Plain sentences for a Minter Profile: where someone stands, and what they proposed. */
import type { TimelineEvent } from '../../data/timeline';
import { banEnd, type FormerMember, type MyStatus } from '../../rules/status';
import { formatDate, plural } from '../../utils/format';

/** The status in one sentence, with real dates. `self` speaks to the viewer. */
export function statusSentence(
  person: MyStatus,
  memberSince: number | null,
  self: boolean
): string {
  const they = self ? 'you' : 'they';
  const They = self ? 'You' : 'They';
  const them = self ? 'you' : 'them';
  const their = self ? 'your' : 'their';
  const since = memberSince ? ` since ${formatDate(memberSince)}` : '';
  const removedOn = person.removal ? ` on ${formatDate(person.removal.at)}` : '';
  // A declined join request, unless a newer one is open or they left MINTER since.
  const declinedAt =
    person.declinedAt !== null &&
    !person.hasJoinRequest &&
    (!person.removal || person.declinedAt > person.removal.at)
      ? person.declinedAt
      : null;
  const declined = declinedAt
    ? ` Minter Admins declined ${their} join request on ${formatDate(declinedAt)}; ${they} can send a new one.`
    : '';
  switch (person.kind) {
    case 'admin':
      return memberSince ? `Minter Admin, in MINTER${since}.` : 'Minter Admin and MINTER member.';
    case 'memberNominator':
      return `In MINTER${since}. At level ${person.level}, ${they} can nominate new minters.`;
    case 'member':
      return `In MINTER${since}, minting as an online account. Level 5 lets ${them} nominate.`;
    case 'formerBanned': {
      const ban = person.activeBan;
      // When it took effect (its approval); Core's `banned` is when it was proposed.
      const at = (person.removal?.kind === 'ban' ? person.removal.at : null) ?? ban?.banned;
      const when = at ? ` on ${formatDate(at)}` : '';
      const until = ban?.expiry ? `, until ${formatDate(ban.expiry)}` : ', permanently';
      const join = person.wasMember ? 'rejoin' : 'join';
      return `Banned from MINTER${when}${until}. Minter Admins must lift the ban before ${they} can ${join}.`;
    }
    case 'approvedInvite':
      return `Approved for MINTER: ${they} only need to press Join now.`;
    case 'nominated':
      return person.hasJoinRequest
        ? `Nominated for MINTER, and ${they}'re ready: approval adds ${them} at once.`
        : 'Nominated for MINTER.';
    case 'formerKicked': {
      // Someone who was never a member: a ban, or a kick of their join request.
      const again = person.wasMember ? ' again' : '';
      const end = person.removal ? banEnd(person.removal) : null;
      if (end) {
        const ended =
          end.how === 'lifted' && end.at !== null
            ? `Minter Admins lifted the ban on ${formatDate(end.at)}`
            : end.at !== null
              ? `the ban ended on ${formatDate(end.at)}`
              : 'the ban has ended';
        return `Was banned from MINTER${removedOn}; ${ended}, so ${they} can be nominated${again}.`;
      }
      return person.wasMember
        ? `Removed from MINTER${removedOn}. ${They} keep ${their} level and can be nominated again.${declined}`
        : `Removed from MINTER's join list${removedOn}. ${They} can be nominated.${declined}`;
    }
    case 'formerLeft':
      return `Left MINTER${removedOn}. ${They} can be nominated again.${declined}`;
    default:
      return person.hasJoinRequest
        ? `Not in MINTER yet. ${They}'ve asked to join, so an approved nomination adds ${them} at once.`
        : `Not in MINTER yet.${declined}`;
  }
}

/**
 * A former member in one line: "Former member: removed from MINTER on
 * 26 Aug 2026" (a kick), "… banned, ban ended on …", "… ban lifted on …",
 * or "… left MINTER on …".
 */
export function formerMemberLine(former: FormerMember): string {
  if (former.kind === 'left') return `Former member: left MINTER on ${formatDate(former.at)}`;
  if (former.kind === 'removed')
    return `Former member: removed from MINTER on ${formatDate(former.at)}`;
  const end = former.ban;
  if (end?.how === 'lifted' && end.at !== null)
    return `Former member: ban lifted on ${formatDate(end.at)}`;
  if (end?.at) return `Former member: banned, ban ended on ${formatDate(end.at)}`;
  return `Former member: banned on ${formatDate(former.at)}, ban ended`;
}

/** "Proposed 4 changes for others: 3 approved, 1 collecting signatures." */
export function proposalsSummary(proposals: TimelineEvent[]): string {
  const count = (outcome: TimelineEvent['outcome']) =>
    proposals.filter((p) => p.outcome === outcome).length;
  const parts = [
    count('done') ? `${count('done')} approved` : '',
    count('pending') ? `${count('pending')} collecting approvals` : '',
    count('expired') ? `${count('expired')} expired` : '',
    count('rejected') ? `${count('rejected')} rejected` : '',
  ].filter(Boolean);
  return `Proposed ${plural(proposals.length, 'change')} for others: ${parts.join(', ')}.`;
}
