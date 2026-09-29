/**
 * Constants shared with the original app (legacy/assets/js/QortalApi.js and
 * the boards). These are part of the data contract: changing them changes
 * which groups, names and resources the app talks to.
 */

/** The MINTER group. Invites, approvals, joins, kicks and bans all target it. */
export const MINTER_GROUP_ID = 694;

/** Members of any of these groups count as forum admins (see verifyUserIsAdmin). */
export const ADMIN_GROUP_NAMES = ['Q-Mintership-admin', 'dev-group', 'Mintership-Forum-Admins'] as const;
export const ADMIN_GROUP_IDS = ['721', '1', '673'] as const;

export const NULL_ADDRESS = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';

export const GROUP_INVITES_BY_ADDRESS_CACHE_TTL_MS = 15_000;

export const POLL_RESULTS_FETCH_RETRY_ATTEMPTS = 10;
export const POLL_RESULTS_FETCH_RETRY_DELAY_MS = 500;
export const POLL_RESULTS_FETCH_RETRY_DELAY_CAP_MS = 5_000;

/** Default fee the legacy builders used where the caller passed none. */
export const DEFAULT_TX_FEE = 0.01;

/** Page size for board and forum lists (docs/QORTAL.md: never unlimited). */
export const DEFAULT_PAGE_SIZE = 20;

/** Core's own default when the app passes nothing; legacy searchSimple used 1500. */
export const LEGACY_SEARCH_SIMPLE_LIMIT = 1500;

export const QORTAL_ADDRESS_RE = /^Q[A-Za-z0-9]{33}$/;
