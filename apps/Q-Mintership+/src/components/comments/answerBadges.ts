/**
 * What each Minter Admin chose on the thing a comment thread is about, for
 * the small badge next to their name in its comments: approved, rejected or
 * considering on a decision (a Considering newer than their answer wins, as
 * on the card; an answer on its way wins over the one it replaces), or their
 * vote on a Minter Admin poll; and on a nomination, the community's Yes and
 * No from everyone else. Keyed by address: a comment's name is looked up to
 * the account that owns it.
 */
import type { Tally } from '../../rules/tally';

export type AnswerBadgeKind = 'approved' | 'rejected' | 'considering' | 'yes' | 'no' | 'neutral';

export interface AnswerBadge {
  kind: AnswerBadgeKind;
  /** Its own words, when not the kind's (a poll's answer: "Voted Approve"). */
  label?: string;
  /** On its way into a block. */
  confirming?: boolean;
}

export type AnswerBadges = ReadonlyMap<string, AnswerBadge>;

export const ANSWER_BADGE_LABEL: Record<AnswerBadgeKind, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  considering: 'Considering',
  yes: 'Voted Yes',
  no: 'Voted No',
  neutral: 'Voted Neutral',
};

interface Answerer {
  address: string;
  confirming?: boolean;
}

/** A decision's badges from its columns (AnswerColumns' people). */
export function answerBadges(
  approved: readonly Answerer[],
  rejected: readonly Answerer[],
  considering: readonly Answerer[]
): AnswerBadges {
  const badges = new Map<string, AnswerBadge>();
  const put = (people: readonly Answerer[], kind: AnswerBadgeKind, confirming: boolean) => {
    for (const p of people)
      if (Boolean(p.confirming) === confirming)
        badges.set(p.address, confirming ? { kind, confirming } : { kind });
  };
  put(approved, 'approved', false);
  put(rejected, 'rejected', false);
  put(approved, 'approved', true);
  put(rejected, 'rejected', true);
  for (const p of considering) badges.set(p.address, { kind: 'considering' });
  return badges;
}

/** A decision's badges straight from its tally and who is considering it. */
export function tallyBadges(
  tally: Pick<Tally, 'approvals' | 'rejections' | 'inFlight'> | null,
  considering: readonly Answerer[]
): AnswerBadges {
  const known = (rows: Tally['approvals'], confirming: boolean): Answerer[] =>
    rows.flatMap((x) => (x.address ? [{ address: x.address, confirming }] : []));
  return answerBadges(
    tally
      ? [
          ...known(tally.approvals, false),
          ...known(
            tally.inFlight.filter((x) => x.approval),
            true
          ),
        ]
      : [],
    tally
      ? [
          ...known(tally.rejections, false),
          ...known(
            tally.inFlight.filter((x) => !x.approval),
            true
          ),
        ]
      : [],
    considering
  );
}

/** A nomination's community votes added as "Voted Yes" and "Voted No" (a Minter Admin's badge stays). */
export function withCommunityBadges(
  badges: AnswerBadges,
  community: { yes: readonly Answerer[]; no: readonly Answerer[] }
): AnswerBadges {
  if (!community.yes.length && !community.no.length) return badges;
  const all = new Map(badges);
  for (const p of community.yes) if (!all.has(p.address)) all.set(p.address, { kind: 'yes' });
  for (const p of community.no) if (!all.has(p.address)) all.set(p.address, { kind: 'no' });
  return all;
}
