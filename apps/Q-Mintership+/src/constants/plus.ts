/**
 * Everything that makes this build "Q-Mintership+" rather than the original
 * Q-Mintership lives here, so the upstream "Ship as" commit only has to edit
 * this file (docs/RELEASE.md, stage 4):
 *
 * - the app's name, and the name written into copied `qortal://APP/…` links;
 * - how the copy names the original app, and its link;
 * - the browser storage prefix (all Q-Apps on a node share one origin);
 * - the repository and original-app links shown in Settings → About.
 *
 * The UI takes its words from here (and index.html its title and theme key,
 * through vite.config.ts), so the + build and the original show the same
 * screens with their own names. The changelog (constants/changelog.ts) is the
 * one exception: its release notes are rewritten for the original anyway.
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

/** The original app (the boards this rewrite replaces), by its QDN name. */
export const ORIGINAL_APP_NAME = 'Q-Mintership';

/**
 * Opens the original app (Settings → About, and its encrypted Minter Admin
 * board in History). Null hides those links: shipped as Q-Mintership itself,
 * the original has no publish of its own.
 */
export const ORIGINAL_APP_LINK: string | null = `qortal://APP/${ORIGINAL_APP_NAME}`;

/**
 * How the copy names the original app. Shipped as Q-Mintership itself, each
 * is "Q-Mintership 3" ("Q-Mintership 3's Minter Admin board", "Q-Mintership 3
 * card"). At the start of a sentence, pass it through sentenceStart().
 */
export const ORIGINAL_WORDS = {
  /** In a sentence: "cards from the original app". */
  app: 'the original app',
  /** The same, by name: "From the original Q-Mintership, read-only." */
  named: 'the original Q-Mintership',
  /** Before a noun: "original-app cards". */
  adjective: 'original-app',
  /** Its encrypted board: "the original Minter Admin board". */
  adminBoard: 'the original Minter Admin board',
  /** The title of one of its cards' pages. */
  card: 'Original card',
} as const satisfies Record<string, string>;

/** Prefix of every localStorage key this build writes. */
export const STORAGE_PREFIX = 'qmintershipplus-';

/** localStorage key for the chosen theme. Must match STORAGE_KEY in index.html. */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}ui-theme`;

export const UPSTREAM_REPO = 'https://github.com/Qortal/Q-Mintership-Alpha';
export const SOURCE_REPO = 'https://github.com/SJQortal/Q-Apps-Plus';
