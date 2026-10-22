/**
 * Everything that makes this build "Q-Shop+" rather than the original Q-Shop
 * lives here, so the upstream "Ship as" commit only has to edit this file
 * (docs/RELEASE.md, stage 4):
 *
 * - the app's name, and the name written into copied `qortal://APP/…` links;
 * - the original app's name and link;
 * - which mail app the "Message the seller" links open;
 * - the browser storage prefix (all Q-Apps on a node share one origin) and the
 *   keys built from it;
 * - the settings-sync identifier;
 * - the repository and original-app links shown in Settings → About.
 *
 * index.html takes its title and theme key from here too, through
 * vite.config.ts.
 *
 * The QDN identifiers of stores, products, catalogues, orders and reviews are
 * NOT here: they are shared data (docs/apps/Q-Shop+.md → Data contract), and
 * the + app and the original must read and write the same ones
 * (src/qdn/identifiers.ts).
 */

/** The name this build is published under, shown in the header and About. */
export const APP_NAME = "Q-Shop+";

/**
 * The app name in copied `qortal://APP/<name>/…` links. Hub never decodes the
 * app name, so the `+` is written literally (docs/QORTAL.md → Deep links).
 */
export const LINK_APP_NAME = "Q-Shop+";

/** The original app, by its QDN name. */
export const ORIGINAL_APP_NAME = "Q-Shop";

/** Opens the original app (Settings → About). Null hides the link. */
export const ORIGINAL_APP_LINK: string | null = `qortal://APP/${ORIGINAL_APP_NAME}`;

/**
 * The mail app that "Message the seller/buyer" links and the account menu
 * open: the original Q-Mail (Simon, 2026-10-22: Q-Mail has been updated with
 * Q-Mail+'s changes, so links go to it rather than the + testground). It
 * opens `/to/<name>` at a new message to that name.
 */
export const MAIL_APP_NAME = "Q-Mail";

/** Prefix of every browser storage key this build writes. */
export const STORAGE_PREFIX = "qshopplus-";

/** The chosen theme (JSON string, e.g. "hub30"); also read by index.html's boot snippet. */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}ui-theme`;

/** Settings → preferred coin, display options, hidden names… */
export const SETTINGS_STORAGE_KEY = `${STORAGE_PREFIX}settings`;

/** The cart, per store, so it survives a reload. */
export const CART_STORAGE_KEY = `${STORAGE_PREFIX}cart`;

/**
 * Orders that were paid for but not yet recorded on QDN (the order publish
 * was declined, failed or timed out after the payment went through). Kept
 * until the order is found on QDN, so the buyer can finish it without paying
 * again.
 */
export const PENDING_ORDERS_STORAGE_KEY = `${STORAGE_PREFIX}pending-orders`;

/**
 * Payment signatures already used by orders recorded from this device, so
 * "Check again" never attaches one payment to two orders.
 */
export const USED_PAYMENTS_STORAGE_KEY = `${STORAGE_PREFIX}used-payments`;

/** The name picked in the name switcher, per account address. */
export const ACTIVE_NAME_STORAGE_KEY = `${STORAGE_PREFIX}active-name`;

/** Shops this browser deleted in the last hour (qdn/deleted.ts): the node can list them for a while after. */
export const DELETED_SHOPS_STORAGE_KEY = `${STORAGE_PREFIX}deleted-shops`;

/** Product deletes whose catalogues didn't all land (seller/pendingDeletes.ts). */
export const PENDING_DELETES_STORAGE_KEY = `${STORAGE_PREFIX}pending-deletes`;

/** Settings → Sync: a DOCUMENT under the user's name (additive data). */
export const SETTINGS_SYNC_IDENTIFIER = "qshopplus_settings";

/** Settings → About. */
export const REPO_URL = "https://github.com/SJQortal/Q-Apps-Plus";
export const UPSTREAM_REPO_URL = "https://github.com/Qortal/q-shop";
