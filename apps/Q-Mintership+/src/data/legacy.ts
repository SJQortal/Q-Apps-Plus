/**
 * The original Q-Mintership's boards, read-only, for History and person
 * pages (docs/apps/Q-Mintership+.md → Data contract → Legacy reads):
 *
 * - nomination cards: BLOG_POST `Minter-board-card-<id>`;
 * - Minter Admin proposals (the add/remove admin board): BLOG_POST `QM-AR-card-<id>`;
 * - comments on either: BLOG_POST `comment-<cardId>-<id>`;
 * - each card's chain poll `<cardId>-poll` (results only: nobody votes here);
 * - the encrypted admin board (MAIL_PRIVATE `card-MAC-…`) is not decrypted,
 *   only listed, with a link to the original app.
 *
 * Searches are paged and bounded, bodies are cached per version, and the
 * search row is trusted over the body: the publisher is the row's name, and
 * when another name publishes under a card's identifier the original
 * publisher's card wins (as in the original app).
 *
 * Card and comment HTML is never rendered as HTML. It becomes plain
 * paragraphs, and `qortal://` links are pulled out to show as buttons.
 */
import { getPollCounts, getPollInfo } from '../qortal/polls';
import { getNameOwner, isAddress } from './accounts';
import { fetchQdnJson, mapLimit, rowTime, searchQdn } from './qdn';
import { fetchQuery, peekQuery } from './query';
import { isQortalLink } from './records';
import type { QdnRow } from './types';

export const LEGACY_SERVICE = 'BLOG_POST';
export const ADMIN_BOARD_SERVICE = 'MAIL_PRIVATE';
export const MINTER_CARD_PREFIX = 'Minter-board-card-';
export const AR_CARD_PREFIX = 'QM-AR-card-';
export const ADMIN_CARD_PREFIX = 'card-MAC-';

/** Cards History shows per "Load more". */
export const LEGACY_PAGE_SIZE = 20;
/** Cards a Minter Profile looks through on open (newest first), then per "Search older cards". */
export const LEGACY_SCAN_FIRST = 40;
export const LEGACY_SCAN_STEP = 100;

const TEXT_MAX = 20_000;
const LINKS_MAX = 10;

export type LegacyBoard = 'minter' | 'ar' | 'admin';

/** Which old board an identifier belongs to, or null when it isn't a card. */
export function legacyBoardOf(identifier: string): LegacyBoard | null {
  if (identifier.startsWith(MINTER_CARD_PREFIX)) return 'minter';
  if (identifier.startsWith(AR_CARD_PREFIX)) return 'ar';
  if (identifier.startsWith(ADMIN_CARD_PREFIX)) return 'admin';
  return null;
}

/** One card as the search lists it (no body yet). */
export interface LegacyCardRow {
  identifier: string;
  board: LegacyBoard;
  /** The publishing name, from the search row. */
  publisher: string;
  createdAt: number;
  updatedAt: number | null;
  /** Cache key for the body: the latest signature, or the newest time. */
  version: string;
}

/**
 * Search rows → one row per card: the earliest publisher of each identifier
 * (later copies under the same identifier by other names are ignored),
 * newest first.
 */
export function toCardRows(rows: QdnRow[]): LegacyCardRow[] {
  const first = new Map<string, QdnRow>();
  for (const row of rows) {
    if (!row || typeof row.identifier !== 'string' || typeof row.name !== 'string') continue;
    if (!legacyBoardOf(row.identifier)) continue;
    const seen = first.get(row.identifier);
    if (!seen || row.created < seen.created) first.set(row.identifier, row);
  }
  return [...first.values()]
    .map((row) => ({
      identifier: row.identifier,
      board: legacyBoardOf(row.identifier) as LegacyBoard,
      publisher: row.name,
      createdAt: row.created,
      updatedAt: typeof row.updated === 'number' ? row.updated : null,
      version: row.latestSignature ?? String(rowTime(row)),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- text ------------------------------------------------------------------

/** Card or comment content as plain text: paragraphs (line breaks kept) and the qortal:// links in it. */
export interface LegacyText {
  paragraphs: string[];
  links: string[];
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'SVG',
  'MATH',
  'HEAD',
  'TITLE',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'SELECT',
  'TEXTAREA',
  'BUTTON',
  'IMG',
]);
const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'LI',
  'UL',
  'OL',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'PRE',
  'TR',
  'TABLE',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'HR',
  'DL',
  'DT',
  'DD',
  'FIGURE',
  'FIGCAPTION',
]);

function collect(node: Node, out: string[], links: string[]): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out.push(child.nodeValue ?? '');
      return;
    }
    if (child.nodeType !== 1) return;
    const el = child as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) return;
    if (tag === 'BR') {
      out.push('\n');
      return;
    }
    if (tag === 'A') {
      const href = el.getAttribute('href')?.trim();
      if (href && isQortalLink(href)) links.push(href);
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push('\n');
    if (tag === 'LI') out.push('• ');
    collect(el, out, links);
    if (block) out.push('\n');
  });
}

/** Without a DOM (never in the app): drop tags and decode the common entities. */
function stripTags(html: string, links: string[]): string {
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    if (isQortalLink(m[1].trim())) links.push(m[1].trim());
  }
  return html
    .replace(/<(script|style|template|noscript|iframe|svg)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|table|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeChar(Number(dec)))
    .replace(/&amp;/g, '&');
}

function safeChar(code: number): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

const TEXT_LINK = /qortal:\/\/[^\s<>"'`]+/gi;

/**
 * HTML (or plain text) → paragraphs and links. Parsing happens in an inert
 * document (DOMParser runs no scripts and loads nothing), and the result is
 * only ever shown as text.
 */
export function legacyText(value: unknown): LegacyText {
  if (typeof value !== 'string' || !value.trim()) return { paragraphs: [], links: [] };
  const links: string[] = [];
  let raw: string;
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    const out: string[] = [];
    collect(doc.body, out, links);
    raw = out.join('');
  } else {
    raw = stripTags(value, links);
  }
  let text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n');
  if (text.length > TEXT_MAX) text = `${text.slice(0, TEXT_MAX).trimEnd()}…`;
  for (const m of text.matchAll(TEXT_LINK)) {
    const link = m[0].replace(/[.,;:!?)\]}]+$/, '');
    if (isQortalLink(link)) links.push(link);
  }
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { paragraphs, links: unique(links).slice(0, LINKS_MAX) };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function str(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function addr(value: unknown): string | null {
  return isAddress(value) ? value : null;
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

// ---- cards -----------------------------------------------------------------

export interface LegacyCard extends LegacyCardRow {
  board: 'minter' | 'ar';
  title: string;
  body: LegacyText;
  /** qortal:// links from the card's list and its text, deduped. */
  links: string[];
  /** Who the card is about: the nominee, or the admin an AR card proposes to add or remove. */
  subject: { name: string | null; address: string | null };
  /** The nominator the card names, when it names one (it can differ from the publisher). */
  nominator: string | null;
  /** An early card the nominee posted for themselves. */
  selfPosted: boolean;
  pollName: string | null;
  /** AR cards: true = make a Minter Admin, false = remove one, null = not said. */
  promotion: boolean | null;
}

function promotionOf(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return null;
}

/** A card body, or null when it isn't a card at all. Missing fields get plain fallbacks. */
export function parseLegacyCard(body: unknown, row: LegacyCardRow): LegacyCard | null {
  if (row.board === 'admin') return null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const text = legacyText(b.content);
  const listed = Array.isArray(b.links) ? b.links.filter(isQortalLink) : [];
  const ar = row.board === 'ar';
  const subjectName = ar ? str(b.minterName, 80) : (str(b.nominee, 80) ?? str(b.creator, 80));
  const subjectAddress = ar
    ? addr(b.minterAddress)
    : (addr(b.nomineeAddress) ?? addr(b.creatorAddress));
  const nominator = ar
    ? null
    : (str(b.nominator, 80) ?? str(b.publishedBy, 80) ?? str(b.nominatedByName, 80));
  return {
    ...row,
    board: row.board,
    title: str(b.header) ?? (ar ? 'Minter Admin proposal' : 'Nomination card'),
    body: text,
    links: unique([...listed, ...text.links]).slice(0, LINKS_MAX),
    subject: { name: subjectName, address: subjectAddress },
    nominator,
    selfPosted: !ar && !nominator && sameName(subjectName, row.publisher),
    pollName: str(b.poll, 120),
    promotion: ar ? promotionOf(b.promotionCard) : null,
  };
}

export class LegacyUnreadableError extends Error {
  constructor(public readonly identifier: string) {
    super("This card can't be read: its data isn't in the original app's format.");
    this.name = 'LegacyUnreadableError';
  }
}

/** One card's body (key `legacy:card:<publisher>:<identifier>:<version>`, kept for the session). */
export function loadLegacyCard(row: LegacyCardRow): Promise<LegacyCard> {
  return fetchQuery(
    legacyCardKey(row),
    async () => {
      const body = await fetchQdnJson(LEGACY_SERVICE, row.publisher, row.identifier, row.version);
      const card = parseLegacyCard(body, row);
      if (!card) throw new LegacyUnreadableError(row.identifier);
      return card;
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

export function legacyCardKey(row: Pick<LegacyCardRow, 'publisher' | 'identifier' | 'version'>) {
  return `legacy:card:${row.publisher}:${row.identifier}:${row.version}`;
}

export interface LegacyIndex {
  /** Nomination and admin-proposal cards, newest first. */
  cards: LegacyCardRow[];
  truncated: boolean;
}

/**
 * Every old card's search row (key `legacy:index`): two paged searches,
 * at most 1,000 nomination cards and 300 admin proposals (350 and 70 today).
 * Bodies are read per card, only where a screen shows them.
 */
export function loadLegacyIndex(options: { force?: boolean } = {}): Promise<LegacyIndex> {
  return fetchQuery(
    'legacy:index',
    async () => {
      const [minter, ar] = await Promise.all([
        searchQdn(
          { service: LEGACY_SERVICE, identifier: MINTER_CARD_PREFIX, maxPages: 10 },
          { force: options.force }
        ),
        searchQdn(
          { service: LEGACY_SERVICE, identifier: AR_CARD_PREFIX, maxPages: 3 },
          { force: options.force }
        ),
      ]);
      return {
        cards: toCardRows([...minter.rows, ...ar.rows]),
        truncated: minter.truncated || ar.truncated,
      };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

/**
 * One card by identifier (key `legacy:find:<identifier>`): from the index
 * when History already loaded it, otherwise one exact search. Null when no
 * one published it (or it isn't a card identifier).
 */
export function findLegacyCard(
  identifier: string,
  options: { force?: boolean } = {}
): Promise<LegacyCardRow | null> {
  return fetchQuery(
    `legacy:find:${identifier}`,
    async () => {
      const board = legacyBoardOf(identifier);
      if (!board) return null;
      const known = peekQuery<LegacyIndex>('legacy:index')?.cards.find(
        (c) => c.identifier === identifier
      );
      if (known && !options.force) return known;
      const { rows } = await searchQdn(
        {
          service: board === 'admin' ? ADMIN_BOARD_SERVICE : LEGACY_SERVICE,
          identifier,
          prefix: false,
          reverse: false,
          maxPages: 1,
          pageSize: 20,
        },
        { force: options.force }
      );
      return toCardRows(rows.filter((r) => r.identifier === identifier))[0] ?? null;
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

// ---- polls -----------------------------------------------------------------

export interface LegacyPoll {
  name: string;
  yes: number;
  no: number;
  total: number;
  /** False when the poll doesn't belong to the card's publisher (the original app hid such cards); null when unknown. */
  ownerMatches: boolean | null;
}

/** A card's poll result (key `legacy:poll:<pollName>`); null when Core has no such poll. */
export function loadLegacyPoll(
  card: Pick<LegacyCard, 'pollName' | 'publisher'>,
  options: { force?: boolean } = {}
): Promise<LegacyPoll | null> {
  const name = card.pollName ?? '';
  return fetchQuery(
    `legacy:poll:${name}`,
    async () => {
      if (!name) return null;
      // Counts first: a card without a poll costs one read, not three.
      const counts = await getPollCounts(name);
      if (!counts) return null;
      const [info, publisherAddress] = await Promise.all([
        getPollInfo(name),
        getNameOwner(card.publisher).catch(() => null),
      ]);
      return {
        name,
        ...counts,
        ownerMatches: info?.owner && publisherAddress ? info.owner === publisherAddress : null,
      };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

// ---- comments --------------------------------------------------------------

export interface LegacyCommentRow {
  identifier: string;
  author: string;
  postedAt: number;
  editedAt: number | null;
  version: string;
}

export interface LegacyComment extends LegacyCommentRow {
  body: LegacyText;
  replyTo: { author: string | null; excerpt: string } | null;
}

export interface LegacyComments {
  /** Oldest first, as the conversation went. */
  rows: LegacyCommentRow[];
  truncated: boolean;
}

/** The comment rows of one card (key `legacy:comments:<cardId>`), at most 500. */
export function loadLegacyComments(
  cardIdentifier: string,
  options: { force?: boolean } = {}
): Promise<LegacyComments> {
  return fetchQuery(
    `legacy:comments:${cardIdentifier}`,
    async () => {
      const prefix = `comment-${cardIdentifier}-`;
      const { rows, truncated } = await searchQdn(
        { service: LEGACY_SERVICE, identifier: prefix, reverse: false, maxPages: 5 },
        { force: options.force }
      );
      const seen = new Set<string>();
      const list: LegacyCommentRow[] = [];
      for (const row of rows) {
        if (!row?.identifier?.startsWith(prefix) || typeof row.name !== 'string') continue;
        const key = `${row.name}\n${row.identifier}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          identifier: row.identifier,
          author: row.name,
          postedAt: row.created,
          editedAt: typeof row.updated === 'number' ? row.updated : null,
          version: row.latestSignature ?? String(rowTime(row)),
        });
      }
      list.sort((a, b) => a.postedAt - b.postedAt);
      return { rows: list, truncated };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

/** A comment body, or null when it isn't one. The author is the publishing name, never the body's claim. */
export function parseLegacyComment(body: unknown, row: LegacyCommentRow): LegacyComment | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const text = legacyText(b.content);
  let replyTo: LegacyComment['replyTo'] = null;
  if (b.replyTo && typeof b.replyTo === 'object' && !Array.isArray(b.replyTo)) {
    const r = b.replyTo as Record<string, unknown>;
    const excerpt = legacyText(r.content).paragraphs.join(' ');
    replyTo = {
      author: str(r.creator, 80),
      excerpt: excerpt.length > 160 ? `${excerpt.slice(0, 159).trimEnd()}…` : excerpt,
    };
  }
  return { ...row, body: text, replyTo };
}

export function legacyCommentKey(row: LegacyCommentRow): string {
  return `legacy:comment:${row.author}:${row.identifier}:${row.version}`;
}

/** One comment's body, kept for the session. */
export function loadLegacyComment(row: LegacyCommentRow): Promise<LegacyComment> {
  return fetchQuery(
    legacyCommentKey(row),
    async () => {
      const body = await fetchQdnJson(LEGACY_SERVICE, row.author, row.identifier, row.version);
      const comment = parseLegacyComment(body, row);
      if (!comment) throw new LegacyUnreadableError(row.identifier);
      return comment;
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

// ---- per person ------------------------------------------------------------

export interface LegacyMatches {
  /** Cards about this person, newest first. */
  cards: LegacyCard[];
  /** How many of the newest cards were looked through. */
  scanned: number;
  total: number;
  truncated: boolean;
}

/** True when a card is about this person (by address, or by name when the card has no address). */
export function isCardAbout(
  card: Pick<LegacyCard, 'subject'>,
  person: { address: string; name: string | null }
): boolean {
  if (card.subject.address) return card.subject.address === person.address;
  return sameName(card.subject.name, person.name);
}

/**
 * Old cards about one person (key `legacy:for:<address>:<scan>`). Cards
 * don't say who they are about until their body is read, so this reads the
 * newest `scan` cards plus every card the person published themselves (the
 * early boards had people post their own), each body cached for the session.
 */
export function loadLegacyFor(
  person: { address: string; name: string | null },
  scan: number,
  options: { force?: boolean } = {}
): Promise<LegacyMatches> {
  return fetchQuery(
    `legacy:for:${person.address}:${scan}`,
    async () => {
      const index = await loadLegacyIndex(options);
      const newest = index.cards.slice(0, scan);
      const own = index.cards
        .slice(scan)
        .filter((row) => sameName(row.publisher, person.name))
        .slice(0, 50);
      const cards = await mapLimit([...newest, ...own], 6, async (row) => {
        try {
          return await loadLegacyCard(row);
        } catch {
          return null;
        }
      });
      return {
        cards: cards
          .filter((card): card is LegacyCard => card !== null && isCardAbout(card, person))
          .sort((a, b) => b.createdAt - a.createdAt),
        scanned: Math.min(scan, index.cards.length),
        total: index.cards.length,
        truncated: index.truncated,
      };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}
