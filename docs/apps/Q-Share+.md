# Q-Share+

Share files and documents on QDN, with categories, comments and lists.

**Published:** `1.0.0` on 2026-09-30, as the QDN `APP` resource `Q-Share+`, built from commit `2bc12cc`. Checked on 2026-10-01: the live bundle's 17 JavaScript chunks have the same content-hashed names as a build of that commit.

**Version on the branch:** `1.0.1`, not published yet: Play audio / Play video, more file types, and the description placeholder fix (CHANGELOG.md). The work below was drafted in six rounds numbered `1.0.0-plus.1` … `plus.6`; under the plain-version rule (qplus-app skill) they are all part of `1.0.0`.

## Baseline at import

- **Upstream:** [Qortal/q-share](https://github.com/Qortal/q-share) branch `main` at `9c1ca81` (2026-06-10, 31 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 4, TypeScript 5
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 2.8 MB, biggest JS chunk 1.1 MB
- **QDN services:** DOCUMENT, FILE, THUMBNAIL, BLOG_COMMENT
- **Identifiers:** `qshare_file_`, `qshare_playlist_`, `qcomment_v1_qshare_`, `qortal_avatar` (full contract in the audit below)
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×5, GET_QDN_RESOURCE_URL ×5, SEARCH_QDN_RESOURCES ×4, GET_QDN_RESOURCE_PROPERTIES ×4, ADD/DELETE/GET_LIST_ITEMS; `/arbitrary/resources` ×13

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- **`react-quill` 2 crashes on React 19** (it calls `findDOMNode`). Switch to `react-quill-new` (Quill 2) and check that content written by the + app still displays correctly in the original app, and the other way round (docs/MIGRATION-NOTES.md, Q-Apps+ specifics).
- Has 3 `limit: 0` searches (stats count, follow size, comment replies).

## Feature ideas to weigh in the audit

- drag-and-drop multi-file upload with progress
- folders or collections
- file previews (images, PDF, text, audio, video)
- sort by newest or popular
- copy share link

## Audit

Read in full on 2026-09-29 (12.2k lines). Line numbers are from the branch after the platform upgrade.

### Architecture map

- **Entry:** `main.tsx` → `BrowserRouter basename=_qdnBase` → `App.tsx` → Redux `Provider` → `HubThemeProvider` → `Notification` (toasts) → `DownloadWrapper` (download context + status polling) → `GlobalWrapper` (account lookup, avatar, `NavBar`, `EditFile` modal, a floating `react-rnd` video player, consent dialog, `useIframe`).
- **Routes:** `/` Home (filters column + `FileList`), `/share/:name/:id` FileContent (share page, files, comments), `/channel/:name` IndividualProfile (`FileListComponentLevel`), `/settings` (new).
- **State:** `authSlice` (user: address, publicKey, name, names[]), `fileSlice` (files, filteredFiles, hashMapFiles keyed by identifier, filter values, editFileProperties), `globalSlice` (downloads by identifier, userAvatarHash, videoPlaying, stats counts), `notificationsSlice` (toast messages).
- **Qortal calls live in:** `hooks/useFetchFiles.tsx` (all list searches), `wrappers/GlobalWrapper.tsx` (account), `wrappers/DownloadWrapper.tsx` + `components/common/FileElement.tsx` (downloads), `pages/FileContent/FileContent.tsx` (one share), `components/common/Comments/*` (BLOG_COMMENT), `components/common/FollowButton.tsx`, `components/common/BlockedNamesModal`, `pages/Home/FileList.tsx` (block), `components/PublishFile`, `components/EditFile`, `components/common/MultiplePublish`.
- **Dead code carried from Q-Tube:** `VideoPlayer.tsx` (857 lines, never rendered), `VideoPlayerGlobal.tsx` + the `Rnd` wrapper in GlobalWrapper (only shown when `videoPlaying` is set, which only VideoPlayer does), `Playlists.tsx`, `PlaylistListEdit.tsx` (navigate to a `/video/` route that does not exist), `Channels.tsx`, `ResponsiveImage.tsx`, `CategorySelect.tsx` (empty file), `utils/extractTextFromSlate.ts`, `App.css` (not imported), `assets/icons/unused/`, most of `styles/fonts/` (only Raleway, Cairo, Cambon Light are referenced by the Classic theme; Mulish, Montserrat and Copse are referenced but never loaded). `filterType === "playlists"` in `getFiles` has no UI.

### Data contract (binding, CLAUDE.md rule 1)

| Service | Identifier | R/W | Shape | Code |
|---|---|---|---|---|
| DOCUMENT | `qshare_file_<slug≤30>_<uid>_metadata` (`slug` = title, lower-case, `[a-z0-9-]`) | R/W | JSON `{ title, version: 1, fullDescription (plain text), htmlDescription (Quill 1 HTML), commentsId: "qshare_file__cm_<uid>", category, subcategory?, subcategory2?, files: [{ filename, identifier, name, service: "FILE", mimetype, size }] }`; QDN metadata `title` (≤50), `description` = `**cat:N;sub:N;sub2:N**` + first 150 chars of text, `tag1: "qshare_file_"`, `filename: "video_metadata.json"` | PublishFile.tsx:168-225, EditFile.tsx:181-240 |
| FILE | `qshare_file_<slug≤30>_<uid>` (one per attached file) | W (R via `/arbitrary/FILE/<name>/<id>` and GET_QDN_RESOURCE_URL) | the file bytes; metadata `title`, `description` as above, `filename`, `tag1` | PublishFile.tsx:182-201 |
| BLOG_COMMENT | `qcomment_v1_qshare_<last 12 of share id>_base_<uid>` and `…_reply_<last 6 of base id>_<uid>` | R/W | raw UTF-8 text, base64 on publish, ≤200 chars | CommentEditor.tsx:203-215, CommentSection.tsx:105-171 |
| THUMBNAIL | `qortal_avatar` per name | R | image, via `/arbitrary/THUMBNAIL/<name>/qortal_avatar` and GET_QDN_RESOURCE_URL | FileList, FileContent, Comment |
| PLAYLIST | `qshare_playlist_…` | R (dead: no UI) | Q-Tube playlist JSON | useFetchFiles.tsx:212, FileContent.tsx:165 |
| Lists | `blockedNames`, `followedNames` | R/W | ADD_LIST_ITEMS / DELETE_LIST_ITEM / GET_LIST_ITEMS | FileList.tsx:46, FollowButton.tsx:49-97, BlockedNamesModal |
| localforage | db `q-share-general` key `general-consent`; db `notification` keys `comments`, `post-comments` | R/W | boolean; comment notification bookkeeping | ConsentModal, CommentEditor |
| localStorage | `qshareplus-ui-theme` (new) | R/W | JSON string theme id | hub-theme |

Searches filter on the metadata description with `description=cat:N;sub:N` (category filter) and on `query=` (title/identifier substring). All of this stays as is. New data is additive only.

### Qortal call inventory

| Call | Where | When | Notes |
|---|---|---|---|
| GET_USER_ACCOUNT, GET_ACCOUNT_NAMES, GET_PRIMARY_NAME | GlobalWrapper:106-115 | mount | 3 hops; fine |
| GET_QDN_RESOURCE_URL avatar | GlobalWrapper:49, useFetchFiles:70, Comment.tsx:203 | own name; per comment card | comment cards: one Hub hop per comment, uncached |
| `/arbitrary/resources/search` (fetch) | useFetchFiles `getFiles` | Home mount, every LazyLoad trigger, Search button | `limit=50`, `mode=ALL`, `identifier=qshare_file_`, `excludeblocked` |
| same, **`limit=0`** | useFetchFiles `getFilesCount`:385 | Home mount (StatsData) | fetches every share ever published to count them |
| same | FileListComponentLevel:52 | profile mount + scroll | `limit=50` by name |
| same, `limit=1` | FileContent `getVideoData`:117 | share page | then FETCH_QDN_RESOURCE |
| same, `limit=20` + **`limit=0`** per comment + one body fetch per comment | CommentSection:105-171 | share page | N+1: 1 + N searches + N + M fetches, all sequential (`await` in a loop) |
| FETCH_QDN_RESOURCE | utils/fetchVideos.ts (via `queue`, 5 at a time) | one per list row not yet in `hashMapFiles` | 50 per page; rows show skeletons until it lands |
| LIST_QDN_RESOURCES **`limit: 0`** | FollowButton:56 | every share page open | lists every publish of the author to show a tooltip size |
| GET_LIST_ITEMS followedNames | FollowButton:49 | every share page | uncached |
| GET_QDN_RESOURCE_STATUS | DownloadWrapper:97 | `setInterval` 5 s per download | never cleared on unmount; `res.localChunkCount` throws if `res` is undefined |
| GET_QDN_RESOURCE_PROPERTIES | FileElement:203 | `setInterval` 7.5 s after DOWNLOADED | never cleared |
| PUBLISH_MULTIPLE_QDN_RESOURCES | MultiplePublishAll | Publish / Update | via `qortalRequestWithTimeout` |
| PUBLISH_QDN_RESOURCE | CommentEditor | comment | |
| ADD_LIST_ITEMS / DELETE_LIST_ITEM | FileList, FollowButton, BlockedNamesModal | click | `DELETE_LIST_ITEM` in FollowButton passes `items` instead of `item` |
| SAVE_FILE | FileElement:126 | click on a READY file | |

**First load of Home (signed in):** 2 searches (one of them unlimited), 4 account/avatar hops, up to 50 FETCH_QDN_RESOURCE, 50 avatar image requests. Nothing is cached between visits, and the same search is re-run whenever `LazyLoad` scrolls into view.

### Performance

- **Chunk:** one 1.19 MB JS file (gzip 370 kB). Inside it: `moment` with all locales (5.2 MB on disk, ~300 kB minified; only `fromNow()` is used), Quill 2 (≈2 MB on disk; needed only when publishing), MUI, react-toastify, dompurify, react-rnd (dead), localforage, redux.
- **Fonts:** 1.4 MB of TTFs (Cairo 353 kB, Raleway 310 kB, Merriweather Sans 267 kB, Catamaran 183 kB, Cambon 123 kB, Karla 89 kB, Proxima 63 kB, Oxygen 46 kB) are all declared in `index.css` and shipped; the Classic theme uses three of them. The kit adds 436 kB of Inter woff2.
- **Images:** category icon webps up to 79 kB shown at 50 px; avatars in every row via `/arbitrary/THUMBNAIL/…` with no `loading="lazy"`.
- **Re-renders:** `StatsData` defines a `styled()` component inside render; `Home` effects depend on the whole `files` array; `useFetchFiles` callbacks depend on `hashMapFiles` so every FETCH result re-creates them.

### UX problems (impact × effort)

- **High/S** Home has no empty or error state: a search with no results or a node error leaves a blank column; all `catch {}` blocks are empty.
- **High/M** Phone (<600 px): the filter column stacks above the list (`Grid xs=12`), rows are a fixed 75 px so long titles clip, the navbar title `Q-Share - Global Public File Sharing` does not fit, the Share modal is 75 % wide with 3 category columns.
- **High/S** Edit/Block actions are only reachable on hover (`IconsBox` opacity 0), so not on touch.
- **Med/S** Copy: filter type is `videos`, tooltip says "Edit video properties", metadata filename is `video_metadata.json` (must stay, it is stored data).
- **Med/S** `PageLoader` covers the whole screen with a spinner on every list fetch.
- **Med/S** Hard-coded colours: 85 hex values outside theme files (Upload-styles ×27 twice, Comments-styles, FileContent `#333333` description box, Navbar `#ACB6BF`/`#e35050`, BlockIconContainer `#fbfbfb`), so Black and White themes show the wrong surfaces.
- **Med/S** Accessibility: icon-only controls without `aria-label` (Edit, Block, Search, Remove), clickable `Box`es instead of buttons, no visible focus.
- **Low/S** Consent dialog marks itself accepted before the user closes it.

### Bugs

- `useFetchFiles.checkAndUpdateFile` (line 60): `(!existingVideo?.updated || video?.updated) > existingVideo?.updated` compares a boolean; updated shares are never re-fetched.
- `CommentEditor.handleSubmit` (line 233): `removeBaseCommentId.replace("_base_", "")` result is discarded (harmless because only the last 6 chars are used, but the intent is lost).
- `FollowButton.unfollowName` (line 88): `DELETE_LIST_ITEM` is sent `items: [name]`; the action expects `item`, so unfollow may not work.
- `DownloadWrapper.performDownload` (line 94): the 5 s interval is never cleared on unmount or when `GET_QDN_RESOURCE_STATUS` throws; `res.localChunkCount` on an undefined `res` throws inside the interval.
- `FileElement.refetchInInterval` (line 204): interval never cleared; a component that unmounts keeps calling GET_QDN_RESOURCE_PROPERTIES every 7.5 s.
- `CommentSection` (line 235): "Load more" appears when `listComments.length > 20` counting replies, so a share with 15 comments and 10 replies shows the button and loads a page that is already loaded.
- `FileList`/`FileContent`: names are put into paths and `qortal://` links unencoded; a name with a space or `+` breaks navigation. `CopyLinkButton` always links to `Q-Share`, not the running app.
- `DisplayHtml.convertQortalLinks` wrote `className=` into raw HTML (fixed on this branch).
- `EditFile` says "File must be under 400mb" while the limit is 2 GB.
- `PublishFile`: `isOpen` modal has no `onClose`, so Escape and backdrop clicks do nothing.
- `Notification` calls `toast()` and dispatches during render.

### Missing features

1. **Copy share link** everywhere (rows and profile), pointing at the running app (`Q-Share+`) with encoded names.
2. **Sort** newest/oldest (search `reverse`) and **my shares** (search by own name).
3. **Previews**: images, audio and video attachments inline via `GET_QDN_RESOURCE_URL` before download; PDF/text later.
4. **Upload progress**: `PUBLISH_MULTIPLE_QDN_RESOURCES` gives no per-file progress; the modal shows per-resource done/failed only. Real progress needs one publish per file; defer. *(Corrected by the Hub Dev Mode check: Hub does post `PUBLISH_STATUS` messages with chunks per resource into the app frame, and the dialog now shows them.)*
5. **Collections**: the PLAYLIST code exists but is Q-Tube's; a Q-Share collection would be a new `qshare_collection_` DOCUMENT. Defer to a later pass.

### Quill 1 → 2 compatibility (done)

Quill 2 stores every list as `<ol><li data-list>`, code blocks as `div.ql-code-block-container`, and `&nbsp;` for spaces; `getSemanticHTML()` in 2.0.3 drops code-block text. `utils/quillHtml.ts` normalises the raw editor markup to the Quill 1 shape on publish and before display; 16 tests including a round trip through the real Quill 2 build.

## Plan

Pass 1, in commit order:

1. ✅ Platform upgrade (React 19.3, MUI 9.4, Vite 8, TS 5.9), react-quill-new with the Quill 1 storage format.
2. ✅ Test harness with `qortalRequest` and `fetch` mocks.
3. ✅ Theme kit, four themes, Settings page, version and changelog. **Checkpoint: PR #7.**
4. Efficiency: remove the three unlimited searches (stats moved to Settings on demand with a 1 h cache; follow size loaded only when the tooltip opens; replies fetched with one prefix search per share), a shared search helper that merges in-flight duplicates and caches for the session, avatars in comments by URL instead of a Hub hop, page size 20, and download polling that stops on unmount and while the tab is hidden.
5. Bundle: replace `moment` with a small relative-time helper, load the Quill editor only when the Share/Edit dialog opens, lazy routes.
6. UX: Hub 3.0 layout (sticky header, centred column, filters in a drawer on phones), empty/loading/error states, touch-reachable row actions with labels, theme-driven colours in the remaining components.
7. Features: copy link with the running app's name, sort order, my shares, inline image/audio/video preview.
8. Fix the bugs listed above where touched (checkAndUpdateFile, unfollow, intervals, load-more count, name encoding).

Deferred: removing the dead Q-Tube player/playlist code (kept, unreachable), trimming the unused TTF fonts (Classic theme fidelity vs 1.2 MB), upload progress per file, collections, moving to qapp-core.

### Pass 2 plan (2026-09-30)

Areas run in parallel by separate agents on disjoint files; the lead integrates:

1. **Publish flow** (PublishFile, EditFile, MultiplePublish, CategoryList, TextEditor, new `utils/publishPayload.ts`): pure payload builder pinned by tests to the original format; drag-and-drop list with type icons, sizes, total, remove; a publishing modal with step progress (n of N resources), retry of failures, dispatch `markSharesChanged` on success.
2. **Share page** (FileContent, FileElement, FilePreview, DownloadTaskManager, DownloadWrapper, Comments, FollowButton, CopyLinkButton): PDF and text previews on click, image lightbox, Download all, file rows with kind icons and status, comment states, hidden-names filter, a11y.
3. **Collections** (new `qshare_collection_` DOCUMENT, additive): `utils/collections.ts` with tests, Redux slice, Collections page, collection page, `SaveToCollectionButton` for rows and share pages, create/edit dialogs.
4. **Shell** (layout, GlobalWrapper, Notification, ConsentModal, PageLoader, BlockedNamesModal, index.css, App/main, package.json): phone bottom nav, header that hides on scroll, dead Q-Tube player/playlist code and react-rnd removed, toast fix, consent fix, route wiring for collections.
5. **Lead**: settings store, Following feed, hidden names, lazy avatars (done); wiring collections into rows; first-load search counts; review workflow on the diff; lint pass; version and changelog; brief and PR.

## Done

Pass 1 on branch `q-share-plus/pass-1`, PR #7 (2026-09-29/30). Every commit builds; 26 tests; `scripts/build-zip.sh Q-Share+` produces the zip.

| | Baseline | After pass 1 |
|---|---|---|
| Stack | React 18.2, MUI 5.11, RTK 1.9, react-redux 8, Vite 4, TS 5.0, react-quill 2 | React 19.3, MUI 9.4, RTK 2.13, react-redux 9.3, Router 6.30 (v7 flags), Vite 8, TS 5.9, react-quill-new 3.8 |
| tsc errors | 0 | 0 (10 after MUI 9, fixed) |
| Tests | 0 | 26 (Quill compat incl. real Quill 2 round trip, search helper, comment thread, Home first load, time) |
| Searches on first load of Home | 2, one unlimited (`limit=0` over every share) | 1, paged (`limit=20`) |
| FETCH_QDN_RESOURCE per Home page | 50 | 20 |
| Comment thread with N comments, M replies | 1 + N searches (N unlimited) + N + M body fetches, sequential | 2 searches + N + M body fetches, 5 at a time, cached |
| Hub hops for comment avatars | 1 per comment | 0 (URL) |
| `limit: 0` / unlimited calls | 3 | 0 (stats and follow size page in chunks of 100, capped, on demand) |
| Polling loops that never stop | 2 | 0 |
| Biggest JS chunk | 1,123 kB (gzip 345 kB) | 415 kB (gzip 129 kB); Quill 206 kB and the share page 178 kB load on demand |
| Fonts shipped | 1.4 MB TTF (8 families) | 0.8 MB TTF (Cambon, Raleway, Cairo for Classic) + 436 kB Inter woff2 |
| Themes | light/dark switch that was never wired | Hub 3.0, Q-Share Classic, Black, White; boot snippet; Settings page |

What changed, per commit: toolchain → React 18.3/RTK 2/Router → react-quill-new + `utils/quillHtml.ts` → React 19.3 + MUI 5.18 → MUI 9.4 → test harness → theme kit + Settings (checkpoint) → search helper + no unlimited searches → download polling → bundle (moment out, lazy Quill and routes) → Hub 3.0 layout, states, previews, colours.

Bugs fixed on the way: `checkAndUpdateFile` boolean comparison, unfollow `item`, intervals never cleared, Load-more count including replies, names unencoded in paths and links, `className=` in generated HTML, Update dialog size message, dialogs that could not be closed, empty description accepted, the stats `styled()` inside render.

Not done in this pass: a right rail (nothing to put in it yet), a bottom navigation bar (the app has two destinations; the sticky header covers it), i18n (upstream has none), lint (baseline 58 errors / 256 warnings on the old eslint 8 config; untouched).

### Pass 2 (2026-09-30)

Same branch and PR, Round 2 of `1.0.0`. Every commit builds, `npm run lint` and the 106 tests pass, and `scripts/build-zip.sh Q-Share+` writes a 1.4 MB zip.

| | After pass 1 | After pass 2 |
|---|---|---|
| Tests | 26 | 106 (publish payload pinned to the original format, collection format, share draft, Home first load and sort, share page, bottom bar, consent, error boundary, previews, settings, save to collection) |
| Lint | 58 errors / 256 warnings on the old eslint 8 config, not run | 0 / 0 on ESLint 9 + typescript-eslint 8 + react-hooks 7 (React Compiler rules) |
| Biggest JS chunk | 415 kB (gzip 129 kB) | 265 kB (gzip 85 kB) |
| JS + CSS on first load | 831 kB (gzip 261 kB) | 777 kB (gzip 250 kB), with collections, previews and the phone shell included |
| Home first load, signed in (harness, 20 rows) | 1 search + 20 FETCH | 1 search + 20 FETCH for the list; the signed-in name's collections (1 search + 1 FETCH per collection) 1.5 s later, once per session |
| Share page, cold | 1 search + 1 FETCH, then 2 searches for comments | same; a share already in the store opens with 0 calls |
| Profile | 1 search + N FETCH | same, plus 1 GET_LIST_ITEMS for the follow state |
| Collection page | n/a | 0 searches: 1 FETCH for the collection + 1 per item |
| Collections page | n/a | 1 paged search |
| Settings | 0 searches | 0 searches (statistics on demand) |
| Phones | Filters button below 900 px | bottom bar, floating Share, header that hides on scroll, sheets, full-screen dialogs, pull-to-refresh, 44 px targets, safe-area insets, landscape phones |
| Dependencies removed | moment, react-quill, quill-image-resize-module-react | react-rnd, compressorjs, ts-key-enum; the unreachable Q-Tube player and playlist code deleted |

What changed, per area:

- **Publish flow** (`components/PublishFile`, `EditFile`, `MultiplePublish`, `utils/publishPayload.ts`): a pure payload builder pinned by tests to the original resource shapes (FILE `qshare_file_<slug30>_<uid>`, DOCUMENT `…_metadata`, `video_metadata.json`, `**cat:N;sub:N**` description, `tag1`); drag and drop or tap to choose with type icons, sizes, a running total and remove; step-by-step publish progress with retry for failed resources; a draft that survives closing the dialog; full-screen on phones with Publish kept above the keyboard through `visualViewport`; the picker uses the plain input (no File System Access API) so it works in GO.
- **Share page** (`pages/FileContent`, `FileElement`, `FilePreview`, `DownloadTaskManager`, `DownloadWrapper`): keyed by name/id; one search + one fetch cold, none warm; previews for PDF (iframe), text, image (lightbox), audio and video on demand, automatic image previews up to 5 MB (a setting); Fetch all files; big Download buttons; a collapsible description; a Back button and a sticky sub-header on phones; the downloads list as a bottom sheet with Clear finished; a poller that gives up leaves the row on Retry.
- **Collections** (`utils/collections.ts`, `state/features/collectionsSlice.ts`, `pages/Collections`, `components/common/SaveToCollection`): new additive data, DOCUMENT `qshare_collection_<slug30>_<uid6>` with `{version, title, description, items:[{name, identifier}], created, updated}`, `tag1 qshare_collection_`, filename `collection.json`; the original app never matches it (it searches `qshare_file_`). Collections page (Mine / All, paged), a page per collection with edit, remove and delete (a republish, so Hub confirms), a bookmark button on every row and share page; the signed-in name's collections load once per session, paged and capped at 100, after the page's own data.
- **Shell** (`components/layout/BottomNav`, `Navbar`, `common/mobile`, `wrappers/GlobalWrapper`, `utils/hubFrame.ts`): bottom bar with four items and a badge for downloads, floating Share button, header that hides on scroll and returns on focus, `ResponsiveDialog` and `BottomSheet` primitives, frame height from Hub's iframe instead of `100vh`, an error boundary, reduced motion honoured, the phone layout also on landscape phones (`PHONE_MEDIA`: under 600 px, or a touch screen under 500 px tall).
- **Home and Settings**: Following feed through the Core's `followedonly` search, My shares, hidden names (applied on Home, comments and collection pages), default sort, lazy avatars, a refresh after publish or edit, pull-to-refresh, filters and sort in a bottom sheet; a reset search always starts and supersedes the one in flight, so tapping Oldest while a page loads no longer leaves the list on Newest.
- **Review fixes** (one read-only review of the diff, findings verified before fixing): Collections' New button reachable on phones, pull-to-refresh ignored inside dialogs and sheets and decided outside a state updater, hidden names on collection pages, stuck download rows, keyed collection and profile pages against stale responses, route params decoded safely, `vh` replaced by the frame height in previews, viewport listeners only while a phone dialog is open, per-row dialogs mounted on first use.
- **Quality**: ESLint 9 flat config with the React hooks rules (refs, immutability, set-state-in-effect) and `npm run lint` clean; 106 tests; a screenshot harness (`e2e/screens.mjs`) that serves the production build with mocked `qortalRequest` and Core endpoints, pre-accepts the welcome notice, emulates `hover: none` and `pointer: coarse` on phone viewports, and reports console errors, sideways overflow, unlabelled buttons, small targets and Qortal call counts per screen.

#### Mobile check (DESIGN.md → Mobile → Check), 2026-09-30

Run with `node e2e/screens.mjs` against the release build of round 2 (commit `e9eaf95`), which serves `dist/` with `vite preview`, mocks `qortalRequest` and the Core search/resource endpoints (24 shares, 3 publishers, a 4-file share with image, text, PDF and audio, a comment thread with a reply, two collections), pre-accepts the welcome notice, and emulates a touch screen on the phone sizes (`hover: none`, `pointer: coarse`, reduced motion). No node was involved and nothing was published.

- **Screens:** Home, the Filters sheet, a share page, a profile, Settings, Collections, a collection, the Share files dialog, the account menu.
- **Sizes:** 360×740, 390×844, 844×390 (phone landscape: top and scrolled shots), 700 (narrow Hub) and 1280.
- **Themes:** Hub 3.0, Q-Share Classic, Black and White in Hub's dark mode (196 captures), plus Hub 3.0 and Classic in Hub's light mode for Home, filters, share, publish, Settings and a collection (64 captures). 260 captures in all.
- **Automated checks, every capture:** 0 console errors, 0 sideways overflow, 0 buttons without an accessible name. Buttons under 40 px on the phone sizes: 0 on Home, share, profile, publish and the sheets; 1 on Settings and the collection pages (the publisher link in a card, 36 px tall; fixed after this run). Text under 13 px: only MUI helper captions and counters (e.g. "0/180", "Separate several names with commas").
- **Qortal calls on first load (signed in):** Home 2 searches (the list, then the name's collections) + 20 share bodies + 1 collection body; a share 4 searches (share, comment bases, replies, collections) + 2 fetches; a profile 2 searches + 8 bodies + 1 list read; a collection 1 search + 3 fetches; Settings none.
- **Looked at by eye** (phone sizes in all four themes, the rest in Hub 3.0 and Classic): one column everywhere, no sideways scroll; the bottom bar with four items and the floating Share button on every phone screen, including landscape; the header slides away on scroll and the sub-page headers (Back + title) stay; rows wrap as title line then publisher and 44 px actions; the Filters and account sheets open from the bottom; the Share files dialog is full-screen with the file picker, title, category, the nine-button editor toolbar and Cancel/Publish visible; previews and the big Download buttons on the share page; Classic keeps filled primary buttons in dark and light.
- **Found and fixed by this check:** the welcome notice and the share route in the harness itself; rows wrapping differently for own and others' shares; the collection page's remove button taking half the row; duplicate Downloads and Share buttons in the phone header; the 20-button editor toolbar on phones; the desktop layout on a phone held sideways; a tiny image stretched to full width; Classic's contained buttons with no fill and its white "primary" in light mode; the Collections page's New button hidden under the bottom bar (from the review).
- **Not covered here, for Simon's Hub Dev Mode session:** the on-screen keyboard (the Publish button follows `visualViewport`, which Playwright does not drive), pull-to-refresh with a finger, the file picker inside GO, safe-area insets on a notched phone, and Hub's own light/dark switch at runtime.

### Pass 3 (2026-09-30, later the same day)

Same branch and PR, Round 3 of `1.0.0`. Every commit builds, lint is clean and the 122 tests pass. Hub itself could not be reached from the cloud session (the debug port is on Simon's desktop), so the Hub Dev Mode checks stay on the list below.

- **Settings sync** (`utils/settingsQdn.ts`, Settings → Sync): after Torq's `settingsQdn.ts`, adapted for an app without qapp-core's identifier hashing: the settings and the theme go into one DOCUMENT `qshareplus_settings` under the user's name, read back tolerantly (object, JSON or base64 JSON; unknown fields dropped, missing ones defaulted, unknown themes ignored). Save and Restore are explicit buttons, so first load costs no extra call. Additive data with its own identifier.
- **Save all as .zip** (`utils/zip.ts`, `components/common/SaveAllZipButton.tsx`): a store-only ZIP writer with CRC-32, UTF-8 names and unique names, no dependency; the button appears for shares with two or more files under 150 MB (built in memory) and is enabled once every file is on the node.
- **Small features**: Save on ready files in the downloads list (one routine, `saveFromNode`, shared with the file rows); Edit share on your own share page; a Collections tab on profile pages that loads only when opened (one paged search for that name); the publish dialog shows the total size and the time elapsed.
- **Why not per-file upload progress**: Hub answers `PUBLISH_MULTIPLE_QDN_RESOURCES` only when the whole batch is done and reports no bytes; one `PUBLISH_QDN_RESOURCE` per file would give per-file status but one Hub confirmation per file, which is worse for a ten-file share. The batch stays; the dialog shows size and elapsed time instead. *(Corrected by the Hub Dev Mode check: Hub posts `PUBLISH_STATUS` with chunks, retries and processing per resource while it works, which the dialog now shows per file.)*
- **Accessibility audit**: `e2e/screens.mjs` now injects axe-core (dev dependency) into every capture and lists the rules violated (WCAG 2.1 A/AA and best practices). Fixed from its findings:
  - Structure: a `main` landmark, one banner per page, an h1 on every page, the Share button inside the bottom bar's `nav`, named bottom sheets and account popover, the account menu as a real menu, named Quill pickers.
  - Contrast, in the app: Classic dark blue #007FFF → #4DA6FF (3.4 → 5:1 on its purple paper, original kept as the dark shade); Classic light #417Ed4 → #2f63b0 and 72% ink for inactive toggles; a filled Delete button on collection pages.
  - Contrast, in the shared kit (`Repo:` commits, synced): MUI `contrastThreshold` 4.5; Black theme black text on the X blue and secondary text #8b9096; Hub 3.0 light primary text and outlines #2A56A5, secondary text #4A525E and 72% ink for inactive controls (filled buttons keep the soft Hub gradient; dark mode unchanged).
- **Record** (release build of this pass, same harness as pass 2): 9 screens × 360×740, 390×844, 844×390, 700, 1280 in all four themes in dark mode (172 captures), plus Hub 3.0 and Classic in light mode for Home, filters, share, publish, Settings and a collection (56 captures). Every capture: 0 console errors, 0 sideways overflow, 0 unlabelled buttons, **0 axe violations**.

### Hub Dev Mode check (2026-09-30)

Same branch and PR, Round 4 of `1.0.0`. A local session drove a second Hub instance (GO 3.0 build, `qortal-hub/3.0.3`, Electron 32 / Chromium 128) over its debug port, signed in as **Tester GO** with Dev Mode on, against the Vite dev server through the node's dev proxy (127.0.0.1:12393) and the local Core 6.1.9. Nothing was published, no settings were saved to QDN and no QORT was spent. The only writes were saves to disk through Hub's own prompt (a 55 KB PDF, a 158 KB zip; one more save left a native Save As dialog open, see below) and one hidden name added and removed again in Settings (local only).

**How it was driven.** `scripts/hub-cdp.mjs` plus session helpers in the scratchpad (not in the repo): an emulated viewport held on the Hub window (Electron has no window-bounds call and the window was minimised), `pointer: coarse` / `hover: none` and touch emulated on the app's out-of-process frame, taps and swipes sent to the frame target (sending them to the page target applies the frame offset twice), every `qortalRequest` logged by wrapping q-apps.js's `executeQortalRequestImmediate` on each new document, and the frame's resource timings read for `/arbitrary` calls. Real data was found with read-only GETs on the node: shares with image, PDF, text, audio, video, multi-file and odd attachments, names with spaces, `+`, `/` and non-ASCII letters, comment threads, deleted and unreachable shares.

**Screens:** Home (Latest, Following, My shares, Newest/Oldest, title search, publisher, category), share pages (image, PDF, text, audio, video, a four-file share with Fetch all and Save all as .zip, a 7 + 4 comment thread, a deleted share, a share keyed by `commentsId`), profiles (including `Qort Darlood ΑΩ`, with the Collections tab), Collections (Mine and All), Settings (all four themes, Restore, network statistics; Save to QDN not pressed), the downloads list, the account menu, Blocked names, the Share files dialog (nothing published) and Hub's own light/dark switch.

**Sizes:** 1440 (desktop), 700 (narrow Hub, mouse), and 390×844, 360×740, 844×390 with touch. Four themes in Hub dark and light on Settings, Home and a share page; Hub 3.0 elsewhere. After the fixes, seven screens at all five sizes: no sideways overflow, no tap target under 40 px on touch, no text under 12 px, no clipped text, no console errors (the Vite HMR websocket error is the dev proxy's and harmless).

**Calls measured (signed in):** Home first load 1 search (`qshare_file_`, limit 20, now with metadata so titles show at once) + 20 body fetches + the name's collections search + one avatar per publisher. A share already in the store opens with no share calls and 2 comment searches (3 when the JSON has a `commentsId`); cold, 1 search + 1 fetch more. A profile 1 search + only the bodies not held. Settings none. Share statistics stop at their 3,000 cap (30 paged searches): the network holds **9,406** shares today.

**Found in Hub and fixed**, one commit each:

- *Theme:* Hub posts `THEME_CHANGED` into the app when its own light/dark switch flips and never reloads the app; the kit read the mode once, so the app stayed dark (`Repo:` kit commit, synced).
- *Security:* the `qortal://` linkifier ran a regex over sanitised HTML, so a share description could inject an event handler (stored XSS, from upstream). Links are now built on the DOM; relative and same-origin links, `<style>`, forms and image maps are dropped; `position: fixed` content is contained; DOMPurify 3.0.6 → 3.4.16 (two published mXSS advisories).
- *Deep links:* Copy link wrote `Q-Share%2B`, which Hub never decodes, so links opened a blank app. Links now use the literal `+`, and the router also accepts the encoded spelling (see Follow-up 1). In Dev Mode Copy link now points at Q-Share+, not the original app.
- *PDF preview:* the inline frame was always blank (the Electron main window has no `plugins: true`; GO's WebView has no PDF viewer). "Open PDF" now uses Hub's `SHOW_PDF_READER` (checked: Hub's pdf.js viewer opens with EXIT), after the file is on the node, up to 100 MB.
- *Home rows:* a share whose JSON can't be fetched stayed a blank skeleton forever (Software, Newest, row 3). Rows now show the search's title and date at once and say "Not available on your node right now" after three tries; deleted shares (a `"D"` body) leave the lists.
- *Phones:* `html, body { overflow-x: hidden }` made `body` a scroll container, so the sticky header and Back bars scrolled away (`overflow-x: clip` now). Every row's Save-to-collection sheet stayed mounted (MUI's SwipeableDrawer forces `keepMounted`): 458 of 2,020 DOM nodes on one page of Home; sheets now mount when first opened (Home page 1: 944 nodes). The floating Share button covered the end of "Submit comment"; toasts sat on it. In landscape the frame is 266 px tall in Hub: the bar is now 52 px with Share in it and no floating button.
- *Share page:* four stacked full-width buttons pushed the files below the fold on phones; they are one compact row now (Copy link, Collect, Follow), the duplicate "Fetch file" is gone for one-file shares, and the collection button reads "Add to collection" instead of a second "Save". Shares not on the node yet wait for peers (2/4/8/16 s) instead of "check that your node is running"; a deleted share says so; an error page offers Retry.
- *Saves:* declining Hub's save prompt showed a red error. Saves stream from the node by `location` in GO and for files over 100 MB (on desktop Hub that adds a native Save As dialog, so smaller files keep the one-step blob save). Files whose chunks finish after the page closes are now built by the poller.
- *Copy and labels:* the empty "My shares" said "No shares match these filters"; "My shares" couldn't be turned off; a category-only filter didn't count as a filter; the idle Downloads icon was a check mark; Blocked names mentioned a menu that doesn't exist.
- *Descriptions and editor:* inline white text (39 spans in 476 sampled descriptions) was invisible in light themes; colours are dropped on display (the original app still shows them) and the editor no longer offers or pastes colours. Web links, which q-apps.js blocks, now copy their URL with a note.
- *From the audit of Hub's source* (verified before fixing): publish waited 30 s per resource while Hub allows 30 min, and "Retry failed" could publish (and pay) twice — the budget matches Hub's and a timeout checks QDN first; Hub's `PUBLISH_STATUS` progress is shown per file; declines are recognised in all 12 Hub languages; Back used `window.history`, which all Hub tabs share; comments keyed by the share's `commentsId` were never shown (the publisher's own note on Native's BH 2587001 share now appears); names with `/` fetch their JSON encoded; the account request retries after Hub's 30 s timeout, with a Sign in button if it still fails; Follow reads the followed list only when signed in and re-reads it after a Hub timeout.

**Deep link (Follow-up 1), exact result.** Q-Share+ is not published on this node, so the test used the published app `POS+` (READY here). `qortal://APP/POS%2B/share/Simon%20James/qshare_file_readme_dKkJD1_metadata` opens a tab titled "POS%2B" whose frame loads `/render/APP/POS%2B/share/…`; Core injects `_qdnBase = "/render/APP/POS+"`, so `location.pathname` doesn't start with the basename and a React Router app renders nothing. `qortal://APP/POS+/share/…` opens a tab "POS+" at `/render/APP/POS+/share/…` and matches. Hub's `extractComponents` keeps the name exactly as typed. Q-Share+ now writes `qortal://APP/Q-Share+/share/<encoded name>/<encoded id>` (spaces as `%20`, as Hub's own Copy link does) and accepts the `%2B` spelling too.

- *From the final review of the whole diff* (24 of 39 findings confirmed, all fixed): a share's JSON could override the publisher name and identifier the app shows, and bodies were cached by identifier alone, so another name publishing under the same identifier could stand in for a share — the search row's fields now win and cached bodies are matched by name too; Home lost its query (Following, sort, category) when it mounted again after Back and paged a different list under the old rows; a failed next page wiped the list; "Retry missing" was offered for files Hub had queued but not answered yet (a second fee); editing an old share dropped embedded images; updates compared against the device clock; the "Publish again?" guard was lost when Edit closed; the phone sub-headers slid under the returning header; landscape toasts could leave the screen; Home's phone controls were 40 px; the Collect button's name didn't contain its visible text; hidden names had no real Unhide button; downloads, saves, collection pages and Settings restore now also encode names q-apps.js breaks.

**How the fixes were made.** A scout workflow found test data on the node and audited the app against Hub's and Core's source (37 findings, 34 confirmed by independent verifiers). Eight agents then fixed disjoint groups of files in parallel worktrees, each group was reviewed and its review findings applied, and the lead cherry-picked the commits, resolved the overlaps (the share page kept one state machine for deleted, unavailable and error-page shares) and re-tested in Hub. A final six-dimension review of the whole diff found 24 more issues, fixed the same way by five agents. Every commit was typechecked and tested on its own. 399 tests (122 at pass 3), lint clean, `scripts/sync-theme.sh --check` clean; after the fixes the seven-screen sweep at all five sizes was clean again, and Following, category filters, sub-headers, landscape toasts, Unhide and the Collect button were re-checked in Hub.

**Needs a phone (GO):** the on-screen keyboard under Publish (GO's adjustResize WebView), pull-to-refresh with a finger (works with emulated touch here), the file picker (Capacitor's `onShowFileChooser`), `SHOW_PDF_READER` and `SAVE_FILE` by location in GO (its native download card), safe-area insets, and landscape on a real phone.

### Simon's requests after trying round 4 (2026-09-30)

Round 5 of `1.0.0`, same branch. Built by three agents in parallel worktrees (header, search, grid), each reviewed with its review findings applied, then integrated and checked in Hub Dev Mode at 1440, 700, 390×844, 360×740 and 844×390 (no overflow, no small targets, no clipped text on the seven main screens, in grid view).

- **Publisher suggestions:** the publisher filter is a combobox modelled on Torq's user search. It queries Core's `/names/search` directly (prefix limit 20 and contains limit 40, `URLSearchParams`-encoded because q-apps.js's `SEARCH_NAMES` doesn't encode, debounced 220 ms, cached per query for the session, superseded answers ignored), ranks exact and prefix matches and names already publishing in the list first, and shows avatars and the matched part. Picking a name applies the filter; in the phone sheet it also closes the sheet. Checked in Hub: "Simon" lists Simon, Simon Dixon, Simon James… with avatars, 2 name searches per query; picking Simon James runs one search. Found in Hub and fixed: in the phone sheet the list opened ~250 px below the frame (absolute Popper in a frame whose body is taller than the viewport); it now uses fixed positioning.
- **My shares for all names:** an account with several names gets "All my names" next to My shares, one search with repeated `name=` parameters (Core accepts them; `exactmatchnames` kept). Tester GO has one name, so this was checked by tests only.
- **Account menu avatars:** every name in the switcher shows its avatar, fetched only when the menu opens and only for visible rows (MUI's Avatar preloads its `src` whatever `loading` says, so the menu uses its own in-view image), with the initial as a fallback.
- **Header:** the header's content sits in Home's 1200 px column, so the logo lines up with the filters and the buttons end at the list's right edge; "Public file sharing on Qortal" sits beside the title and hides where it doesn't fit whole (at 700 px signed in, for example). The header stays 56 px.
- **Grid view:** a `listView` setting (list by default; in the Settings sync snapshot) with a List/Grid toggle on Home, profile Shares and collection pages and a Layout choice in Settings → Appearance (DESIGN.md puts grid/list there). Cards: category art, title (two lines), file count · size · age, publisher, and the row actions (visible on touch, on hover or focus on desktop); every row state kept (pending, unavailable, deleted in collections); two columns on phones, one below 350 px. No extra Qortal calls.
- 463 tests, lint clean.

### Name search for accounts with many names (2026-09-30)

Round 6 of `1.0.0`, same branch. Simon asked for a search in the name switcher once an account has more than 15 names, and for Settings to work the same way with avatars.

- **One switcher** (`components/common/NameSwitcher.tsx`) serves the account menu and Settings → Account ("Switch name" opens it in a dialog on desktop, a bottom sheet on phones; it replaced a plain `Select`). Up to 15 names: the account's order, the active one scrolled into view. Above 15: a search field (autofocused on desktop only), the active name first and the rest A to Z; matching folds case and accents per character (so "jose" finds and highlights "José"), prefix matches first. ↓ enters the list, ↑ from the first row returns to the field, Enter picks the first match (not while an IME is composing), Escape clears then closes; a polite live region reads the match count. The order is fixed per open, so a pick doesn't reshuffle the list while it fades out.
- **Avatars:** every row uses `NameAvatar` (moved out of Navbar): a plain `<img>` requested only when the row scrolls into view, with a per-session record of names that have none. The fallback letter is drawn by CSS from `data-letter`, so MenuList's type-to-jump sees only the name.
- **Account menu:** ↑/↓ cross between the names and Blocked names/Settings, wrapping. List heights: at least two rows on desktop; in phone sheets the list leaves room in the 85dvh sheet for the title, field and the rows below.
- **Hub check** with 25 simulated names (the app's own Redux store, real publisher names so avatars show; reloaded afterwards to restore Tester GO): desktop menu focused the field, 7 avatar requests for the visible rows only, "andi" found and highlighted "äNDi", arrow keys walked names → Blocked names → Settings and back; 12 names with the active one last opened scrolled to it; phone sheet at 390×844 has a 44 px field and 44 px rows with the footer on screen; 844×390 keeps two name rows and the sheet scrolls; Settings dialog and sheet match. No new console errors. Switching to a name the account doesn't really own was only checked with the simulation, which reads but never writes.
- A review pass (11 confirmed findings) is applied in ad339f8, 2b4cec1 and 4413f2d. 483 tests, lint clean.

### Branch history cleaned (2026-10-01)

With Simon's one-off OK, the branch was rewritten and force-pushed twice before merging; nothing else may force-push it.

1. **Commit messages** (e8099d2 → fc3f5ab): Claude attribution dropped from the 182 messages, 178 `Co-Authored-By: Claude` trailers and 59 `Claude-Session` links. Every commit kept its files, author, dates and order. The 61 commits the cloud session had signed lost their signatures.
2. **Stray screenshots** (5905ff4 → 7ddf443): the 172 harness PNGs (`e2e/shots-old/`) that one commit added by mistake are gone from the history. Only that commit (now `685cdf8`) changed, by exactly those files; the next one, which had deleted them, now only widens the ignore rule and says so (`972f801`). Every other commit kept its files and message.

Both runs verified each rebuilt commit against the original and found no difference between the old and new tips. Only hashes changed; the ones quoted in this brief are current.

## Follow-ups

Questions for Simon (after pass 2):

1. **Deep link with `+`:** answered by the Hub Dev Mode check: `%2B` opens a blank tab named "Q-Share%2B", the literal `+` works. Links now use `+`, and the router accepts both spellings. Now that Q-Share+ is published, copy a share link and open it from Hub's address bar and from a chat message to confirm on the real app.
2. **Quill round trip in Hub:** publish a share from Q-Share+ with bullets, a numbered list and a code block, open it in the original Q-Share; then open an old share with formatting in Q-Share+. The jsdom round trip passes; this is the real check. Still open: it publishes, so it waits for your go-ahead (the Hub session reached the Share dialog and stopped there).
3. **Screenshots in the branch history:** done. The harness PNGs committed by mistake are gone from the history (Branch history cleaned, above).
4. **Phone header:** on phones the header no longer shows the Share and Downloads buttons, since the floating button and the bottom bar provide both. Keep it that way, or bring one back?
5. **Collections in "All":** the Collections page lists every name's collections under the All tab (one paged search on `qshare_collection_`). Keep it public like that, or show only your own and the ones you open by link?
6. **Welcome notice on phones:** it can only be closed with *I understand*, so the full-screen dialog shows no Back arrow. Keep, or let Back dismiss it for the visit?
7. **Classic theme fonts:** Cambon Light, Raleway and Cairo stay (0.8 MB) for fidelity. Drop them and let Classic use Inter?
8. **Fetch all files:** starts every file of a share through the 5-slot request queue. On a slow node a share with 10 large files will keep the queue busy for a while; cap it lower, or leave it? (In Hub, a four-file share of 158 KB not yet on the node took about 70 s, with 19 status polls.)

9. **Colour changes for 4.5:1 contrast** (pass 3): Classic's electric blue is one step lighter in dark mode and deeper in light mode, and the shared kit's Hub 3.0 light mode uses a deeper blue for text and outlines. Each is one line in `src/styles/theme.tsx` or `shared/hub-theme/tokens.ts` if you prefer the original shades over the contrast target.
10. **Settings sync** is manual (Save / Restore on the Settings page). Say if you want an automatic restore on first sign-in on a new device (one FETCH per session).

Questions from the Hub Dev Mode check:

11. **Colours in descriptions:** inline text and highlight colours are now dropped on display, and the editor no longer writes them, because white text pasted from dark pages is invisible in the light themes. Deliberate colours (some shares use red or orange highlights) go too; the stored data and the original Q-Share are unchanged. Keep, or keep colours only in the dark themes?
12. **Public nodes:** Hub refuses every list request (`GET/ADD/DELETE_LIST_ITEMS`) when it runs on a public node (Hub `get.ts` `getListItems` → "no action public node"), so Follow, Block and the Following feed can't work for GO users on the default public node. Hide them there (after the first such answer), or explain it in place?
13. **Saves on desktop Hub:** a save by `location` shows Hub's prompt and then a native Save As dialog. Files under 100 MB keep the one-step blob save (straight to Downloads); GO always saves by location. Move the threshold, or always ask where to save?
14. **Network statistics:** the network holds 9,406 shares (30 September), past the 3,000 cap, so the figure reads "3000+". Counting all of them is about 95 paged searches. Raise the cap, or show a different figure (e.g. shares this month)?

Next pass ideas:

- A GO session on a phone for what Hub on the desktop can't show: the on-screen keyboard under Publish, pull-to-refresh by finger, the file picker, `SHOW_PDF_READER` and saves by location with GO's download card, safe-area insets, landscape.
- Names containing `/`, `#`, `?`, `%` or `\` (one real share today, by "Vallot-/8/"): their JSON is now fetched encoded, but downloads still go through q-apps.js's `GET_QDN_RESOURCE_STATUS`/`PROPERTIES`, which build the URL with the raw name. Direct GETs to `/arbitrary/resource/status|properties/…` with the name encoded would fix them.
- The screenshot harness now runs on the shared runner: `scripts/screens.mjs Q-Share+` with `e2e/screens.config.mjs` (2026-10-01: 43 captures in Hub 3.0 at all five sizes, 0 console errors, 0 overflow, 0 unlabelled buttons, 0 axe violations, using playwright-core and the desktop's Brave). Run all four themes before the next release.
- `useFetchFiles`' `getNewFiles`, `checkNewFiles` and `getFilesFiltered` have no callers (upstream leftovers); `CollectionPage` still subscribes to the whole `hashMapFiles`.
- Some publishers' titles contain escaped entities such as `&amp;`; the app shows them as stored, as the original does.
- Next-page loads on Home still wait for the request in flight (only reset searches supersede it); an `AbortController` in `searchQdn` would let both cancel cleanly.
- Consider qapp-core for lists and identifier hashing in a later pass.
- MUI's `Avatar` starts loading its `src` as soon as it mounts, so `loading="lazy"` on list avatars defers nothing (the account menu has its own in-view image). An in-view Avatar wrapper for rows, comments and profiles would load only visible avatars.
- At 360 px a grid card's three actions can wrap to two lines where the emulated desktop scrollbar takes 16 px; on a phone (overlay scrollbars) they fit.
- The screenshot harness could grow into a regression check (compare against stored baselines) once the layouts settle.
