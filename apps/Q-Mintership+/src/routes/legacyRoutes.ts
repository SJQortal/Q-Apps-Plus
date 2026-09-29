/**
 * The original app used `#` hash routes for deep links to a board card, e.g.
 * `#/minter/<cardIdentifier>/<section>` or `#?board=minter&card=…`, and plain
 * relative hrefs (`MINTERS`, `ADMINBOARD`, …) for its nav buttons. Existing
 * links in chat and forum posts still use those forms, so this module parses
 * them exactly as legacy/assets/js/Q-Mintership.js did and maps them onto the
 * React routes.
 */
import { boardPath, PATHS, type BoardKey } from './paths';

export interface LegacyBoardRoute {
  board: BoardKey | '';
  cardIdentifier: string;
  section: string;
  hash: string;
}

const BOARD_ALIASES: Record<string, BoardKey> = {
  admin: 'admin',
  adminboard: 'admin',
  databoard: 'admin',
  encryptedboard: 'admin',
  stats: 'stats',
  statistics: 'stats',
  nominatorstats: 'stats',
  minter: 'minter',
  minters: 'minter',
  minterboard: 'minter',
  ar: 'ar',
  mam: 'ar',
  addremove: 'ar',
  addremoveadmin: 'ar',
  addremoveboard: 'ar',
};

/** Same normalisation as the legacy `normalizeBoardRouteKey`. */
export function normalizeBoardRouteKey(value: unknown = ''): BoardKey | '' {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!normalized) return '';
  return BOARD_ALIASES[normalized] ?? '';
}

function safeDecodeRouteSegment(value: unknown = ''): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** The legacy link form, kept so links can still be shared with users of the original app. */
export function buildBoardRouteHash(route: {
  board?: string;
  cardIdentifier?: string;
  section?: string;
}): string {
  const board = normalizeBoardRouteKey(route.board);
  if (!board) return '';
  const segments: string[] = [board];
  const card = String(route.cardIdentifier ?? '').trim();
  const section = String(route.section ?? '').trim();
  if (card) segments.push(encodeURIComponent(card));
  if (section) segments.push(encodeURIComponent(section));
  return `#/${segments.join('/')}`;
}

/** Port of the legacy `parseBoardRouteHash`; returns null when the hash is not a board route. */
export function parseBoardRouteHash(rawHash: string): LegacyBoardRoute | null {
  const stripped = String(rawHash ?? '')
    .trim()
    .replace(/^#/, '');
  if (!stripped) return null;

  let board: BoardKey | '' = '';
  let cardIdentifier = '';
  let section = '';

  if (stripped.startsWith('/')) {
    const [pathPart, queryPart = ''] = stripped.replace(/^\//, '').split('?');
    const segments = pathPart
      .split('/')
      .filter(Boolean)
      .map((segment) => safeDecodeRouteSegment(segment));
    board = normalizeBoardRouteKey(segments[0] ?? '');
    cardIdentifier = segments[1] ?? '';
    section = segments[2] ?? '';
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      board = normalizeBoardRouteKey(params.get('board') || board);
      cardIdentifier = params.get('card') || params.get('cardIdentifier') || cardIdentifier;
      section = params.get('section') || section;
    }
  } else {
    const query = stripped.startsWith('?') ? stripped.slice(1) : stripped;
    const params = new URLSearchParams(query);
    board = normalizeBoardRouteKey(params.get('board'));
    cardIdentifier = params.get('card') || params.get('cardIdentifier') || '';
    section = params.get('section') || '';
  }

  cardIdentifier = String(cardIdentifier || '').trim();
  section = String(section || '').trim();
  if (!board && !cardIdentifier && !section) return null;
  return { board, cardIdentifier, section, hash: rawHash };
}

/** The React route for a legacy hash, or null when it is not one (or names no board). */
export function legacyHashToPath(rawHash: string): string | null {
  const route = parseBoardRouteHash(rawHash);
  if (!route || !route.board) return null;
  return boardPath(route.board, route.cardIdentifier, route.section);
}

/** The original nav buttons pointed at these relative hrefs. */
const LEGACY_HREFS: Record<string, string> = {
  'MINTERSHIP-FORUM': PATHS.forum,
  MINTERS: PATHS.minters,
  'MINTER-BOARD': PATHS.minters,
  ADMINBOARD: PATHS.adminBoard,
  TOOLS: PATHS.tools,
  STATS: PATHS.stats,
  ADDREMOVEADMIN: PATHS.mam,
  'INDEX.HTML': PATHS.home,
};

/** The React route for a legacy relative href such as `MINTERS`, or null. */
export function legacyPathToPath(pathname: string): string | null {
  const last = String(pathname ?? '')
    .split('/')
    .filter(Boolean)
    .at(-1);
  if (!last) return null;
  const key = safeDecodeRouteSegment(last).toUpperCase();
  return LEGACY_HREFS[key] ?? null;
}
