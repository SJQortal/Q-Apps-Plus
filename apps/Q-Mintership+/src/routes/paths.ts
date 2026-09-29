/** Client routes. Board paths take an optional card identifier and section. */
export const PATHS = {
  home: '/',
  forum: '/forum',
  minters: '/minters',
  mam: '/mam',
  stats: '/stats',
  adminBoard: '/admin-board',
  tools: '/tools',
  account: '/account',
  settings: '/settings',
} as const;

export type BoardKey = 'minter' | 'admin' | 'ar' | 'stats';

/** The legacy hash-route board keys and the paths they map to. */
export const BOARD_PATHS: Record<BoardKey, string> = {
  minter: PATHS.minters,
  admin: PATHS.adminBoard,
  ar: PATHS.mam,
  stats: PATHS.stats,
};

export function boardPath(board: BoardKey, cardIdentifier = '', section = ''): string {
  const parts = [BOARD_PATHS[board]];
  const card = String(cardIdentifier || '').trim();
  const sec = String(section || '').trim();
  if (card) parts.push(encodeURIComponent(card));
  if (card && sec) parts.push(encodeURIComponent(sec));
  return parts.join('/');
}
