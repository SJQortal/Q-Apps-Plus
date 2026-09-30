# Changelog

Newest first. The in-app copy lives in `src/constants/changelog.ts` (Settings → About → What's new).

## 1.0.0 (not published yet)

The first release of Q-Share+. It reads and writes the same QDN data as Q-Share: your shares, files and comments show up in both, and anything published here still works in the original. Collections and synced settings are new, additive data that Q-Share ignores.

**Platform and quality**
- React 19.3, MUI 9.4, Redux Toolkit 2, react-router 6.30 (v7 flags), Vite 8, TypeScript 5.9.
- The editor runs on Quill 2 (react-quill-new); published descriptions are normalised to the Quill 1 markup the original stores, and old descriptions render with the app's own styles. Text and highlight colours are gone from the toolbar (they vanished in other themes) and pasted colours are dropped. The placeholder no longer sits on top of the first word while a phone keyboard (or a desktop IME) is still composing it.
- ESLint 9 with the React hooks rules (clean), 485 vitest tests, an error boundary, and a screenshot harness (`e2e/screens.mjs`) that checks every screen at five sizes in four themes with an axe-core accessibility audit.
- Removed: moment, react-quill, the unreachable Q-Tube player and playlist code, react-rnd, compressorjs and ts-key-enum.

**Looks and phones**
- Four themes from the shared kit: Hub 3.0 (default), Q-Share Classic, Black and White, with a no-flash boot snippet; Hub's light/dark switch applies without a reload. Text contrast is at least 4.5:1 in every theme.
- Phones and GO: a bottom bar (Home, Collections, Downloads, Settings) and a Share button, a header that hides on scroll, Back bars on sub-pages, filters and sort in a bottom sheet, pull-to-refresh, full-screen Share and Edit forms with Publish above the keyboard, 44 px targets, safe-area insets, and a compact bar with Share in it on a phone held sideways.
- List or grid view on Home, profiles and collections (Settings → Appearance or the switch above each list).

**Finding shares**
- Home: a filters rail (a Filters sheet on phones), newest/oldest sort, My shares (for one or all of your names), a Following feed, hidden names, and clear loading, empty and error states. Titles show at once; shares that aren't reachable say so, deleted ones are left out, and paging continues past hidden names.
- The publisher filter suggests names as you type, with avatars.
- Every search field has a ✕ that clears it while it has text (title search, publisher filter, name switcher).
- Profile pages with Shares and Collections tabs.

**Share pages and downloads**
- Files: Play audio and Play video once the file is on the node, previews of images (with a lightbox) and text, PDFs in Hub's own reader. Subtitles (.srt, .vtt) and checksum files preview as text, audiobooks (.m4b) and WebM audio play, and comic books (.cbz, .cbr) are listed as documents. Fetch all files, big Download buttons, Save all as .zip (up to 150 MB), Edit share for the owner, Copy link, Add to collection.
- Descriptions are sanitised on the DOM: no script, styles, forms or relative links; `qortal://` links work (DOMPurify 3.4).
- Downloads: a list with progress, Save on every ready file, and Clear finished; polling stops when a file is ready or the tab is hidden; GO and files over 100 MB stream from the node; declines in Hub are not errors.
- Copied links use `qortal://APP/Q-Share+/…`, which Hub opens (the router also accepts the `%2B` spelling).

**Publishing**
- Drag and drop or tap to choose, type icons, sizes and a running total, remove before publishing, a draft that survives closing the dialog.
- Per-file progress from Hub, a wait as long as Hub's, a QDN check before any retry so nothing is paid twice, retry of failed files only, and declines recognised in every Hub language.

**Collections** (new data: `qshare_collection_` DOCUMENTs)
- Save any share to a named collection; a Collections page (Mine / All), a page per collection with edit, remove and delete.

**Settings**
- Account with a name switcher that searches when you have more than 15 names (accents and capitals optional, keyboard support, avatars); appearance; content (image previews, Following feed, default sort, hidden names); blocked names; network statistics on demand; Sync (save and restore your settings and theme on QDN); About with this changelog.

**Qortal efficiency**
- Every search goes through one helper: pages of 20, in-flight merge, a 2-minute cache, never `limit=0`. Home's first load is one paged search plus the bodies of what shows; a share opens with one search and one fetch, or none when cached; comment threads take two searches; avatars load lazily by URL.
- Biggest JS chunk 1,123 kB → 265 kB; routes, the editor and secondary screens load on demand.
