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
  explorer: '/explorer',
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

// ---- Explorer ---------------------------------------------------------------
// Every account and compare URL carries addresses in path segments, so Hub's
// Back/Forward, Hub's own Copy link and copied qortal:// links keep them.

/** The account page's tabs; Overview has no path segment. */
export const EXPLORER_TABS = [
  'overview',
  'connections',
  'transactions',
  'mintership',
  'names',
] as const;
export type ExplorerTab = (typeof EXPLORER_TABS)[number];

/** A tab segment from the URL, or Overview for none or one the page doesn't know. */
export function explorerTabOf(segment: string | undefined): ExplorerTab {
  return (EXPLORER_TABS as readonly string[]).includes(segment ?? '')
    ? (segment as ExplorerTab)
    : 'overview';
}

/** `/explorer/account/<address>[/<tab>]`: one account in the Explorer. */
export function explorerAccountPath(address: string, tab?: ExplorerTab): string {
  const base = `${PATHS.explorer}/account/${encodeURIComponent(address)}`;
  return tab && tab !== 'overview' ? `${base}/${tab}` : base;
}

/** `/explorer/compare/<a>/<b>[/<c>/<d>]`: 2 to 4 accounts side by side. */
export function explorerComparePath(addresses: string[]): string {
  return `${PATHS.explorer}/compare/${addresses.map((a) => encodeURIComponent(a)).join('/')}`;
}

/** `/explorer/tx/<signature>`: one transaction. */
export function explorerTxPath(signature: string): string {
  return `${PATHS.explorer}/tx/${encodeURIComponent(signature)}`;
}

/** `/explorer/transactions`: Transactions on Qortal (the whole chain, by type and blocks). */
export function explorerTransactionsPath(): string {
  return `${PATHS.explorer}/transactions`;
}

/** `/explorer/sponsees/<address>`: the accounts a sponsor sponsored. */
export function explorerSponseesPath(address: string): string {
  return `${PATHS.explorer}/sponsees/${encodeURIComponent(address)}`;
}

/** `/explorer/funded/<address>`: the accounts whose first QORT payment came from this one. */
export function explorerFundedPath(address: string): string {
  return `${PATHS.explorer}/funded/${encodeURIComponent(address)}`;
}

const EXPLORER_ACCOUNT_PAGE = /^(\/explorer\/account\/[^/]+)(?:\/.*)?$/;

/**
 * What counts as one page for focus and scrolling: an account's tabs are one
 * page (`/explorer/account/<who>/<tab>` → `/explorer/account/<who>`), so a
 * tab switch neither moves focus to the title nor scrolls to the top. Every
 * other path is its own page.
 */
export function pageKeyOf(pathname: string): string {
  const match = pathname.match(EXPLORER_ACCOUNT_PAGE);
  return match ? match[1] : pathname;
}

export type BoardKey = 'minter' | 'admin' | 'ar' | 'stats';
