/** Client routes. Person and card paths take an address or a card identifier. */
import { appParam } from './hubLocation';

export const PATHS = {
  home: '/',
  nominations: '/nominations',
  nominate: '/nominate',
  // Each other + Propose choice is a page too (Simon, 2026-10-18): /propose/<kind>.
  propose: '/propose',
  ask: '/propose/ask-minter-admins',
  decisions: '/decisions',
  history: '/history',
  // Minter Admin activity lives in the Explorer (Simon, 2026-10-17); `/activity` redirects here.
  activity: '/explorer/activity',
  settings: '/settings',
  people: '/people',
  legacyCard: '/history/card',
  explorer: '/explorer',
  comments: '/comments',
} as const;

/**
 * `/comments/<name>/<identifier>`: one comment, opened where it was posted
 * (its decision's or nomination's page, scrolled to it). Reply alerts and
 * Home's replies open it.
 */
export function commentPath(name: string, identifier: string): string {
  return `${PATHS.comments}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

/**
 * A person's Minter Profile: their Explorer account's Minter Profile tab, its
 * one place (Simon, 2026-10-17: the profile page merged into the Explorer).
 * Older `/people/<address>` links open it too.
 */
export function personPath(address: string): string {
  return explorerAccountPath(address, 'mintership');
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
 * The page of each other + Propose choice (Simon, 2026-10-18: "Make all of
 * these + Propose windows in the style of the + Propose Nomination"), by
 * proposal kind: `/propose/<slug>`, `?who=<address>` to start with someone.
 */
export const PROPOSE_SLUGS = {
  kick: 'remove-member',
  decline: 'decline-join-request',
  ban: 'ban',
  addAdmin: 'make-minter-admin',
  removeAdmin: 'remove-minter-admin',
  cancelBan: 'lift-ban',
  cancelInvite: 'cancel-invite',
} as const;

export type ProposePageKind = keyof typeof PROPOSE_SLUGS;

export function proposePath(kind: ProposePageKind, address?: string): string {
  const base = `${PATHS.propose}/${PROPOSE_SLUGS[kind]}`;
  return address ? `${base}?who=${encodeURIComponent(address)}` : base;
}

/** The kind a `/propose/<slug>` is for, or null. */
export function proposeKindOf(slug: string | undefined): ProposePageKind | null {
  const found = Object.entries(PROPOSE_SLUGS).find(([, s]) => s === slug);
  return found ? (found[0] as ProposePageKind) : null;
}

/**
 * `/decisions/<signature>`: one decision, waiting or decided (its shareable
 * link); `/decisions` without one. The older `/decisions?d=<signature>`
 * form still opens it (see legacyDecisionPath).
 */
export function decisionPath(signature?: string): string {
  return signature ? `${PATHS.decisions}/${encodeURIComponent(signature)}` : PATHS.decisions;
}

/** Decisions' tabs (pages/decisions/decisionsViews.ts). */
export type DecisionsView = 'decisions' | 'nominations';

/**
 * `/decisions?show=<view>`: one of Decisions' tabs, and on Nominations a
 * nomination state other than All (`&state=waiting`).
 */
export function decisionsViewPath(view: DecisionsView, state = 'all'): string {
  const params = new URLSearchParams({ show: view });
  if (view === 'nominations' && state !== 'all') params.set('state', state);
  return `${PATHS.decisions}?${params.toString()}`;
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

/**
 * A registered name, opened (Simon, 2026-10-17: "whenever there is a name
 * … click that name to go into it"): its owner's Names tab, which the
 * account page reaches by the name and shows with that name's card, its
 * whole history open (names/NamesList.tsx).
 */
export function explorerNamePath(name: string): string {
  return explorerAccountPath(name, 'names');
}

/**
 * The router state a link to a name carries (with the page's own: `base`):
 * the Names tab lands on that name only when asked so, not for any visit
 * that found the account by a name (a search does too).
 */
export function nameLinkState(name: string, base?: unknown): Record<string, unknown> {
  return { ...(base && typeof base === 'object' ? base : {}), openName: name };
}

/** The name a link asked the Names tab to land on (nameLinkState), if any. */
export function openNameOf(state: unknown): string | null {
  const value =
    state && typeof state === 'object' ? (state as { openName?: unknown }).openName : null;
  return typeof value === 'string' && value ? value : null;
}

/** `/explorer/tx/<signature>`: one transaction. */
export function explorerTxPath(signature: string): string {
  return `${PATHS.explorer}/tx/${encodeURIComponent(signature)}`;
}

/** `/explorer/transactions`: Transactions on Qortal (the whole chain, by type and blocks). */
export function explorerTransactionsPath(): string {
  return `${PATHS.explorer}/transactions`;
}

/** Transactions on Qortal at one block: every type, just that block, in the block's order. */
export function explorerBlockPath(height: number): string {
  return `${explorerTransactionsPath()}?type=all&blocks=from-${height}&span=1&order=oldest`;
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
 * tab switch neither moves focus to the title nor scrolls to the page's top;
 * the account page brings the new tab's top into view instead, when it is
 * above the screen. Every other path is its own page.
 */
export function pageKeyOf(pathname: string): string {
  const match = pathname.match(EXPLORER_ACCOUNT_PAGE);
  return match ? match[1] : pathname;
}

export type BoardKey = 'minter' | 'admin' | 'ar' | 'stats';
