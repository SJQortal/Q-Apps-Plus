# Q-Share+

Share files and documents on QDN, with categories, comments and lists.

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
4. **Upload progress**: `PUBLISH_MULTIPLE_QDN_RESOURCES` gives no per-file progress; the modal shows per-resource done/failed only. Real progress needs one publish per file; defer.
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
5. **Lead**: settings store, Following feed, hidden names, lazy avatars (done); wiring collections into rows; first-load search counts; review workflow on the diff; lint pass; version 1.0.0-plus.2; brief and PR.

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

## Follow-ups

Questions for Simon:

1. **Deep link with `+`:** `shareLink()` now builds `qortal://APP/Q-Share%2B/share/<name>/<id>`. Check in Hub that this opens Q-Share+; if it does not, the fallback is to link to `Q-Share` again (docs/QORTAL.md asks for the exact failure to be recorded here).
2. **Quill round trip in Hub:** publish a share from Q-Share+ with bullets, a numbered list and a code block, open it in the original Q-Share; then open an old share with formatting in Q-Share+. The jsdom round trip passes; this is the real check.
3. **Classic theme fonts:** five TTFs that only sat in the fallback list were dropped (Merriweather Sans, Karla, Proxima Nova, Catamaran, Oxygen, plus the unused Livvic). Cambon Light, Raleway and Cairo stay (0.8 MB). Drop those too and let Classic use Inter, or keep them for fidelity?
4. **Dead Q-Tube code** is still in the tree but unreachable: `VideoPlayer.tsx`, `VideoPlayerGlobal.tsx` and the `react-rnd` floating player, `Playlists.tsx`, `PlaylistListEdit.tsx`, the `PLAYLIST` branch in `getFiles`. Remove next pass?

Next pass ideas:

- Upload progress per file: `PUBLISH_MULTIPLE_QDN_RESOURCES` reports only done/failed per resource; per-file progress needs one publish per file and a resumable flow.
- Collections (`qshare_collection_` DOCUMENT, additive) and PDF/text previews.
- ESLint 9 flat config with typescript-eslint 8 and react-hooks 7, then make `npm run lint` part of the build gate.
- Settings sync to QDN (Torq's `settingsQdn.ts` pattern) once there are more settings than the theme.
- Hidden-word/hidden-user filters inside the app (the block list is Qortal-wide).
- Consider qapp-core for lists and identifier hashing in a later pass.
- Network statistics count up to 3,000 shares (30 pages of 100) and then show "3000+"; raise the cap if the network grows past that.
