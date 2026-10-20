/** Plain words for the original app's cards: what kind, about whom, and why one can't show. */
import { LegacyUnreadableError, type LegacyCard, type LegacyCardRow } from '../../../data/legacy';
import { QdnDeletedError } from '../../../data/qdn';
import { formatDate } from '../../../utils/format';

/** "Nomination", "Admin proposal: add", "Admin proposal: remove", "Admin Board". */
export function legacyKindLabel(card: Pick<LegacyCard, 'board' | 'promotion' | 'topic'>): string {
  if (card.board === 'minter') return 'Nomination';
  if (card.board === 'admin') return card.topic ? 'Admin Board topic' : 'Admin Board';
  if (card.promotion === true) return 'Admin proposal: add';
  if (card.promotion === false) return 'Admin proposal: remove';
  return 'Admin proposal';
}

/** "For Bob · by Nora · 3 Oct 2026": who a card is about, who posted it, and when. */
export function legacyMetaLine(card: LegacyCard | undefined, row: LegacyCardRow): string {
  const date = formatDate(row.createdAt);
  if (!card) return `By ${row.publisher} · ${date}`;
  if (card.board === 'admin' && card.topic) return `Topic · by ${row.publisher} · ${date}`;
  const who = card.subject.name ?? 'an unnamed account';
  if (card.selfPosted) return `Posted by ${who} for themselves · ${date}`;
  const about =
    card.board === 'minter'
      ? `For ${who}`
      : card.promotion === false
        ? `Remove ${who} as a Minter Admin`
        : card.promotion === true
          ? `Make ${who} a Minter Admin`
          : `About ${who}`;
  return `${about} · by ${row.publisher} · ${date}`;
}

/** Why an old card or comment can't be shown, in plain words. */
export function legacyProblem(error: unknown, what = 'card'): string {
  if (error instanceof QdnDeletedError) return `This ${what} was deleted by its publisher`;
  if (error instanceof LegacyUnreadableError || error instanceof SyntaxError)
    return `This ${what} can't be read`;
  return 'Not available on your node right now';
}
