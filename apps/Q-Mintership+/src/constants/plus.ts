/**
 * Everything that makes this build "Q-Mintership+" rather than the original
 * Q-Mintership lives here, so the upstream "Ship as" commit only has to edit
 * this file (docs/RELEASE.md, stage 4):
 *
 * - the app's name, and the name written into copied `qortal://APP/…` links;
 * - the browser storage prefix (all Q-Apps on a node share one origin);
 * - the repository and original-app links shown in Settings → About.
 *
 * The QDN identifiers of the new nomination and support records are NOT here:
 * they are shared data (docs/apps/Q-Mintership+.md → Data contract), and the
 * + app and the original must read and write the same ones.
 */

/** The name this build is published under, and shown in the header and About. */
export const APP_NAME = 'Q-Mintership+';

/**
 * The app name in copied `qortal://APP/<name>/…` links. Hub never decodes the
 * app name, so the `+` is written literally (docs/QORTAL.md → Deep links).
 */
export const LINK_APP_NAME = 'Q-Mintership+';

/** The original app, for "open in the original app" links and the About page. */
export const ORIGINAL_APP_NAME = 'Q-Mintership';
export const ORIGINAL_APP_LINK = `qortal://APP/${ORIGINAL_APP_NAME}`;

/** Prefix of every localStorage key this build writes. */
export const STORAGE_PREFIX = 'qmintershipplus-';

/** localStorage key for the chosen theme. Must match STORAGE_KEY in index.html. */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}ui-theme`;

export const UPSTREAM_REPO = 'https://github.com/Qortal/Q-Mintership-Alpha';
export const SOURCE_REPO = 'https://github.com/SJQortal/Q-Apps-Plus';
