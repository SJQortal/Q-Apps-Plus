/**
 * What an account made in Q-Mintership+, under any of its names: the + app's
 * records (service JSON) whose publisher is one of the names it owns, read
 * by prefix, and the encrypted Minter Admin poll records (DOCUMENT_PRIVATE),
 * which are only counted. Key `xmade:<address>`.
 *
 * One `searchsimple` per prefix, with the service, the identifier prefix and
 * the names repeated (40 names a search; an account with more names gets one
 * search per 40), 100 rows a page, at most 3 pages each, newest first. Core's
 * `prefix=true` also widens the name match, so every row is kept only when
 * its name is exactly one of the account's names.
 *
 * Nothing here reads a record's body: what each record is about comes from
 * its identifier, parsed with the app's own parsers (a nomination's or a
 * support's nominee, a community vote's nominee and Yes or No, the key a
 * comment or a Considering mark is about). Read-only.
 */
import {
  COMMENT_PREFIX,
  commentKeyKind,
  parseCommentIdentifier,
  type CommentKeyKind,
} from '../commentRecords';
import { getPaged, query } from '../core';
import { mapLimit, rowTime } from '../qdn';
import { fetchQuery } from '../query';
import {
  CONSIDERING_PREFIX,
  NOMINATION_PREFIX,
  RECORD_SERVICE,
  SUPPORT_PREFIX,
  consideringKeyOf,
  nomineeFromIdentifier,
} from '../records';
import type { QdnRow } from '../types';
import { VOTE_PREFIX, parseVoteIdentifier, type CommunityVoteValue } from '../voteRecords';
import { getNamesOf } from './account';

/** Names repeated in one search (88 names made a 1.4 KB query on mainnet; a few hundred would not fit). */
export const NAME_CHUNK = 40;
/** Pages of 100 read per prefix and chunk of names. */
export const MADE_PAGES = 3;
export const MADE_PAGE_SIZE = 100;

/** The encrypted Minter Admin poll records (polls, votes, comments, shares): counted, never opened. */
export const ADMIN_RECORDS_SERVICE = 'DOCUMENT_PRIVATE';
export const ADMIN_RECORDS_PREFIX = 'qmp-admin';

export type MadeKind = 'nomination' | 'support' | 'vote' | 'comment' | 'considering';

/** Each kind's identifier prefix, in the order the screen lists them. */
export const MADE_PREFIXES: Readonly<Record<MadeKind, string>> = {
  nomination: NOMINATION_PREFIX,
  support: SUPPORT_PREFIX,
  vote: VOTE_PREFIX,
  comment: COMMENT_PREFIX,
  considering: CONSIDERING_PREFIX,
};

export const MADE_KINDS = Object.keys(MADE_PREFIXES) as MadeKind[];

interface Made {
  /** The name it was published under. */
  name: string;
  identifier: string;
  /** When it was last published (ms). */
  at: number;
}

export interface NominationMade extends Made {
  nominee: string;
}
export type SupportMade = NominationMade;
export interface VoteMade extends Made {
  nominee: string;
  vote: CommunityVoteValue;
}
export interface KeyedMade extends Made {
  /** A decision's key (the first 40 characters of its signature) or a nominee's address. */
  key: string;
  about: CommentKeyKind;
}

export interface MadeBy {
  /** Every name searched (all the account owns, up to the first 500). */
  names: string[];
  /** The account owns more than 500 names: only the first 500 were searched. */
  namesTruncated: boolean;
  /** The names with at least one record (the encrypted ones included). */
  namesWithRecords: string[];
  nominations: NominationMade[];
  supports: SupportMade[];
  votes: VoteMade[];
  comments: KeyedMade[];
  considering: KeyedMade[];
  /** Encrypted Minter Admin poll records under these names: how many, nothing else. */
  adminRecords: number;
  /** Kinds whose search stopped at its ceiling (300 rows per 40 names). */
  truncated: Array<MadeKind | 'admin'>;
  /** Rows listed under a prefix whose identifier isn't one this app writes. */
  unreadable: number;
}

/** `names` in chunks of `size`, in order. */
export function chunked<T>(items: readonly T[], size = NAME_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** The search path for one page: a service, an identifier prefix and up to 40 names. */
export function madeSearchPath(
  service: string,
  prefix: string,
  names: readonly string[],
  offset: number,
  limit = MADE_PAGE_SIZE
): string {
  return `/arbitrary/resources/searchsimple?${query({
    service,
    identifier: prefix,
    prefix: true,
    name: names,
    limit,
    offset,
    reverse: true,
  })}`;
}

/** Rows published under one of `names` exactly (Core's prefix match widens names too), each once. */
export function exactRows(rows: readonly QdnRow[], names: ReadonlySet<string>): QdnRow[] {
  const seen = new Set<string>();
  const kept: QdnRow[] = [];
  for (const row of rows) {
    if (!row || typeof row.name !== 'string' || typeof row.identifier !== 'string') continue;
    if (!names.has(row.name)) continue;
    const ref = `${row.name}\n${row.identifier}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    kept.push(row);
  }
  return kept;
}

type Parsed =
  | { kind: 'nomination' | 'support'; item: NominationMade }
  | { kind: 'vote'; item: VoteMade }
  | { kind: 'comment' | 'considering'; item: KeyedMade };

/** One row of a kind's search, parsed from its identifier alone; null when it isn't this app's. */
export function parseMadeRow(kind: MadeKind, row: QdnRow): Parsed | null {
  const base = { name: row.name, identifier: row.identifier, at: rowTime(row) };
  if (!row.identifier.startsWith(MADE_PREFIXES[kind])) return null;
  switch (kind) {
    case 'nomination':
    case 'support': {
      const nominee = nomineeFromIdentifier(row.identifier);
      return nominee ? { kind, item: { ...base, nominee } } : null;
    }
    case 'vote': {
      const vote = parseVoteIdentifier(row.identifier);
      return vote ? { kind, item: { ...base, ...vote } } : null;
    }
    case 'comment': {
      const parsed = parseCommentIdentifier(row.identifier);
      const about = parsed ? commentKeyKind(parsed.key) : null;
      return parsed && about ? { kind, item: { ...base, key: parsed.key, about } } : null;
    }
    case 'considering': {
      const key = consideringKeyOf(row.identifier);
      const about = key ? commentKeyKind(key) : null;
      return key && about ? { kind, item: { ...base, key, about } } : null;
    }
  }
}

interface KindRows {
  kind: MadeKind | 'admin';
  rows: QdnRow[];
  truncated: boolean;
}

/** Sort the rows of each search into what was made, newest first. Pure (tests feed it rows). */
export function madeFromRows(
  names: readonly string[],
  results: readonly KindRows[],
  namesTruncated = false
): MadeBy {
  const nameSet = new Set(names);
  const made: MadeBy = {
    names: [...names],
    namesTruncated,
    namesWithRecords: [],
    nominations: [],
    supports: [],
    votes: [],
    comments: [],
    considering: [],
    adminRecords: 0,
    truncated: [],
    unreadable: 0,
  };
  const withRecords = new Set<string>();
  for (const result of results) {
    if (result.truncated && !made.truncated.includes(result.kind)) made.truncated.push(result.kind);
    for (const row of exactRows(result.rows, nameSet)) {
      if (result.kind === 'admin') {
        if (!row.identifier.startsWith(ADMIN_RECORDS_PREFIX)) continue;
        made.adminRecords += 1;
        withRecords.add(row.name);
        continue;
      }
      const parsed = parseMadeRow(result.kind, row);
      if (!parsed) {
        if (row.identifier.startsWith(MADE_PREFIXES[result.kind])) made.unreadable += 1;
        continue;
      }
      withRecords.add(row.name);
      switch (parsed.kind) {
        case 'nomination':
          made.nominations.push(parsed.item);
          break;
        case 'support':
          made.supports.push(parsed.item);
          break;
        case 'vote':
          made.votes.push(parsed.item);
          break;
        case 'comment':
          made.comments.push(parsed.item);
          break;
        case 'considering':
          made.considering.push(parsed.item);
          break;
      }
    }
  }
  const newest = (a: Made, b: Made) => b.at - a.at;
  made.nominations.sort(newest);
  made.supports.sort(newest);
  made.votes.sort(newest);
  made.comments.sort(newest);
  made.considering.sort(newest);
  made.namesWithRecords = names.filter((name) => withRecords.has(name));
  return made;
}

/** One kind's rows for every chunk of names, at most 3 pages a chunk. */
async function searchKind(kind: MadeKind | 'admin', names: readonly string[]): Promise<KindRows> {
  const service = kind === 'admin' ? ADMIN_RECORDS_SERVICE : RECORD_SERVICE;
  const prefix = kind === 'admin' ? ADMIN_RECORDS_PREFIX : MADE_PREFIXES[kind];
  const rows: QdnRow[] = [];
  let truncated = false;
  for (const chunk of chunked(names)) {
    const result = await getPaged<QdnRow>(
      (offset, limit) => madeSearchPath(service, prefix, chunk, offset, limit),
      { maxPages: MADE_PAGES, pageSize: MADE_PAGE_SIZE }
    );
    rows.push(...result.rows);
    truncated ||= result.truncated;
  }
  return { kind, rows, truncated };
}

/** Everything the account made in Q-Mintership+, under any of its names. Key `xmade:<address>`. */
export function loadMadeBy(address: string, options: { force?: boolean } = {}): Promise<MadeBy> {
  return fetchQuery(
    `xmade:${address}`,
    async () => {
      const owned = await getNamesOf(address);
      if (!owned.names.length) return madeFromRows([], [], owned.truncated);
      const kinds: Array<MadeKind | 'admin'> = [...MADE_KINDS, 'admin'];
      const results = await mapLimit(kinds, 3, (kind) => searchKind(kind, owned.names));
      return madeFromRows(owned.names, results, owned.truncated);
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}
