/** The words for a comment from the nominee's earlier nomination (EarlierTag). Pure. */
import type { EarlierRound } from '../../rules/nomination';
import { decisionPath, PATHS } from '../../routes/paths';
import { toDateInput } from '../../pages/activity/range';
import { formatDate } from '../../utils/format';

/** "lapsed on 17 Nov 2026", "was rejected on 19 Nov 2026". */
export function earlierOutcomeText(round: EarlierRound): string {
  const on = formatDate(round.endedAt);
  switch (round.outcome) {
    case 'lapsed':
      return `lapsed on ${on}`;
    case 'expired':
      return `expired on ${on}`;
    case 'rejected':
      return `was rejected on ${on}`;
    case 'approved':
      return `was approved on ${on}`;
  }
}

/** "Written on 9 Nov 2026, on the previous nomination of 9 Nov 2026, which lapsed on 17 Nov 2026." */
export function earlierTagText(round: EarlierRound, postedAt: number): string {
  return `Written on ${formatDate(postedAt)}, on the previous nomination of ${formatDate(round.startedAt)}, which ${earlierOutcomeText(round)}.`;
}

/** Where to see how it ended: its decision, or the lapsed nominations from its start. */
export function earlierOutcomePath(round: EarlierRound): string {
  return round.invite
    ? decisionPath(round.invite.signature)
    : `${PATHS.history}?type=lapsed&from=${toDateInput(round.startedAt)}`;
}
