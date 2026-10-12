/** Client routes. Person and card paths take an address or a card identifier. */
export const PATHS = {
  home: '/',
  nominations: '/nominations',
  nominate: '/nominate',
  decisions: '/decisions',
  history: '/history',
  activity: '/activity',
  settings: '/settings',
  people: '/people',
  legacyCard: '/history/card',
} as const;

/** `/people/<address>`: a person's page (profile, nominations, History). */
export function personPath(address: string): string {
  return `${PATHS.people}/${encodeURIComponent(address)}`;
}

/** `/history/card/<identifier>`: one card from the original app, read-only. */
export function legacyCardPath(identifier: string, section = ''): string {
  const base = `${PATHS.legacyCard}/${encodeURIComponent(identifier)}`;
  return section ? `${base}/${encodeURIComponent(section)}` : base;
}

/** `/nominate?who=<address>`: the nominate form, optionally for someone. */
export function nominatePath(address?: string): string {
  return address ? `${PATHS.nominate}?who=${encodeURIComponent(address)}` : PATHS.nominate;
}

/** `/decisions?d=<signature>`: the Decisions queue opened at one decision. */
export function decisionPath(signature?: string): string {
  return signature ? `${PATHS.decisions}?d=${encodeURIComponent(signature)}` : PATHS.decisions;
}

export type BoardKey = 'minter' | 'admin' | 'ar' | 'stats';
