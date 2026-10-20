/**
 * The original app's encrypted Admin Board, read for Minter Admins in
 * History (docs/apps/Q-Mintership+.md → Data contract → Legacy reads):
 *
 * - cards: MAIL_PRIVATE `card-MAC-<…>` with `{ minterName, header, content,
 *   links, creator, timestamp, poll, topicMode }`, published with Hub's
 *   group encryption (`encrypt: true`) to the Minter Admins of the day;
 * - comments: MAIL_PRIVATE `comment-<cardId>-<id>` with `{ content,
 *   creator, timestamp, replyTo? }`, encrypted the same way;
 * - each card's chain poll, as on the public boards.
 *
 * A body is `/arbitrary/MAIL_PRIVATE/{name}/{identifier}?encoding=base64`,
 * then Hub's `DECRYPT_DATA { encryptedData }` (no dialog), as the original
 * app read it. Hub decrypts only what was encrypted to the signed-in
 * account, so a card posted before an admin joined reads as locked. Bodies
 * are kept per viewer and version for the session, and read only where a
 * screen shows them. Nothing here writes.
 */
import { qortal } from '../qortal/client';
import { isHubNotDecryptable } from '../utils/hubErrors';
import { fromData64 } from './adminPollRecords';
import {
  ADMIN_BOARD_SERVICE,
  ADMIN_CARD_PREFIX,
  LegacyUnreadableError,
  legacyText,
  parseLegacyComment,
  toCardRows,
  type LegacyCard,
  type LegacyCardRow,
  type LegacyComment,
  type LegacyCommentRow,
  type LegacyIndex,
} from './legacy';
import { fetchQdnText, searchQdn } from './qdn';
import { fetchQuery } from './query';
import { isQortalLink } from './records';

/** A body as the viewer can read it: the parsed record, or locked (not encrypted to them). */
export type AdminBoardRead<T> = { status: 'ok'; value: T } | { status: 'locked' };

/** Pages of 100 the index reads at most: 217 cards on 2026-10-20. */
const INDEX_MAX_PAGES = 5;
const LINKS_MAX = 10;

/**
 * Every Admin Board card's search row (key `legacy:adminboard:index`), newest
 * first. Rows only: who posted each card and when, no bodies.
 */
export function loadAdminBoardIndex(options: { force?: boolean } = {}): Promise<LegacyIndex> {
  return fetchQuery(
    'legacy:adminboard:index',
    async () => {
      const { rows, truncated } = await searchQdn(
        { service: ADMIN_BOARD_SERVICE, identifier: ADMIN_CARD_PREFIX, maxPages: INDEX_MAX_PAGES },
        { force: options.force }
      );
      return { cards: toCardRows(rows), truncated };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

/** One body, decrypted with the viewer's key. Locked when it isn't encrypted to them. */
async function readEncrypted(name: string, identifier: string): Promise<AdminBoardRead<unknown>> {
  const encrypted = await fetchQdnText(ADMIN_BOARD_SERVICE, name, identifier, {
    encoding: 'base64',
  });
  let plain: unknown;
  try {
    plain = await qortal({ action: 'DECRYPT_DATA', encryptedData: encrypted.trim() });
  } catch (error) {
    if (isHubNotDecryptable(error)) return { status: 'locked' };
    throw error;
  }
  try {
    return { status: 'ok', value: fromData64(String(plain)) };
  } catch {
    throw new LegacyUnreadableError(identifier);
  }
}

function text(value: unknown, max = 200): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/** An Admin Board card body, or null when it isn't one. The publisher is the row's name. */
export function parseAdminCard(body: unknown, row: LegacyCardRow): LegacyCard | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const content = legacyText(b.content);
  const listed = Array.isArray(b.links) ? b.links.filter(isQortalLink) : [];
  const topic = b.topicMode === true;
  return {
    ...row,
    board: 'admin',
    title: text(b.header) ?? (topic ? 'Admin Board topic' : 'Admin Board card'),
    body: content,
    links: [...new Set([...listed, ...content.links])].slice(0, LINKS_MAX),
    subject: { name: topic ? null : text(b.minterName, 80), address: null },
    nominator: null,
    selfPosted: false,
    pollName: text(b.poll, 120),
    promotion: null,
    topic,
  };
}

export function adminCardKey(viewer: string, row: LegacyCardRow): string {
  return `legacy:adminboard:card:${viewer}:${row.publisher}:${row.identifier}:${row.version}`;
}

/** One card as `viewer` reads it, kept for the session per version. */
export function loadAdminCard(
  viewer: string,
  row: LegacyCardRow
): Promise<AdminBoardRead<LegacyCard>> {
  return fetchQuery(
    adminCardKey(viewer, row),
    async (): Promise<AdminBoardRead<LegacyCard>> => {
      const read = await readEncrypted(row.publisher, row.identifier);
      if (read.status === 'locked') return read;
      const card = parseAdminCard(read.value, row);
      if (!card) throw new LegacyUnreadableError(row.identifier);
      return { status: 'ok', value: card };
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

export function adminCommentKey(viewer: string, row: LegacyCommentRow): string {
  return `legacy:adminboard:comment:${viewer}:${row.author}:${row.identifier}:${row.version}`;
}

/** One comment as `viewer` reads it, kept for the session per version. */
export function loadAdminComment(
  viewer: string,
  row: LegacyCommentRow
): Promise<AdminBoardRead<LegacyComment>> {
  return fetchQuery(
    adminCommentKey(viewer, row),
    async (): Promise<AdminBoardRead<LegacyComment>> => {
      const read = await readEncrypted(row.author, row.identifier);
      if (read.status === 'locked') return read;
      const comment = parseLegacyComment(read.value, row);
      if (!comment) throw new LegacyUnreadableError(row.identifier);
      return { status: 'ok', value: comment };
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}
