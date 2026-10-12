/** Plain sentences for a person page: where someone stands, and what they proposed. */
import type { TimelineEvent } from '../../data/timeline';
import { CoreHttpError } from '../../qortal/client';
import type { MyStatus } from '../../rules/status';
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
  switch (person.kind) {
    case 'admin':
      return memberSince ? `Minter Admin, in MINTER${since}.` : 'Minter Admin and MINTER member.';
    case 'memberNominator':
      return `In MINTER${since}. At level ${person.level}, ${they} can nominate new minters.`;
    case 'member':
      return `In MINTER${since}, minting as an online account. Level 5 lets ${them} nominate.`;
    case 'formerBanned': {
      const ban = person.activeBan;
      const when = ban ? ` on ${formatDate(ban.banned)}` : '';
      const until = ban?.expiry ? `, until ${formatDate(ban.expiry)}` : ', permanently';
      return `Banned from MINTER${when}${until}. Minter Admins must lift the ban before ${they} can rejoin.`;
    }
    case 'approvedInvite':
      return `Approved for MINTER: ${they} only need to press Join.`;
    case 'nominated':
      return person.hasJoinRequest
        ? `Nominated for MINTER, and ${they}'ve accepted: approval adds ${them} at once.`
        : 'Nominated for MINTER.';
    case 'formerKicked':
      return person.removal?.kind === 'ban'
        ? `Was banned from MINTER${removedOn}; the ban has ended, so ${they} can be nominated again.`
        : `Removed from MINTER${removedOn}. ${They} keep ${their} level and can be nominated again.`;
    case 'formerLeft':
      return `Left MINTER${removedOn}. ${They} can be nominated again.`;
    default:
      return person.hasJoinRequest
        ? `Not in MINTER yet. ${They}'ve asked to join, so an approved nomination adds ${them} at once.`
        : 'Not in MINTER yet.';
  }
}

/** "Proposed 4 changes for others: 3 approved, 1 collecting signatures." */
export function proposalsSummary(proposals: TimelineEvent[]): string {
  const count = (outcome: TimelineEvent['outcome']) =>
    proposals.filter((p) => p.outcome === outcome).length;
  const parts = [
    count('done') ? `${count('done')} approved` : '',
    count('pending') ? `${count('pending')} collecting signatures` : '',
    count('expired') ? `${count('expired')} expired` : '',
    count('rejected') ? `${count('rejected')} rejected` : '',
  ].filter(Boolean);
  return `Proposed ${plural(proposals.length, 'change')} for others: ${parts.join(', ')}.`;
}

/** Core's answer for an address that fails its checksum (`{"error":102,"message":"invalid address"}`). */
export function isInvalidAddress(error: unknown): boolean {
  return (
    error instanceof CoreHttpError &&
    error.status >= 400 &&
    error.status < 500 &&
    /"error"\s*:\s*102|invalid address/i.test(error.body)
  );
}
