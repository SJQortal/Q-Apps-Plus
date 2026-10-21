/**
 * Connections' "In Q-Mintership": the social links Q-Mintership+ records
 * show between one account and others, one row per other account. Records
 * only (nominations, supports, community votes), never a Minter Admin's
 * duties (approvals, invites, answers). Pure: the reads are passed in.
 *
 * An account counts once whatever names it used: a nominator who also
 * supported under another name is listed once, as the nominator, "under 2
 * names". The account itself is never listed.
 */
import type { MadeBy } from '../../../../data/explorer/madeBy';
import type { Nomination } from '../../../../data/nominations';
import type { CommunityVoteValue } from '../../../../data/voteRecords';
import type { VoteRow } from '../../../../rules/communityVotes';
import type { NominationRound } from '../../../../rules/rounds';

export type LinkKind =
  'nominatedThem' | 'supportedThem' | 'votedOnThem' | 'nominated' | 'supported' | 'votedOn';

/** The order and headings of the groups. */
export const LINK_GROUPS: ReadonlyArray<{ kind: LinkKind; heading: string }> = [
  { kind: 'nominatedThem', heading: 'Nominated this account' },
  { kind: 'supportedThem', heading: 'Supported this account’s nomination' },
  { kind: 'votedOnThem', heading: 'Voted on this account’s nomination' },
  { kind: 'nominated', heading: 'Nominated by this account' },
  { kind: 'supported', heading: 'Nominations this account supported' },
  { kind: 'votedOn', heading: 'Nominations this account voted on' },
];

export interface MintershipLink {
  kind: LinkKind;
  /** The other account. */
  other: string;
  /** The newest record behind it (ms). */
  at: number;
  /** The round of this account's nomination it belongs to, when known. */
  round: number | null;
  /** A community vote: the newest one. */
  vote: CommunityVoteValue | null;
  /** How many votes the account cast on it (its newest counts). */
  votes: number;
  /** How many names the records were published under. */
  names: number;
}

export interface LinksInput {
  address: string;
  /** Their nominations (nominations:for:<address>): who nominated and supported them. */
  nominations: readonly Nomination[];
  /** Their rounds, to say which round a nomination belongs to. */
  rounds: readonly NominationRound[];
  /** What they published (xmade:<address>). */
  made: MadeBy | null;
  /** Community votes on their nomination, each voter resolved to its account. */
  votesOnThem: readonly VoteRow[];
}

function roundOf(nomination: Nomination, rounds: readonly NominationRound[]): number | null {
  const signature = nomination.decision?.signature ?? nomination.latestInvite?.signature;
  return signature ? (rounds.find((r) => r.signature === signature)?.number ?? null) : null;
}

interface Acc {
  at: number;
  names: Set<string>;
  round: number | null;
  vote: CommunityVoteValue | null;
  votes: number;
}

function add(map: Map<string, Acc>, other: string, name: string, at: number, round: number | null) {
  const acc = map.get(other) ?? { at: 0, names: new Set(), round: null, vote: null, votes: 0 };
  acc.names.add(name);
  if (at >= acc.at) {
    acc.at = at;
    acc.round = round ?? acc.round;
  }
  map.set(other, acc);
}

/** Each account's newest vote, and how many it cast. */
function addVote(
  map: Map<string, Acc>,
  other: string,
  name: string,
  at: number,
  vote: CommunityVoteValue
) {
  const acc = map.get(other) ?? { at: 0, names: new Set(), round: null, vote: null, votes: 0 };
  acc.names.add(name);
  acc.votes += 1;
  if (at >= acc.at) {
    acc.at = at;
    acc.vote = vote;
  }
  map.set(other, acc);
}

function rows(kind: LinkKind, map: Map<string, Acc>, skip: ReadonlySet<string>): MintershipLink[] {
  return [...map]
    .filter(([other]) => !skip.has(other))
    .map(([other, acc]) => ({
      kind,
      other,
      at: acc.at,
      round: acc.round,
      vote: acc.vote,
      votes: acc.votes,
      names: acc.names.size,
    }))
    .sort((a, b) => b.at - a.at);
}

export function mintershipLinks(input: LinksInput): MintershipLink[] {
  const self = new Set([input.address]);

  // Who nominated or supported them (validated records of their nominations).
  const nominatedThem = new Map<string, Acc>();
  const supportedThem = new Map<string, Acc>();
  for (const n of input.nominations) {
    const round = roundOf(n, input.rounds);
    if (n.nomination)
      add(
        nominatedThem,
        n.nomination.publisher.address,
        n.nomination.publisher.name,
        n.nomination.publishedAt,
        round
      );
    for (const s of n.supporters)
      add(supportedThem, s.publisher.address, s.publisher.name, s.publishedAt, round);
  }
  // A nominator's other names' supports count as the nomination, under more names.
  for (const [other, acc] of supportedThem) {
    const nominator = nominatedThem.get(other);
    if (!nominator) continue;
    acc.names.forEach((name) => nominator.names.add(name));
  }

  const votedOnThem = new Map<string, Acc>();
  for (const v of input.votesOnThem)
    if (v.nominee === input.address) addVote(votedOnThem, v.voter, v.name, v.castAt, v.vote);

  // What they published, under any of their names.
  const nominated = new Map<string, Acc>();
  const supported = new Map<string, Acc>();
  const votedOn = new Map<string, Acc>();
  for (const m of input.made?.nominations ?? []) add(nominated, m.nominee, m.name, m.at, null);
  for (const m of input.made?.supports ?? []) add(supported, m.nominee, m.name, m.at, null);
  for (const m of input.made?.votes ?? []) addVote(votedOn, m.nominee, m.name, m.at, m.vote);
  // Supporting someone they also nominated (under another name) is part of the nomination.
  for (const [other, acc] of supported) {
    const nomination = nominated.get(other);
    if (!nomination) continue;
    acc.names.forEach((name) => nomination.names.add(name));
  }

  return [
    ...rows('nominatedThem', nominatedThem, self),
    ...rows('supportedThem', supportedThem, new Set([...self, ...nominatedThem.keys()])),
    ...rows('votedOnThem', votedOnThem, self),
    ...rows('nominated', nominated, self),
    ...rows('supported', supported, new Set([...self, ...nominated.keys()])),
    ...rows('votedOn', votedOn, self),
  ];
}
