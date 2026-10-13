/** Client routes. Person and card paths take an address or a card identifier. */
import { appParam } from './hubLocation';

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

/**
 * `/decisions/<signature>`: one decision, waiting or decided (its shareable
 * link); `/decisions` without one. The older `/decisions?d=<signature>`
 * form still opens it (see legacyDecisionPath).
 */
export function decisionPath(signature?: string): string {
  return signature ? `${PATHS.decisions}/${encodeURIComponent(signature)}` : PATHS.decisions;
}

/** `/decisions/polls/<id>`: one Minter Admin poll (its shareable link; Minter Admins only). */
export function adminPollPath(id: string): string {
  return `${PATHS.decisions}/polls/${encodeURIComponent(id)}`;
}

/** `/nominations/<address>`: one person's nomination, its rounds and outcomes (its shareable link). */
export function nominationPath(address: string): string {
  return `${PATHS.nominations}/${encodeURIComponent(address)}`;
}

/**
 * Where an old `/decisions?d=<signature>` link goes now: the decision's own
 * page. Null when `d` is missing (appParam drops a query Hub appended).
 */
export function legacyDecisionPath(search: string): string | null {
  const signature = appParam(new URLSearchParams(search), 'd');
  return signature ? decisionPath(signature) : null;
}

export type BoardKey = 'minter' | 'admin' | 'ar' | 'stats';
