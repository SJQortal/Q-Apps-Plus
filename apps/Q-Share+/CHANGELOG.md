# Changelog

Newest first. The in-app copy lives in `src/constants/changelog.ts` (Settings → About → What's new).

## 1.0.0-plus.4 (2026-09-30)

Checked live in Qortal Hub (GO 3.0 build, Dev Mode) with real data at 1440, 700, 390×844, 360×740 and 844×390; details in docs/apps/Q-Share+.md → Hub Dev Mode check.

- Security: descriptions build `qortal://` links on the DOM (the regex linkifier allowed stored XSS, inherited from upstream); relative links, `<style>`, forms and image maps are dropped; DOMPurify 3.0.6 → 3.4.16. A share's JSON can no longer override its publisher or identifier, and cached bodies are matched by name as well as identifier.
- Links: `qortal://APP/Q-Share+/…` (Hub never decodes `%2B`, so the old links opened a blank tab); the router accepts both spellings; copying falls back to a manual-copy dialog on plain-http nodes.
- Share page: PDFs open with Hub's `SHOW_PDF_READER`; audio and video wait until the file is on the node; shares not on the node yet wait for peers; deleted shares and error pages are told apart; a compact action row on phones; "Add to collection" instead of a second "Save"; comments keyed by the share's `commentsId` are shown.
- Home and lists: titles from the search at once, "Not available on your node right now" instead of an endless skeleton, deleted shares left out, paging continues past hidden names, the query survives Back, My shares toggles off, category filters count as filters.
- Phones: sticky header and Back bars work again (`overflow-x: clip`), bottom sheets mount only when opened (Home's DOM halves), the Share button and toasts keep clear of content, a 52 px bar with Share in it in landscape, 44 px targets.
- Downloads and saves: declines are quiet; GO and files over 100 MB stream by `location`; files that finish after you leave are built; names with `/` work; one node call fewer per file.
- Publishing: the wait matches Hub's (30 min per resource), a timeout checks QDN before any retry, per-file progress from Hub's `PUBLISH_STATUS`, declines recognised in all 12 Hub languages.
- Theme kit (`Repo:`): follows Hub's `THEME_CHANGED` without a reload.
- Editor: no text or highlight colours (they vanished in other themes); pasted colours are dropped.
- Quality: 399 tests (122 at 1.0.0-plus.3); lint clean.

## 1.0.0-plus.3 (2026-09-30)

- Settings sync: a Sync section saves your settings and theme to QDN under your name (one small document; Hub confirms, the usual fee applies) and restores them on another device. Nothing runs on its own, so first load costs no extra call.
- Save all as .zip on a share page once every file is on the node: one Hub save dialog instead of one per file, built by a small store-only ZIP writer (no dependency), for shares up to 150 MB.
- Downloads list: a Save button on every file that is ready. Share page: Edit share for the owner. Profile pages: a Collections tab that loads only when opened.
- Publish dialog: shows the total size and the time elapsed while Hub works (it reports nothing until the batch is done).
- Accessibility: an axe-core audit (WCAG 2.1 AA + best practices) runs in the screenshot harness on every capture; it found no contrast problems in any theme and the structure it asked for is in place (a `main` landmark, one banner, an h1 on every page, named bottom sheets, named editor pickers). 122 tests.

## 1.0.0-plus.2 (2026-09-30)

- Phones and GO: a bottom bar (Home, Collections, Downloads, Settings) and a floating Share button; the header hides while you scroll down; Back buttons on share, profile and collection pages; filters and sort in a bottom sheet; pull-to-refresh on lists; full-screen Share and Edit dialogs whose Publish button stays above the keyboard; 44 px targets; safe-area insets; the same layout on a phone held sideways.
- Collections (new, additive): save any share to a named collection with the bookmark button on a row or a share page; a Collections page and a page per collection with edit, remove and delete. Stored as `qshare_collection_<slug>_<id>` DOCUMENT resources that the original Q-Share ignores.
- Share files: drag and drop or tap to choose, a file list with type icons, sizes and a running total, remove before publishing, step-by-step progress with retry for the files that failed, and a draft that survives closing the dialog.
- Share page: previews for PDF and text files, an image lightbox, audio and video players on demand, Fetch all files, big Download buttons, a collapsible description, and clear comment states.
- Home: a Following feed (the Core's followed-only search), My shares, hidden names, lazy avatars, and a refresh after you publish or edit.
- Settings: Content (automatic image previews, Following feed, default sort, hidden names), Downloads (clear finished), network statistics on demand.
- Qortal efficiency: Home first load is one paged search plus the 20 bodies; a share opens cold with one search and one fetch; the collections list loads once per session after the page's own data; first download 831 kB → 777 kB (261 → 250 kB gzip).
- Quality: ESLint 9 flat config with the React hooks rules (0 errors, 0 warnings), 106 tests including the publish payload and collection format, an error boundary, and a screenshot harness (`e2e/screens.mjs`) that checks every screen at five sizes in four themes.
- Removed: the unreachable Q-Tube player and playlist code, react-rnd, compressorjs and ts-key-enum.
- Data: shares, files and comments unchanged. Collections are additive.

## 1.0.0-plus.1 (2026-09-30)

- Platform: React 19.3, MUI 9.4, Redux Toolkit 2, react-router 6.30 (v7 flags), Vite 8, TypeScript 5.9, vitest.
- Themes: Hub 3.0 (default), Q-Share Classic, Black and White from the shared theme kit, with a no-flash boot snippet.
- Settings page: active name and name switcher, theme picker, blocked names, About with this changelog.
- Editor: react-quill-new (Quill 2) replaces react-quill; published descriptions are normalised to the Quill 1 markup the original Q-Share stores, and old descriptions render with the app's own styles.
- Qortal efficiency: every search goes through one helper (page of 20, in-flight merge, 2-minute cache, never `limit=0`); comment replies in one prefix search; comment avatars by URL; follow size only on tooltip open; share statistics moved to Settings on demand; download polling stops on READY and pauses while hidden.
- Bundle: moment removed, Quill editor and secondary routes lazy; biggest chunk 1,123 kB → 415 kB.
- UX: Hub 3.0 Home with a filters rail, sort, My shares, empty/error/loading states; labelled row actions with Copy link; share page previews for images, audio and video; profile header; theme colours everywhere.
- Fixes: updated shares are re-fetched (comparison bug), unfollow sends `item`, download intervals cleared, Load more only after a full page, names encoded in paths and links.
- Data: unchanged. Same services, identifiers and JSON as Q-Share.
