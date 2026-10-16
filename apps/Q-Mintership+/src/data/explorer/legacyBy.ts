/**
 * What an account posted on the original Q-Mintership's boards, under any of
 * its names (key `xlegacyby:<address>`), and its votes in the original app's
 * chain polls, read only when asked (key `xpollvotes:<address>`).
 *
 * Posted, by name (40 names a search, 100 rows a page, at most 3 pages,
 * every row kept only when its name is exactly one of the account's):
 * - nomination cards (BLOG_POST `Minter-board-card-`) and Minter Admin
 *   proposals (`QM-AR-card-`): the rows, for the screen to read each card's
 *   body as it shows it (data/legacy.ts, cached for the session);
 * - comments on those cards: `comment-Minter-board-card-` and
 *   `comment-QM-AR-card-` only (other apps use a bare `comment-` too), counted;
 * - the encrypted admin board (MAIL_PRIVATE `card-MAC-`, `comment-card-MAC-`):
 *   counted, never opened, no identifiers kept.
 *
 * Poll votes: one heavy address search for the newest 100 VOTE_ON_POLL
 * transactions, each mapped to the option it names through the poll's own
 * option list (Core lists options in the order they were made, so "No" can
 * be first). Only polls of the original app's public boards are listed; a
 * vote on an encrypted admin board card's poll or on another app's poll is
 * only counted. Read-only.
 */
import { getPollInfo, type PollInfo } from '../../qortal/polls';
import { getJson, getPaged, query } from '../core';
import {
  ADMIN_BOARD_SERVICE,
  ADMIN_CARD_PREFIX,
  AR_CARD_PREFIX,
  LEGACY_SERVICE,
  MINTER_CARD_PREFIX,
  legacyBoardOf,
  toCardRows,
  type LegacyBoard,
  type LegacyCardRow,
} from '../legacy';
import { mapLimit } from '../qdn';
import { fetchQuery } from '../query';
import type { QdnRow, TxRow } from '../types';
import { heavyQuery } from './heavy';
import { getNamesOf } from './account';
import { MADE_PAGES, MADE_PAGE_SIZE, chunked, exactRows, madeSearchPath } from './madeBy';

export const MINTER_COMMENT_PREFIX = `comment-${MINTER_CARD_PREFIX}`;
export const AR_COMMENT_PREFIX = `comment-${AR_CARD_PREFIX}`;
export const ADMIN_COMMENT_PREFIX = `comment-${ADMIN_CARD_PREFIX}`;

type LegacySearch =
  'minterCards' | 'arCards' | 'minterComments' | 'arComments' | 'adminCards' | 'adminComments';

/** Every search, with its service and identifier prefix. */
export const LEGACY_SEARCHES: Readonly<Record<LegacySearch, { service: string; prefix: string }>> =
  {
    minterCards: { service: LEGACY_SERVICE, prefix: MINTER_CARD_PREFIX },
    arCards: { service: LEGACY_SERVICE, prefix: AR_CARD_PREFIX },
    minterComments: { service: LEGACY_SERVICE, prefix: MINTER_COMMENT_PREFIX },
    arComments: { service: LEGACY_SERVICE, prefix: AR_COMMENT_PREFIX },
    adminCards: { service: ADMIN_BOARD_SERVICE, prefix: ADMIN_CARD_PREFIX },
    adminComments: { service: ADMIN_BOARD_SERVICE, prefix: ADMIN_COMMENT_PREFIX },
  };

export interface CommentCount {
  /** Comments posted. */
  comments: number;
  /** On how many cards. */
  cards: number;
}

export interface LegacyBy {
  names: string[];
  namesTruncated: boolean;
  namesWithRecords: string[];
  /** Nomination cards and admin proposals posted under these names, newest first. */
  cards: LegacyCardRow[];
  minterComments: CommentCount;
  arComments: CommentCount;
  /** The encrypted admin board: how many cards and comments, nothing else. */
  adminCards: number;
  adminComments: number;
  /** Searches that stopped at their ceiling. */
  truncated: LegacySearch[];
}

/** The card a comment identifier (`comment-<cardId>-<id>`) is on; null when it isn't one. */
export function commentedCard(identifier: string): string | null {
  if (!identifier.startsWith('comment-')) return null;
  const rest = identifier.slice('comment-'.length);
  const cut = rest.lastIndexOf('-');
  const card = cut > 0 ? rest.slice(0, cut) : '';
  return legacyBoardOf(card) ? card : null;
}

function countComments(rows: readonly QdnRow[]): CommentCount {
  const cards = new Set<string>();
  let comments = 0;
  for (const row of rows) {
    const card = commentedCard(row.identifier);
    if (!card) continue;
    comments += 1;
    cards.add(card);
  }
  return { comments, cards: cards.size };
}

/** Sort each search's rows (already limited to the names). Pure (tests feed it rows). */
export function legacyFromRows(
  names: readonly string[],
  results: Readonly<Partial<Record<LegacySearch, { rows: QdnRow[]; truncated: boolean }>>>,
  namesTruncated = false
): LegacyBy {
  const nameSet = new Set(names);
  const rowsOf = (search: LegacySearch) => {
    const prefix = LEGACY_SEARCHES[search].prefix;
    return exactRows(results[search]?.rows ?? [], nameSet).filter((row) =>
      row.identifier.startsWith(prefix)
    );
  };
  const minterCards = rowsOf('minterCards');
  const arCards = rowsOf('arCards');
  const minterComments = rowsOf('minterComments');
  const arComments = rowsOf('arComments');
  const adminCards = rowsOf('adminCards').filter((row) => legacyBoardOf(row.identifier));
  const adminComments = rowsOf('adminComments').filter((row) => commentedCard(row.identifier));
  const withRecords = new Set(
    [minterCards, arCards, minterComments, arComments, adminCards, adminComments]
      .flat()
      .map((row) => row.name)
  );
  return {
    names: [...names],
    namesTruncated,
    namesWithRecords: names.filter((name) => withRecords.has(name)),
    cards: toCardRows([...minterCards, ...arCards]),
    minterComments: countComments(minterComments),
    arComments: countComments(arComments),
    adminCards: adminCards.length,
    adminComments: adminComments.length,
    truncated: (Object.keys(LEGACY_SEARCHES) as LegacySearch[]).filter(
      (search) => results[search]?.truncated
    ),
  };
}

/** What the account posted on the original app's boards. Key `xlegacyby:<address>`. */
export function loadLegacyBy(
  address: string,
  options: { force?: boolean } = {}
): Promise<LegacyBy> {
  return fetchQuery(
    `xlegacyby:${address}`,
    async () => {
      const owned = await getNamesOf(address);
      if (!owned.names.length) return legacyFromRows([], {}, owned.truncated);
      const searches = Object.keys(LEGACY_SEARCHES) as LegacySearch[];
      const found = await mapLimit(searches, 3, async (search) => {
        const { service, prefix } = LEGACY_SEARCHES[search];
        const rows: QdnRow[] = [];
        let truncated = false;
        for (const chunk of chunked(owned.names)) {
          const result = await getPaged<QdnRow>(
            (offset, limit) => madeSearchPath(service, prefix, chunk, offset, limit),
            { maxPages: MADE_PAGES, pageSize: MADE_PAGE_SIZE }
          );
          rows.push(...result.rows);
          truncated ||= result.truncated;
        }
        return [search, { rows, truncated }] as const;
      });
      return legacyFromRows(owned.names, Object.fromEntries(found), owned.truncated);
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

// ---- poll votes -------------------------------------------------------------------

/** Poll votes read per account: the newest 100. */
export const POLL_VOTES_LIMIT = 100;

export type PollAnswer = 'yes' | 'no' | 'other';

export interface PollVote {
  signature: string;
  pollName: string;
  /** The card the poll belongs to (`<card>-poll`). */
  card: string;
  board: Exclude<LegacyBoard, 'admin'>;
  /** The option as the poll names it; null when the poll or the option couldn't be read. */
  option: string | null;
  answer: PollAnswer | null;
  /** The poll's own description (it usually names the nominee); empty when unread. */
  description: string;
  height: number | null;
  timestamp: number;
}

export interface PollVotes {
  /** Votes on the public boards' polls, newest first. */
  votes: PollVote[];
  /** Votes on encrypted admin board cards' polls: counted only. */
  adminBoard: number;
  /** Votes on polls that aren't the original app's: counted only. */
  other: number;
  /** All of the newest 100 were read: there may be older ones. */
  truncated: boolean;
}

/** `Minter-board-card-x-poll` → `Minter-board-card-x`; null for any other poll name. */
export function cardOfPoll(pollName: unknown): string | null {
  if (typeof pollName !== 'string' || !pollName.endsWith('-poll')) return null;
  const card = pollName.slice(0, -'-poll'.length);
  return legacyBoardOf(card) ? card : null;
}

/** The option a vote names, by the poll's own list (never assumed by position). */
export function voteOption(
  info: Pick<PollInfo, 'options'> | null,
  index: unknown
): { option: string | null; answer: PollAnswer | null } {
  const i = Number(index);
  if (!info || !Number.isInteger(i) || i < 0 || i >= info.options.length)
    return { option: null, answer: null };
  const option = info.options[i];
  const lower = option.trim().toLowerCase();
  return { option, answer: lower === 'yes' ? 'yes' : lower === 'no' ? 'no' : 'other' };
}

/** A poll's owner, description and options (key `xpoll:<name>`), kept for the session. */
export function getPoll(pollName: string): Promise<PollInfo | null> {
  return fetchQuery(`xpoll:${pollName}`, () => getPollInfo(pollName), {
    ttlMs: Number.POSITIVE_INFINITY,
  });
}

/** The VOTE_ON_POLL rows in words. Pure but for the polls it is handed. */
export function pollVotesFrom(
  rows: readonly TxRow[],
  polls: ReadonlyMap<string, PollInfo | null>,
  limit = POLL_VOTES_LIMIT
): PollVotes {
  const result: PollVotes = { votes: [], adminBoard: 0, other: 0, truncated: rows.length >= limit };
  const seen = new Set<string>();
  for (const tx of rows) {
    if (tx.type !== 'VOTE_ON_POLL' || seen.has(tx.signature)) continue;
    seen.add(tx.signature);
    const card = cardOfPoll(tx.pollName);
    const board = card ? legacyBoardOf(card) : null;
    if (!card || !board) {
      result.other += 1;
      continue;
    }
    if (board === 'admin') {
      result.adminBoard += 1;
      continue;
    }
    const info = polls.get(tx.pollName as string) ?? null;
    result.votes.push({
      signature: tx.signature,
      pollName: tx.pollName as string,
      card,
      board,
      ...voteOption(info, tx.optionIndex),
      description: info?.description ?? '',
      height: typeof tx.blockHeight === 'number' ? tx.blockHeight : null,
      timestamp: tx.timestamp,
    });
  }
  result.votes.sort((a, b) => b.timestamp - a.timestamp);
  return result;
}

/**
 * The account's newest 100 votes in chain polls, in words (key
 * `xpollvotes:<address>`). Read only when asked: the address search is
 * heavy for a busy account, so it waits for the Explorer's heavy-read slot.
 */
export function loadPollVotes(
  address: string,
  options: { force?: boolean } = {}
): Promise<PollVotes> {
  return heavyQuery(
    address,
    `xpollvotes:${address}`,
    async () => {
      const body = await getJson<unknown>(
        `/transactions/search?${query({
          address,
          txType: 'VOTE_ON_POLL',
          confirmationStatus: 'CONFIRMED',
          limit: POLL_VOTES_LIMIT,
          reverse: true,
        })}`
      );
      const rows = (Array.isArray(body) ? body : []) as TxRow[];
      const names = [
        ...new Set(
          rows
            .filter((tx) => {
              const card = cardOfPoll(tx.pollName);
              return card !== null && legacyBoardOf(card) !== 'admin';
            })
            .map((tx) => tx.pollName as string)
        ),
      ];
      const polls = new Map<string, PollInfo | null>();
      await mapLimit(names, 6, async (name) => {
        polls.set(name, await getPoll(name).catch(() => null));
      });
      return pollVotesFrom(rows, polls);
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
