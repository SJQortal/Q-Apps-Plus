# Q-Support+

Support and issue board for Qortal, with bounties paid in QORT and other coins.

## Baseline at import

- **Upstream:** [Qortal/q-support](https://github.com/Qortal/q-support) branch `main` at `5e2833f` (2025-07-25, 46 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 5, TypeScript 5
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** upstream **fails** (missing icons, see Notes). After the import fix it passes: dist 2.8 MB, biggest JS chunk 1.2 MB
- **QDN services:** DOCUMENT, FILE, THUMBNAIL, PLAYLIST, BLOG_COMMENT
- **Identifiers seen (partial; complete this in the audit):** collect during the audit (issue/comment prefixes); `qortal_avatar`
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×7, GET_QDN_RESOURCE_URL ×5, FETCH_QDN_RESOURCE ×5, SEARCH_QDN_RESOURCES ×4, SEND_COIN ×2, SEND_CHAT_MESSAGE ×1

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- **`react-quill` 2 crashes on React 19** (it calls `findDOMNode`). Switch to `react-quill-new` (Quill 2) and check that content written by the + app still displays correctly in the original app, and the other way round (docs/MIGRATION-NOTES.md, Q-Apps+ specifics).
- **The upstream build was broken:** `.gitignore` has excluded `src/assets/icons/*` since Q-Support 1.0, so the icons the code imports were never pushed. The import commit fixed it:
  - It copied the 7 coin PNGs from Q-Trade+ and the Q-Fund logo (`QFundDarkLogo.png`) from Q-Fund+.
  - It added **labelled placeholders** for the 10 category and status icons (`Bug-Report-Icon.webp`, `Feature-Request-Icon.webp`, `Tech-Support-Icon.webp`, `Q-App-Icon.webp`, `Qortal-Core-Icon.webp`, `Qortal-UI-Icon.webp`, `Open-Icon.webp`, `In-Progress-Icon.webp`, `Complete-Icon.webp`, `Closed-Icon.webp`). Those exist nowhere in git.
  - It removed the ignore rule.

  In the redesign, either replace the placeholders with proper icons in the Hub 3.0 style (preferred: MUI icons or SVGs that follow the theme), or use the originals if Simon extracts them from the published Q-Support app.
- Has 4 `limit: 0` searches.

## Status (paused 2026-09-29, branch `q-support-plus/pass-1`, no PR yet)

The first overnight session was paused by Simon after the platform upgrade. Every commit on the branch builds (`npm run build`, tsc 0 errors), and `npm install` passes without `--legacy-peer-deps`. Nothing has been published, and no PR has been opened. Commits, oldest first:

1. `Q-Support+: upgrade toolchain to Vite 8, plugin-react 6 and TypeScript 5.9` (step 1). tsconfig `moduleResolution` → `bundler`; two stray auto-imports removed from `DataEditor.tsx`.
2. `Q-Support+: move to Redux Toolkit 2, react-redux 9.3 and React Router 6.30` (steps 2–4). BrowserRouter has `v7_relativeSplatPath` and `v7_startTransition` on; `preloadedState: undefined` removed from the store (RTK 2 types reject it).
3. `Q-Support+: replace react-quill with react-quill-new (Quill 2)` (step 5). See "Quill 2 compatibility" below.
4. `Q-Support+: upgrade to React 19.3 on MUI 5.18` (steps 6–7). Also react-toastify 11, react-intersection-observer 11, react-dropzone 14.4, react-rnd 10.5.
5. `Q-Support+: upgrade to MUI 9.4` (step 8). Codemods in MIGRATION-NOTES §2.4 order plus the hand fixes listed in the commit; `scripts/check-mui-icons.sh Q-Support+` is clean. The codemods normalised CRLF → LF in 31 files, which inflates that diff.

**Numbers so far** (React 18 / MUI 5 baseline → React 19.3 / MUI 9.4, nothing code-split yet):

| | Baseline | After upgrade |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| dist | 2.8 MB | 2.9 MB |
| biggest JS chunk | 1.21 MB (gzip 385 KB) | 1.34 MB (gzip 423 KB) |
| build time (Vite 5 → Vite 8) | 16 s | 4 s |
| `npm run lint` | fails: 27 errors, 261 warnings | not re-run; eslint 8 + typescript-eslint 5 still installed (see Follow-ups) |

**Quill 2 compatibility (data contract for `htmlDescription`).** The editor keeps Quill 2's raw HTML in state (`useSemanticHTML={false}`), and `PublishIssue`, `EditIssue` and `EditPlaylist` pass it through `toQuill1Html()` (`src/components/common/TextEditor/quillCompat.ts`) when building `htmlDescription`. That converts Quill 2's `<ol><li data-list="bullet">` lists to `<ul>`/`<ol>` and its `div.ql-code-block-container` to `<pre class="ql-syntax">`, which is what Quill 1 wrote, so the original Q-Support renders it. Quill 1 HTML passes through unchanged. `DisplayHtml` no longer imports Quill's stylesheets; a themed container styles both forms. `quill-image-resize-module-react` (Quill 1 only) is replaced by `quill-resize-image`. **Not yet verified in Hub with real issues in both directions**, and `toQuill1Html` has no unit tests yet because the test harness is not in.

## Feature ideas to weigh in the audit

- issue status workflow (open, in progress, solved)
- filter by status, category and bounty
- mark a reply as the solution
- notify the issue author

## Audit

_Partly done. The two finished sections of the paused audit are below, raw; condense them and add the missing sections (see Follow-ups item 4)._

<details>
<summary>Architecture map (raw audit notes, 2026-09-29)</summary>

### Q-Support+ audit — Architecture map

Read-only pass over `apps/Q-Support+/src` at branch `q-support-plus/pass-1` (HEAD `b8af22a`, one commit past `main`: the Vite 8 / plugin-react 6 / TS 5.9 toolchain bump). All application source is still the upstream baseline (React 18.3, MUI 5, RTK 1.9, react-router 6, react-quill 2; `package.json:13-35`). All paths below are relative to `apps/Q-Support+/`.

---

#### 1. Entry point and boot

| Step | File:line | What happens |
|---|---|---|
| HTML shell | `index.html:5,7,11` | `<link rel="icon" href="/favicon.ico">` (absolute path, breaks under Hub's `/render/APP/<Name>` prefix), title `Q-Support`, loads `/src/main.tsx`. No Hub boot snippet, no theme pre-paint. |
| Vite | `vite.config.ts:8-11` | `base: ""`, `target: esnext`, no manual chunks, no lazy routes anywhere. |
| main.tsx | `src/main.tsx:11-16` | Reads `window._qdnBase` → `<BrowserRouter basename>`; renders `<App/>` plus `<div id="modal-root"/>` (used by `components/common/Portal.tsx:20`). Imports only `index.css` (`main.tsx:3`); `src/App.css` is an unused Vite template leftover. |
| **Module-level top-level await** | `constants/PublishFees/FeeData.tsx:17` | `export const feeDataDefault = await fetchCurrentPriceData("default","QORT")` → `FeePricePublish.ts:24-29` does `FETCH_QDN_RESOURCE {name:"Q-Support", service:"DOCUMENT", identifier:"q_support_fees"}` **before React mounts**. Outside Hub (no `qortalRequest`) this throws and the app never renders. Also creates an import cycle: `FeePricePublish.ts:2` imports `store` → `fileSlice.ts:2` → `SendFeeFunctions.ts:1` → `FeeData.tsx:6` → `FeePricePublish.ts`. |
| App.tsx | `src/App.tsx:16-41` | Theme is local `useState("dark")` (`:18`); `window._qdnTheme` is commented out (`:17`); nothing persisted. `fetchFeesRedux()` on mount (`:21`). Tree: `Provider > ThemeProvider(light|dark from styles/theme.tsx) > Notification > DownloadWrapper > GlobalWrapper > CssBaseline + Routes`. |
| Hub integration | — | No `NAVIGATION_SUCCESS`, no `QDN_RESOURCE_DISPLAYED`, no `?theme=`/`identifier=` handling, no `decodeURIComponent` of `_qdnBase`. |

#### 2. Routes (`src/App.tsx:31-35`)

| Path | Element | Page file |
|---|---|---|
| `/` | `<Home/>` | `pages/Home/Home.tsx` |
| `/issue/:name/:id` | `<IssueContent/>` | `pages/IssueContent/IssueContent.tsx` |
| `/channel/:name` | `<IndividualProfile/>` | `pages/IndividualProfile/IndividualProfile.tsx` |

No catch-all / 404 route. Internal navigations: `IssueList.tsx:164,227`, `IssueListComponentLevel.tsx:165,230`, `IssueContent.tsx:334`, `Navbar.tsx:108,178,219` (all to `/`, `/issue/…`, `/channel/…`), `DownloadTaskManager.tsx:132` (`/issue/${properties.name}/${jsonId}`), and dead `Playlists.tsx:55` → `/video/${name}/${id}` which **does not exist**. Deep-link comment anchor: `CommentSection.tsx:84-104` reads `?comment=` from `location.search` with `URLSearchParams`.

#### 3. Redux store (`src/state/store.ts:8-20`)

`configureStore({ reducer: { notifications, auth, global, file }, serializableCheck: false })`. `RootState`/`AppDispatch` exported (`:24,28`). Hooks use plain `useSelector`/`useDispatch` (no typed hooks). `FeePricePublish.ts:18,39` reads the store directly via `store.getState()`.

##### 3.1 `auth` (`state/features/authSlice.ts`)
- Shape (`:4-13`): `{ user: { address, publicKey, name? } | null }`.
- Action: `addUser` (`:19`).
- **Writes:** `wrappers/GlobalWrapper.tsx:91` after `GET_USER_ACCOUNT` + `GET_PRIMARY_NAME`.
- **Reads:** `GlobalWrapper.tsx:35`; `pages/Home/IssueList.tsx:45`; `components/PublishIssue/PublishIssue.tsx:89-92`; `components/EditIssue/EditIssue.tsx:82-85`; `components/EditPlaylist/EditPlaylist.tsx:71-74`; `components/PlaylistListEdit/PlaylistListEdit.tsx:18`; `Comments/Comment.tsx:45,198`; `Comments/CommentEditor.tsx:118`; `Comments/CommentSection.tsx:57` (destructured, unused).

##### 3.2 `file` (`state/features/fileSlice.ts`) — the issue list
- Shape (`:5-34`): `files: Issue[]`, `filteredFiles: Issue[]`, `hashMapFiles: Record<id, Issue>`, `countNewFiles`, `isFiltering`, `filterValue`, `filterType` (default `"videos"` `:27`), `filterSearch`, `filterName`, `selectedCategoryFiles` (never used), `editFileProperties`, `editPlaylistProperties`, `publishedQappNames: string[]`.
- `Issue` interface (`:36-53`): `title, description, created, user, service?, videoImage?, id, category?, categoryName?, tags?, updated?, isValid?, code?, feeData?: PublishFeeData, bountyData?: BountyData, paymentVerified?`. Note that the full issue JSON fetched from QDN (fields `fullDescription, htmlDescription, files[], images[], QappName, subcategory, subcategory2, commentsId, version`) is spread onto these objects untyped (`utils/fetchVideos.ts:22-26`).
- Two parallel copies of list data: `files[]` holds search-result stubs (+feeData/bountyData), `hashMapFiles[id]` holds the fully fetched JSON with `isValid: true`. `IssueList` only renders rows whose id is in the hash map **and** `isValid` (`IssueList.tsx:67-69`), so the list "fills in" as `FETCH_QDN_RESOURCE` calls complete.

| Action | Dispatched by | State read by |
|---|---|---|
| `addFiles` | `hooks/useFetchIssues.tsx:174,297` | `files`: `Home.tsx:78`, `useFetchIssues.tsx:36` |
| `upsertFiles` | `useFetchIssues.tsx:298` | |
| `upsertFilesBeginning` | `useFetchIssues.tsx:171` (dead `getNewIssues`) | |
| `addFilteredFiles` | `Navbar.tsx:111,175,180,213,220,233` — **always `[]`** | `filteredFiles`: `Home.tsx:81-83`, `useFetchIssues.tsx:40-42` |
| `upsertFilteredFiles` | `useFetchIssues.tsx:349` (dead `getIssuesFiltered`) | |
| `setIsFiltering`, `setFilterValue` | `Navbar.tsx` (search popover + logo click) | `Home.tsx:42-43`, `Navbar.tsx:67` |
| `changeFilterType/Search/Name` | `Home.tsx:48-66,188-190` | `Home.tsx:46,51,62` |
| `setQappNames` | `Home.tsx:89` | `Home.tsx:54-56`, `PublishIssue.tsx:93-95`, `EditIssue.tsx:89-91` |
| `addToHashMap` | `useFetchIssues.tsx:105`, `IssueContent.tsx:159` | `hashMapFiles`: `IssueList.tsx:40-42`, `IssueListComponentLevel.tsx:39-41`, `IssueContent.tsx:89-91`, `useFetchIssues.tsx:33-35` |
| `removeFromHashMap` | `useFetchIssues.tsx:106` | |
| `updateInHashMap` | `EditIssue.tsx:345,658`; `EditPlaylist.tsx:348,357` | |
| `updateFile` | `EditIssue.tsx:657`; `EditPlaylist.tsx:347,351` | |
| `setCountNewFiles` | `useFetchIssues.tsx:177,394,398` (dead paths) | `countNewFiles` **never read** |
| `blockUser` | `IssueList.tsx:60` | |
| `setEditFile` | open: `IssueList.tsx:143`; close: `EditIssue.tsx:182` | `editFileProperties`: `EditIssue.tsx:86-88` |
| `setEditPlaylist` | only `EditPlaylist.tsx:220` (with `null`) — **nothing ever opens the playlist modal** | `editPlaylistProperties`: `EditPlaylist.tsx:75-77` |
| `removeFile`, `addFileToBeginning`, `clearFileList`, `addArrayToHashMap` | **never dispatched** | |

##### 3.3 `global` (`state/features/globalSlice.ts`)
- Shape (`:4-25`): `isLoadingGlobal`, `downloads: Record<identifier, {name, service, identifier, properties, url?, status?}>`, `userAvatarHash: Record<name,url>`, `publishNames`, `videoPlaying`, `totalFilesPublished`, `totalNamesPublished`, `filesPerNamePublished`, `feeData: FeePrice[]`.

| Action | Dispatched by | Read by |
|---|---|---|
| `setIsLoadingGlobal` | `useFetchIssues.tsx:121,190` (dead), `IssueContent.tsx:116,167` | `GlobalWrapper.tsx:75` → full-screen `PageLoader` (`:124`) |
| `setAddToDownloads`, `updateDownloads` | `wrappers/DownloadWrapper.tsx:83,64,105,129,152,166` | `DownloadWrapper.tsx:39`, `DownloadTaskManager.tsx:21`, `FileElement.tsx:77`, `VideoPlayer.tsx:95`, `VideoPlayerGlobal.tsx:98` |
| `setUserAvatarHash` | `GlobalWrapper.tsx:56` (own avatar), `useFetchIssues.tsx:82` (unused fn) | `Channels.tsx:19` (dead), `IssueContent.tsx:70-82` and `IndividualProfile.tsx:17-29` compute `avatarUrl` **and never use it** (both render `/arbitrary/THUMBNAIL/${name}/qortal_avatar` directly: `IssueContent.tsx:346`, `IndividualProfile.tsx:47`) |
| `addPublishNames` | never | `publishNames`: `Channels.tsx:16` (dead) |
| `setVideoPlaying` | `VideoPlayer.tsx:257,319,650` (dead file), `VideoPlayerGlobal.tsx:464` | `GlobalWrapper.tsx:36-38` (floating player), `VideoPlayer.tsx:90` |
| `setTotalFilesPublished`, `setTotalNamesPublished`, `setFilesPerNamePublished` | `useFetchIssues.tsx:424-426` (`getIssuesCount`) | `StatsData.tsx:28-36`, `useFetchIssues.tsx:44-52` (unused) |
| `setFeeData` | `FeePricePublish.ts:44` | `FeePricePublish.ts:18,39` via `store.getState()` |

##### 3.4 `notifications` (`state/features/notificationsSlice.ts`)
- Shape (`:9-19`): `alertTypes: { alertSuccess, alertError, alertInfo }`.
- Actions `setNotification({alertType, msg})`, `removeNotification` (`:25-66`).
- Written by ~15 components (`PublishIssue`, `EditIssue`, `EditPlaylist`, `CommentEditor`, `Donate`, `FileElement`, `ImageUploader`, `DataEditor`).
- Read by `components/common/Notification/Notification.tsx:10`, which calls `toast.*` **and dispatches `removeNotification` during render** (`:12-50`), then renders a `ToastContainer` (`:52-83`).

#### 4. Wrappers

##### `wrappers/GlobalWrapper.tsx`
- Exports the module-level `queue = new RequestQueue()` (`:29`; `utils/queue.ts:12` default 5 concurrent). Every consumer imports the queue **from the wrapper**, which pulls React component code into the hook module graph.
- On mount: `GET_USER_ACCOUNT` → `GET_PRIMARY_NAME` → `addUser` (`:77-99`); then `GET_QDN_RESOURCE_URL` avatar for the logged-in name (`:44-73`) stored in both local state and `userAvatarHash`.
- Renders (`:122-163`): `PageLoader` when `isLoadingGlobal`, `ConsentModal`, `NavBar` (props: `setTheme`, `isAuthenticated`, `userName`, `userAvatar`, `authenticate`), `<EditIssue/>` modal, `<EditPlaylist/>` modal (dead), a `react-rnd` draggable box containing `<VideoPlayerGlobal/>` shown only when `videoPlaying` (dead), then `children`.

##### `wrappers/DownloadWrapper.tsx`
- Provides `MyContext = { downloadVideo({name, service, identifier, properties}) }` (`:35,205`).
- `performDownload` (`:75-180`): `setAddToDownloads`, then a **`setInterval` every 5 s** calling `GET_QDN_RESOURCE_STATUS` (`:94-173`) until `READY`/`NOT_PUBLISHED`, with a stall detector that re-issues `GET_QDN_RESOURCE_PROPERTIES` after 25 s (`:139-146`); no `visibilityState` check, no unmount cleanup. Also fires `GET_QDN_RESOURCE_PROPERTIES` + `GET_QDN_RESOURCE_URL` immediately (`:42-73`).
- Consumers: `components/common/FileElement.tsx:72` (live, issue attachments), `VideoPlayer.tsx:163` and `VideoPlayerGlobal.tsx:143` (dead). `DownloadTaskManager` import is commented out here (`:206`) and rendered from the Navbar instead.

#### 5. Navbar (`components/layout/Navbar/Navbar.tsx`)

Sticky `CustomAppBar` fixed at **100 px tall** (`Navbar-styles.tsx:19`) with `borderBottom: primary.light`. Left: 100 px logo image (`Navbar.tsx:117-124`) that resets filters and navigates home, plus 30 px "Welcome to Q-Support" text (`:126-133`). Right (`:136-326`):
1. A search `Popover` (`:143-239`) anchored on `anchorElNotification` — **but `openNotificationPopover` (`:73-76`) is never wired to any element**, so this search UI is unreachable. It would set `isFiltering`/`filterValue` and navigate to `/`.
2. `<DownloadTaskManager/>` (`:241`) — attachment download progress popover.
3. `<FeeHistoryModal/>` (`:242`) — "Q-Support Fees" button → table of fee history; owner of name `Q-Support` gets an editor that publishes `q_support_fees`.
4. Light/dark toggle SVGs (`:243-257`) → `setTheme` prop → `App.tsx:18` state.
5. Avatar + name + expand icon (`:258-287`) → `Popover` with one item "Blocked Names" (`:296-319`) → `BlockedNamesModal` (`:320-325`).
6. `<PublishIssue/>` "Open an Issue" button, only when authenticated (`:288-294`).
- `useWindowSize()` is called (`:52`) but its result is unused. `theme.palette.mode` decides which toggle icon shows (`:243`). Hard-coded colours `#ACB6BF` (`:284`), `#e35050` (`:314`).

#### 6. Pages and their main components

##### 6.1 Home (`pages/Home/Home.tsx`)
Layout (`:200-365`): MUI `Grid container`; left `FiltersCol` (`xs=12 md=2 sm=3`, `IssueList-styles.tsx:190`) containing `StatsData`, keyword `Input`, exact-name `Input`, `CategoryList` (3-level cascade) **or** `CategorySelect` (flat single category) — each hides the other on selection (`:263-281`), `AutocompleteQappNames` (forces category `3` when a Q-App is picked, `:289-297`), sort `Select` (Newest/Oldest/User/Bounty, `:301-312`), `reset` and `Search` buttons. Right column: `<IssueList issues sortOption/>` + `<LazyLoad onLoadMore/>` (`:358-362`).

Data flow:
- Mount: `getPublishedQappNames()` (`:87-92`) → 2× `SEARCH_QDN_RESOURCES` with `limit: 0` over **every APP and WEBSITE on QDN** (`AutocompleteQappNames.tsx:110-131`).
- Mount: `getFilesHandlerMount` → `getIssues()` with no filters (`:152-162,173-185`), guarded by refs `firstFetch/afterFetch/isFetching`.
- `LazyLoad` in view → `getIssuesHandler()` → `getIssues({name, categories, QappName, keywords, type}, reset, resetFilters)` (`:105-137`). `categoriesString` is either `getCategoriesFetchString(selected)` = `cat:1;sub:11;sub2:101;` or, for the flat select, `":" + id + ";"` (`:113-114`) which substring-matches inside the encoded description.
- `issues = isFiltering ? filteredFiles : files` (`:164-171`). Because `getIssues` only ever writes `files` and `getIssuesFiltered` is never called, **Navbar search (if it were reachable) would show an empty list**.
- `filtersToDefault` (`:187-198`) wraps an async call in `ReactDOM.flushSync` (no-op wrapper).
- `StatsData` (`components/StatsData.tsx:38-40`) calls `getIssuesCount()` on every Home mount → `/arbitrary/resources/search?...&limit=0&service=DOCUMENT&identifier=q_support_issue_` (`useFetchIssues.tsx:407`) to count all issues and unique names client-side.

##### 6.2 IssueList (`pages/Home/IssueList.tsx`)
Props `{ issues, sortOption }`. Filters to `hashMapIssues[id]?.isValid` (`:67-69`), sorts in `useMemo` (`:78-102`; `ts()` helper handles number|string timestamps `:71-76`). Each row (`:119-274`): hover `IconsBox` with **Edit Issue** (own issues → `setEditFile`, `:140-149`) or **Block User** (`ADD_LIST_ITEMS blockedNames`, `:49-65,151-160`; publisher `Q-Support` cannot be blocked `:50`); `IssueCard` → `/issue/:user/:id`; fixed-width columns 280 px `IssueIcons`, 250 px `BountyDisplay`, 400 px title, 200 px author (`:184,198,211,224`); QORT coin icon if `feeData.isPaid` (`:216-221`); `Avatar src="/arbitrary/THUMBNAIL/${user}/qortal_avatar"` (`:238`); `formatDate(created)` relative time (`:254`). Rows not yet in the hash map render a `Skeleton` (`:261-271`). Row height fixed 75 px (`:125`).

##### 6.3 IssueListComponentLevel (`pages/Home/IssueListComponentLevel.tsx`)
Per-publisher list used by `IndividualProfile.tsx:65`. Own fetch (`:49-107`): `/arbitrary/resources/search?mode=ALL&...&limit=50&service=DOCUMENT&query=q_support_issue__&name=${paramName}` (`:53`; note `query=` not `identifier=`, and the double underscore), then for each result `getIssue()` immediately **and** `queue.push(() => getIssueData)` with an already-running promise (`:91-93`, so the queue throttles nothing), `verifyAllPayments`, `getBountyAmounts`, `console.log` (`:102`). Keeps its own `issues` state (not Redux). Row markup is a copy of `IssueList` (`:137-280`) without edit/block; date passes raw `created` to `formatDate` (`:257`). `LazyLoad` (`:281`) re-runs `getIssues` with `offset = issues.length` (`:51`). Imports unused `getNewIssues, checkNewIssues, getIconsFromObject, QORTicon`.

##### 6.4 IssueContent (`pages/IssueContent/IssueContent.tsx`)
Route `/issue/:name/:id`. Effect (`:239-252`): if `hashMapFiles[id]` exists → `verifyPayment` then render; else `getIssueData` (`:113-169`): search `limit=1&includemetadata=true&identifier=${id}&name=${name}` (`:118`), `FETCH_QDN_RESOURCE DOCUMENT` (`:142-147`), `verifyPayment` (`:155`), `addToHashMap` (`:159`), then dead `checkforPlaylist` (`:171-237`: searches `service=PLAYLIST&description=c:${code}` — issues never carry `code`; `playlistData` is set but never rendered). Unused memos `videoReference`/`videoCover` (`:92-110`).
Render (`:273-556`): `IssueIcons` + `FileTitle` + QORT icon if paid (`:296-315`); date (`:316-326`); author card → `/channel/:name` (`:329-362`); `BountyDisplay timeDisplay="BOTH"` + raw crowdfund/source links as plain text + `<Donate/>` (`:364-385`); category breadcrumb `categoriesDisplay` (`IssueContent-functions.ts:26-65`); inline `images[]` (base64 data URLs from the JSON, width `1080/n px`, `:397-414`); description box with expand/collapse (`:416-490`) using `DisplayHtml` (DOMPurify + Quill CSS) or plain `fullDescription`; attachments list with `FileElement` download (`:501-541`); `<CommentSection postId postName/>` (`:553`). Hard-coded `#333333/#CCCCCC` (`:418`), `#d6e8ff` (`:355`).

##### 6.5 IndividualProfile (`pages/IndividualProfile/IndividualProfile.tsx`)
Header with avatar + name (`:31-64`, direct `/arbitrary/THUMBNAIL/...` URL) then `<IssueListComponentLevel/>` (`:65`). Unused `avatarUrl` memo (`:22-29`).

##### 6.6 Publish and edit modals
**PublishIssue** (`components/PublishIssue/PublishIssue.tsx`): "Open an Issue" button (`:386-395`) → `Modal` (`:400-608`): dropzone (max 10 files, 400 MB, `:126-160`), `CategoryList columns=3` with auto-default state `101` Open (`:469-489`), `AutocompleteQappNames` when location is `3` Q-Apps/Websites (`:491-498`), "Link to Source Code", "Bounty Amount or Q-Fund Link" + coin `Select` (`:499-536`), `ImagePublisher` (`:538`), title (max 60, `titleFormatter`, `:539-551`), `TextEditor` (react-quill, `:559-564`), fee `StateCheckBox` (`:567-572`), Cancel / Publish. `publishQDNResource` (`:165-374`) validates, **pays the fee first** (`payPublishFeeQORT` → `SEND_COIN` to name `Q-Support`, `:290-297`), builds one `PUBLISH_QDN_RESOURCE` per attachment (`service: FILE`, `:259-270`) and one for the issue JSON (`service: DOCUMENT`, `:332-343`), and hands the array to `<MultiplePublish/>` → `PUBLISH_MULTIPLE_QDN_RESOURCES` via `qortalRequestWithTimeout` (`MultiplePublishAll.tsx:41-45`). Leftover Q-Tube state: `step`, `playlistCoverImage`, `selectExistingPlaylist`, `playlistTitle`, `playlistDescription`, `playlistSetting` (`:106-116`).

**EditIssue** (`components/EditIssue/EditIssue.tsx`): global modal opened by `state.file.editFileProperties` (`:86-88,420`). Prefills from the hash-map object (`:152-179`), runs `verifyPayment` to decide whether to show "Publish Edit with Fee" (`:163-165,604-619`). `publishQDNResource(payFee)` (`:190-410`) republishes the DOCUMENT under the **same identifier** (`:368`) keeping `version`, `commentsId`, `feeData` (or a new fee signature `:331-346`); new attachments get new FILE publishes, existing ones are passed through (`:248-252`). On success: `updateFile` + `updateInHashMap` (`:656-658`).

##### 6.7 Common components (live)
| Component | File | Role / Qortal calls |
|---|---|---|
| AutocompleteQappNames | `common/AutocompleteQappNames.tsx` | Q-App name picker; `getPublishedQappNames` = 2× `SEARCH_QDN_RESOURCES {service: APP|WEBSITE, limit: 0}` (`:110-131`); fetch string `Qapp:${name};` (`:134-136`) |
| BlockedNamesModal | `common/BlockedNamesModal/BlockedNamesModal.tsx` | `GET_LIST_ITEMS blockedNames` (`:27-30`), `DELETE_LIST_ITEM` (`:43-47`) |
| BountyDisplay | `common/BountyDisplay.tsx` | Shows coin icon + amount and, for Q-Fund links, time left. `initializeBountyDisplay` on mount **and `setInterval(…, 60_001)` never cleared** (`:62-65`); per instance with a crowdfund link: `getCrowdfundEndDate` (FETCH_QDN_RESOURCE + `/at/` + `/blocks/height`) + `GET_DAY_SUMMARY` + `getATaddress` (FETCH) + `getHasQFundEnded` (`/at/`) + `getATAmount` (FETCH + `SEARCH_TRANSACTIONS limit 0`) (`:35-61`). Rendered once per list row and on the detail page. |
| CategoryList / CategorySelect | `common/CategoryList/*.tsx` | Cascading 3-level select via `forwardRef` imperative API (`CategoryList.tsx:44-50,99-112`); helpers `getCategoriesFetchString` (`:292-303`), `getCategoriesFromObject` (`:316-328`). `CategorySelect` duplicates the `Category*` interfaces (`CategorySelect.tsx:15-28`). |
| CoinIcon | `common/CoinIcon.tsx` | Maps `CoinType` → PNG; imports via `../../../src/assets/...` (`:2-9`) |
| Comments | `common/Comments/CommentSection.tsx`, `Comment.tsx`, `CommentEditor.tsx` | See §8 for identifiers. `CommentSection.getComments` (`:148-201`): search `BLOG_COMMENT` `limit=20`, then **serially** per comment `fetch /arbitrary/BLOG_COMMENT/${name}/${identifier}` (`:169-177`) **and** `getReplies` (search `limit=0` + per-reply fetch, `:106-146`). `Comment`→`CommentCard` calls `GET_QDN_RESOURCE_URL` avatar per card (`:203-220`). `CommentEditor` publishes `BLOG_COMMENT` (`:160-166`) then `sendQchatDM` → `SEND_CHAT_MESSAGE` to the issue author for top-level comments (`:182-184`; `:137` sends unconditionally when `useTestIdentifiers`). |
| ConsentModal | `common/ConsentModal.tsx` | First-run disclaimer, localforage-backed (§9) |
| Donate | `common/Donate/Donate.tsx` | Q-Fund AT donation: `getUserBalance` (`GET_USER_ACCOUNT`+`GET_BALANCE`), `getATaddress`, `getATInfo`; on send: `/at/`, `/blocks/height`, `SEND_COIN {coin: QORT, destinationAddress: AT}` (`:96-101`) |
| DownloadTaskManager | `common/DownloadTaskManager.tsx` | Popover listing `global.downloads` with progress; navigates to the issue (`:128-133`) |
| FileElement | `common/FileElement.tsx` | Attachment row: `downloadVideo` from `MyContext`; when READY: `GET_QDN_RESOURCE_PROPERTIES` (`:114-119`), `fetch /arbitrary/${service}/${name}/${identifier}` → blob → `SAVE_FILE` (`:128-137`); own `setInterval` 7.5 s refetch loop (`:202-216`) |
| ImagePublisher / ImageUploader | `common/ImagePublisher/*.tsx` | Up to 3 images (`ImageUploader.tsx:32`), compressorjs → webp q0.6 max 1200 px → base64 **stored inline in the issue JSON** (`PublishIssue.tsx:313`) |
| IssueIcon / IssueIcons | `common/IssueIcon.tsx` | Renders category/state webp icons via `getIconsAndLabels` (`IssueContent-functions.ts:11-24`) — inside `useMemo` with async side effect (`:68-76`); for issues with `QappName` one `GET_QDN_RESOURCE_URL` per row (`IssueContent-functions.ts:16-21`) |
| LazyLoad | `common/LazyLoad.tsx` | `react-intersection-observer`, threshold 0.7 |
| MultiplePublish | `common/MultiplePublish/MultiplePublishAll.tsx` | Runs `PUBLISH_MULTIPLE_QDN_RESOURCES` with timeout `30 s × resources` (`:41-45`), retry UI |
| Notification | `common/Notification/Notification.tsx` | react-toastify bridge |
| PageLoader, Portal | `common/PageLoader.tsx`, `common/Portal.tsx` | Full-screen spinner; portal into `#modal-root` |
| TextEditor / DisplayHtml | `common/TextEditor/TextEditor.tsx`, `DisplayHtml.tsx`, `utils.ts` | `react-quill` 2 + `quill-image-resize-module-react` registered at import (`TextEditor.tsx:2-6`); `DisplayHtml` sanitises with DOMPurify, wraps `qortal://` links (`utils.ts:1-12`), renders in `.ql-editor` with Quill CSS imported three times (`DisplayHtml.tsx:3-5`). `extractTextFromHTML` builds `fullDescription` (`utils.ts:14-26`). |
| StatsData | `components/StatsData.tsx` | Issue/publisher counts; defines a styled component **inside the component body** (`:9-15`) |
| FeeHistoryModal / Body / DataTable / DataEditor | `constants/PublishFees/FeePricePublish/*.tsx` | Fee table; `DataEditor` publishes `q_support_fees` (`:137-153`) if `userHasName("Q-Support")`. **`DataEditor.tsx:16` imports `{ s } from "vite/dist/node/types.d-aGj9QkWt"`** (a hashed Vite 5 d.ts) and `:13` imports `{ key } from "localforage"` — both unused, the first will not resolve under Vite 8. `FeeData.tsx:1` imports `CheckBox` from the `@mui/icons-material` barrel (unused). |

#### 7. Hooks

##### `hooks/useFetchIssues.tsx`
Returns (`:432-441`) `{ getIssues, checkAndUpdateIssue, getIssue, hashMapFiles, getNewIssues, checkNewIssues, getIssuesFiltered, getIssuesCount }`.
- `checkAndUpdateIssue(issue)` (`:54-70`): decides whether to refetch; the comparison `(!existingVideo?.updated || video?.updated) > existingVideo?.updated` (`:62`) is a precedence bug (boolean `>` number).
- `getIssue(user, id, content)` (`:92-117`): `fetchAndEvaluateIssues` (`utils/fetchVideos.ts:3-36` → `FETCH_QDN_RESOURCE`, `checkStructure` always true `utils/checkStructure.ts:1-5`) → `addToHashMap`/`removeFromHashMap`; on error re-queues itself (retry counter double-increments `:110-112`).
- **`getIssues(filters, reset, resetFilters, limit)`** (`:194-304`) — the main list loader. `videoLimit = limit || 0` (`:213`) → every call is **unlimited**; URL (`:214-240`) `/arbitrary/resources/search?mode=ALL&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${files.length}&limit=0[&name=][&description=<cats>][&query=<Qapp>][&query=<keywords>]&service=DOCUMENT&identifier=q_support_issue_`. Then **for every result** immediately calls `getIssue` (`:267-281`; `queue.push(() => issue)` re-pushes an already-started promise, so the queue does not throttle), awaits all, then `verifyAllPayments` and `getBountyAmounts` in parallel (`:283-287`), merges `feeData`/`bountyData` into the stubs and dispatches `addFiles` (reset) or `upsertFiles` (`:297-298`).
- `getIssuesCount` (`:405-430`): `limit=0` over all issues, client-side count.
- Dead: `getNewIssues` (`:119-192`), `getIssuesFiltered` (`:306-364`), `checkNewIssues` (`:366-403`), `getAvatar` (`:72-90`). The `type === "playlists"` branch (`:234-237`) is unreachable because `filterType` is always `"videos"`.
- Called from `Home.tsx:94-103`, `IssueListComponentLevel.tsx:46-47`, `StatsData.tsx:17-26` (each instance re-creates all callbacks; the three components each subscribe to `files`, `hashMapFiles`, `filteredFiles`, `userAvatarHash` and the three stats selectors).

##### `hooks/useWindowSize.tsx`
`resize` listener returning `{ width }` (`:3-25`). Only `Navbar.tsx:52` calls it and ignores the result.

#### 8. Where Qortal is called

##### 8.1 `qortalRequest` actions by file
| File | Actions (line) |
|---|---|
| `wrappers/GlobalWrapper.tsx` | `GET_QDN_RESOURCE_URL` (:48), `GET_PRIMARY_NAME` (:79), `GET_USER_ACCOUNT` (:87) |
| `wrappers/DownloadWrapper.tsx` | `GET_QDN_RESOURCE_PROPERTIES` (:45), `GET_QDN_RESOURCE_URL` (:57), `GET_QDN_RESOURCE_STATUS` (:98, polled every 5 s) |
| `hooks/useFetchIssues.tsx` | `GET_QDN_RESOURCE_URL` (:75, unused) |
| `utils/fetchVideos.ts` | `FETCH_QDN_RESOURCE` (:15) — one per issue in every list |
| `pages/IssueContent/IssueContent.tsx` | `FETCH_QDN_RESOURCE` (:143), (:201 dead playlist) |
| `pages/Home/IssueList.tsx` | `ADD_LIST_ITEMS blockedNames` (:54) |
| `components/common/AutocompleteQappNames.tsx` | `SEARCH_QDN_RESOURCES {service, limit: 0}` ×2 (:111-114) |
| `components/common/BlockedNamesModal/BlockedNamesModal.tsx` | `GET_LIST_ITEMS` (:28), `DELETE_LIST_ITEM` (:44) |
| `components/common/Comments/Comment.tsx` | `GET_QDN_RESOURCE_URL` avatar (:205) per comment card |
| `components/common/Comments/CommentEditor.tsx` | `PUBLISH_QDN_RESOURCE BLOG_COMMENT` (:161); `SEND_CHAT_MESSAGE` via `sendQchatDM` (:137, :183) |
| `components/common/Donate/Donate.tsx` | `SEND_COIN` (:97) |
| `components/common/FileElement.tsx` | `GET_QDN_RESOURCE_PROPERTIES` (:115, :188), `SAVE_FILE` (:133) |
| `components/common/MultiplePublish/MultiplePublishAll.tsx` | `qortalRequestWithTimeout(PUBLISH_MULTIPLE_QDN_RESOURCES)` (:44) |
| `components/PublishIssue/PublishIssue.tsx` | builds `PUBLISH_QDN_RESOURCE` FILE (:260) + DOCUMENT (:333) → `PUBLISH_MULTIPLE_QDN_RESOURCES` (:348); `SEND_COIN` via `payPublishFeeQORT` (:292) |
| `components/EditIssue/EditIssue.tsx` | same shape (:288, :362, :375); `SEND_COIN` (:332) |
| `components/EditPlaylist/EditPlaylist.tsx` | `PUBLISH_QDN_RESOURCE PLAYLIST` (:326-337) — dead |
| `components/common/VideoPlayer.tsx` | `GET_QDN_RESOURCE_PROPERTIES` (:147) — dead |
| `constants/PublishFees/FeePricePublish/FeePricePublish.ts` | `FETCH_QDN_RESOURCE {name:"Q-Support", identifier:"q_support_fees", service:"DOCUMENT"}` (:24-29) — at module load (top-level await in `FeeData.tsx:17`) and cached in Redux |
| `constants/PublishFees/FeePricePublish/DataEditor.tsx` | `PUBLISH_QDN_RESOURCE` fees (:138-143) — owner only |
| `constants/PublishFees/SendFeeFunctions.ts` | `GET_NAME_DATA` (:17), **`SEND_COIN {coin, destinationAddress, amount}`** (:41-46) — bounty/fee payment path that must stay byte-for-byte |
| `constants/PublishFees/VerifyPayment-Functions.ts` | `GET_ACCOUNT_NAMES` (:36), `GET_USER_ACCOUNT` (:83) |
| `utils/qortalRequests.ts` | `GET_NAME_DATA` (:13), `SEND_CHAT_MESSAGE` (:32), `SEARCH_TRANSACTIONS {limit: 0}` (:55-61), `FETCH_QDN_RESOURCE` (:81, crowdfund JSON), `GET_DAY_SUMMARY` (:191), `GET_BALANCE` (:236), `GET_QDN_RESOURCE_URL` (:248) |

##### 8.2 Raw Core REST `fetch()` calls
| File | Endpoint (line) |
|---|---|
| `hooks/useFetchIssues.tsx` | `/arbitrary/resources/search` (:123 dead, :244 **main list, limit 0**, :312 dead, :368 dead, :409 **count, limit 0**) |
| `pages/Home/IssueListComponentLevel.tsx` | `/arbitrary/resources/search?...limit=50&query=q_support_issue__&name=` (:53) |
| `pages/IssueContent/IssueContent.tsx` | search `limit=1` by identifier (:118); dead playlist searches (:175, :215) |
| `components/common/Comments/CommentSection.tsx` | search BLOG_COMMENT `limit=20` (:156-158), `limit=0` replies (:111-115); `/arbitrary/BLOG_COMMENT/{name}/{id}` per comment (:126, :169) |
| `components/common/Donate/Donate.tsx` | `/at/{address}` (:58-59), `/blocks/height` (:77-78) |
| `components/common/FileElement.tsx` | `/arbitrary/{service}/{name}/{identifier}` blob (:128-129) |
| `constants/PublishFees/VerifyPayment.ts` | `/transactions/signature/{sig}` (:13-14) — once per issue per list load |
| `utils/qortalRequests.ts` | `/at/{address}` (:91, :153), `/blocks/height` (:109) |
| `components/EditPlaylist/EditPlaylist.tsx`, `PlaylistListEdit.tsx` | search (:152-153, :23-24) — dead |
| Direct `<img src>` | `/arbitrary/THUMBNAIL/{name}/qortal_avatar` in `IssueList.tsx:238`, `IssueListComponentLevel.tsx:241`, `IssueContent.tsx:346`, `IndividualProfile.tsx:47` |

##### 8.3 First-load call budget (Home, N issues, C of them with a Q-Fund link, Q issues with a QappName)
1 fee fetch (module load) + 3 account/avatar + 2 `SEARCH_QDN_RESOURCES limit 0` (all apps + all websites) + 1 count search `limit 0` + 1 list search `limit 0` + N × `FETCH_QDN_RESOURCE` + N × (`/transactions/signature` + `GET_NAME_DATA` + `GET_ACCOUNT_NAMES`) + C × (`FETCH_QDN_RESOURCE` + `SEARCH_TRANSACTIONS limit 0`) + Q × `GET_QDN_RESOURCE_URL` + per rendered `BountyDisplay` with a link: ~6 more calls **repeated every 60 s for the life of the tab** (`BountyDisplay.tsx:64`).

#### 9. QDN data model and identifiers (for ground rule 1)

| Resource | Service | Identifier scheme | Where |
|---|---|---|---|
| Issue | `DOCUMENT` | `q_support_issue_<sanitised-title[0:30]>_<uid>_metadata`; `tag1: q_support_issue_`; `filename: video_metadata.json`; metadata `title[0:50]`, `description = "**cat:<loc>;sub:<type>;sub2:<state>;[Qapp:<name>;]**" + fullDescription[0:150]` | `PublishIssue.tsx:282-283,319-343`; `EditIssue.tsx:361-371` |
| Issue JSON body | | `{ title, version: 1, fullDescription, htmlDescription, commentsId: "q_support_issue__cm_<uid>", category, subcategory, subcategory2, files: [{filename, identifier, name, service:"FILE", mimetype, size}], images: [dataURL…], QappName, feeData: {signature}, bountyData: {amount?, crowdfundLink?, coinType, sourceCodeLink} }` | `PublishIssue.tsx:305-318`, `CategoryList.tsx:84-93` |
| Attachment | `FILE` | `q_support_issue_<title[0:30]>_<uid>` (no `_metadata`), `tag1: q_support_issue_`, description `**<cats>**` + text | `PublishIssue.tsx:228-270` |
| Comment | `BLOG_COMMENT` | top: `qcomment_v1_q_support_<issueId[-12:]>_base_<uid>`; reply: `qcomment_v1_q_support_<issueId[-12:]>_reply_<parentId[-6:]>_<uid>`; edit republishes same id; body is the raw UTF-8 text (base64) | `CommentEditor.tsx:210-236`, `Identifiers.ts:11-13` |
| Fee schedule | `DOCUMENT` | name `Q-Support`, identifier `q_support_fees`, JSON `FeePrice[] {time, feeAmount, feeType, coinType}` | `FeeData.tsx:14-16`, `FeePricePublish.ts:8-13,24-29` |
| Playlist (dead) | `PLAYLIST` | `q_support_playlist_<title[0:30]>_<uid>` | `Identifiers.ts:7-9`, `EditPlaylist.tsx:323` |
| Avatars | `THUMBNAIL` | `qortal_avatar` | many |
| Block list | Core list | `blockedNames` | `IssueList.tsx:55`, `BlockedNamesModal.tsx:26,45` |
| Categories | ids | location 1 Core, 2 Legacy UI, 3 Q-Apps/Websites, 4 Hub, 5 Extension, 6 Go, 99 Other; type 11 Bug, 12 Feature, 13 Tech Support, 19 Other; state 101 Open, 102 Closed, 103 In Progress, 104 Complete | `constants/Categories/Categories.ts:21-98` |
| Test switch | | `useTestIdentifiers = false` swaps all prefixes to `MYTEST_…` | `Identifiers.ts:1-13`, `FeeData.tsx:14-16` |

Fee verification (`VerifyPayment.ts:24-101`) checks the `feeData.signature` PAYMENT tx: recipient owns name `Q-Support`, sender is the issue's name owner, amount ≥ fee at that time, timestamp within 10 min of `created` (or between created−10 min and `updated`).

#### 10. Dependency graph (who imports whom, main screens)

```
main.tsx ─ App.tsx ─┬ styles/theme.tsx
                    ├ state/store.ts ─ features/{auth,file,global,notifications}Slice
                    │      file ← constants/PublishFees/SendFeeFunctions (PublishFeeData), utils/qortalRequests (BountyData)
                    ├ constants/PublishFees/FeePricePublish/FeePricePublish.ts  (fetchFeesRedux; ↔ FeeData.tsx TOP-LEVEL AWAIT; ↔ store)
                    ├ components/common/Notification
                    ├ wrappers/DownloadWrapper ─ common/DownloadTaskManager (commented out)
                    └ wrappers/GlobalWrapper ─┬ utils/queue (exports `queue` singleton)
                                              ├ layout/Navbar ─┬ common/BlockedNamesModal
                                              │                ├ common/DownloadTaskManager
                                              │                ├ PublishFees/FeePricePublish/FeeHistoryModal ─ FeeHistoryModalBody ─ DataTable, DataEditor ─ utils/{BoundedNumericTextField,StateTextField}
                                              │                ├ hooks/useWindowSize (result unused)
                                              │                └ PublishIssue/PublishIssue ─┬ common/CategoryList/CategoryList
                                              │                                              ├ common/AutocompleteQappNames
                                              │                                              ├ common/ImagePublisher/{ImagePublisher,ImageUploader}
                                              │                                              ├ common/MultiplePublish/MultiplePublishAll
                                              │                                              ├ common/TextEditor/{TextEditor,utils}
                                              │                                              ├ PublishFees/{FeeData,SendFeeFunctions}
                                              │                                              └ utils/{PublishFormatter,StateCheckBox,utilFunctions,qortalRequests}
                                              ├ EditIssue/EditIssue (same deps + PublishFees/VerifyPayment)
                                              ├ EditPlaylist/EditPlaylist ─ PlaylistListEdit, ImageUploader, TextEditor      [DEAD: never opened]
                                              ├ common/VideoPlayerGlobal (inside react-rnd)                                    [DEAD: never shown]
                                              ├ common/ConsentModal (localforage)
                                              └ common/PageLoader

Routes:
Home ─┬ components/StatsData ─ hooks/useFetchIssues
      ├ common/{AutocompleteQappNames, CategoryList/CategoryList, CategoryList/CategorySelect, LazyLoad}
      ├ hooks/useFetchIssues ─┬ utils/fetchVideos ─ utils/checkStructure
      │                       ├ PublishFees/VerifyPayment ─ VerifyPayment-Functions, FeePricePublish, SendFeeFunctions, FeeData
      │                       ├ utils/qortalRequests (getBountyAmounts)
      │                       └ wrappers/GlobalWrapper (queue)  ← hook imports a component module
      └ IssueList ─┬ common/{BountyDisplay ─ CoinIcon ─ IssueIcon, IssueIcon ─ pages/IssueContent/IssueContent-functions}
                   ├ constants/Categories/CategoryFunctions ↔ Categories (mutual import)
                   └ utils/time

IndividualProfile ─ IssueListComponentLevel ─ (same as IssueList) + hooks/useFetchIssues + PublishFees/VerifyPayment + utils/qortalRequests + LazyLoad

IssueContent ─┬ common/Comments/CommentSection ─ Comment ─ CommentEditor (localforage, utils/qortalRequests.sendQchatDM), common/Portal
              ├ common/Donate/Donate ─ utils/{BoundedNumericTextField,qortalRequests,utilFunctions}, Portal
              ├ common/FileElement ─ wrappers/DownloadWrapper (MyContext)
              ├ common/TextEditor/DisplayHtml (dompurify + quill css)
              ├ common/{BountyDisplay, IssueIcon, CategoryList (helpers)}
              └ PublishFees/VerifyPayment, IssueContent-functions, constants/Categories/*
```

Cross-cutting: `pages/Home/Home-styles.tsx` (`ThemeButton`, `ThemeButtonBright`) is imported by `BlockedNamesModal`, `Comment`, `Donate`, `FeeHistoryModal`, `DataEditor`, `PublishIssue`, `EditIssue`; `PublishIssue-styles.tsx` (`CustomInputField`, `CrowdfundSubTitle*`) by `AutocompleteQappNames`, `CommentSection`, `Playlists`, `PlaylistListEdit`. Styles are copied three times (`PublishIssue-styles.tsx`, `EditIssue-styles.tsx`, `EditPlaylist/Upload-styles.tsx`, ~550 lines each, all named after Q-Fund "Crowdfund").

#### 11. Dead leftovers from the Q-Tube / Q-Fund / Q-Shop forks

| File / symbol | Imported / routed? | Evidence |
|---|---|---|
| `components/Playlists/Playlists.tsx` | **No importer** | grep; navigates to non-existent `/video/…` (`:55`) |
| `components/EditPlaylist/EditPlaylist.tsx` (+ `Upload-styles.tsx`) | Mounted in `GlobalWrapper.tsx:135` | Modal `open={!!editPlaylistProperties}` (`:450`); the only `setEditPlaylist` dispatch is `null` (`:220`) → never opens, but its 625 lines + search fetch + PLAYLIST publish are bundled |
| `components/PlaylistListEdit/PlaylistListEdit.tsx` | Only by `EditPlaylist.tsx:42` | dead by transitivity; searches own issues by title (`:23`) |
| `components/common/VideoPlayer.tsx` (857 lines) | **No importer** | grep |
| `components/common/VideoPlayerGlobal.tsx` | Mounted in `GlobalWrapper.tsx:136-159` inside `<Rnd>` | Shown only when `global.videoPlaying`; the only non-null `setVideoPlaying` dispatches are in dead `VideoPlayer.tsx:257,319` → never shown. `react-rnd` and `ts-key-enum` dependencies exist only for these two files |
| `utils/fetchVideos.ts` | Live (`useFetchIssues.tsx:27`) | Naming leftover (`videoId`, `getVideo`); wraps one `FETCH_QDN_RESOURCE` |
| `utils/checkStructure.ts` | Live via fetchVideos | Always returns `true` (`:1-5`) — no validation of issue JSON |
| `pages/Home/Channels.tsx` + `components/ResponsiveImage.tsx` | **No importer** | Reads `global.publishNames`, never set |
| `utils/extractTextFromSlate.ts` | **No importer** | Slate leftover (app uses Quill) |
| `hooks/useFetchIssues`: `getNewIssues`, `checkNewIssues`, `getIssuesFiltered`, `getAvatar`; `type === "playlists"` branch | Destructured in `Home.tsx:94-103`, `IssueListComponentLevel.tsx:46-47`, `StatsData.tsx:17-26` but never called | file read |
| `fileSlice`: `editPlaylistProperties`, `setEditPlaylist`, `selectedCategoryFiles`, `countNewFiles`, `removeFile`, `addFileToBeginning`, `clearFileList`, `addArrayToHashMap`, `filterType` ("videos"/"playlists") | unused / never read | grep |
| `globalSlice`: `videoPlaying`, `setVideoPlaying`, `publishNames`, `addPublishNames` | dead | grep |
| `IssueContent.tsx`: `checkforPlaylist` (`:171-237`), `playlistData` (`:87`), `videoReference`/`videoCover` (`:92-110`) | dead code paths | file read |
| `PublishIssue.tsx:106-116` playlist state; `filename: "video_metadata.json"` (`:341`) | leftovers (the filename is published metadata; keep for compatibility) | |
| `Identifiers.ts:7-9` `QSUPPORT_PLAYLIST_BASE` | only dead users | grep |
| `assets/svgs/PlaylistSVG.tsx`, `ExpandMoreSVG.tsx`; duplicate `TimesSVG` (`assets/svgs/TimesSVG.tsx` vs `common/ImagePublisher/TimesSVG.tsx`) | unused / duplicated | grep |
| `pages/Home/IssueList-styles.tsx` `StoresRow`, `StoreCardInfo`, `StoreCardOwner`, `StoreCardYouOwn`, `MyStoresRow`, `MyStoresCard`, `MyStoresCheckbox`, `VideoImageContainer`, `VideoCardImage` | Q-Shop/Q-Tube styles, unused | export list |
| `src/App.css`, `assets/react.svg`, `src/test/{download.gif,mockimg.jpg}` | not imported | grep |
| `constants/Misc.ts` `minPriceSuperlike`, `titleFormatterOnSave`, `maxNotificationLength`; `FeeData.tsx` `feeCheckBox`; `PublishFormatter.ts` `publishFormatter`, `uint8ArrayToBase64`, `processFileInChunks`, `objectToUint8Array*`, `base64ToUint8Array`, `uint8ArrayToObject`; `time.ts` `formatTimestamp*`, `formatDateSeconds`; `utilFunctions.ts` `printVar`; `CommentEditor.updateItemDate`; `CategoryList` `appendCategoryToList/getCategoriesLength/hasCategories/appendCategory`; `CategoryFunctions` `findAllCategoryData/getCategoriesWithIcons`; `CategorySelect.getCategoryFromObject` | exported, no caller | grep |

Dependencies with no live user once the dead files go: `react-rnd`, `ts-key-enum`. `moment` is used only for `fromNow()`/duration maths (`utils/time.ts`, `qortalRequests.ts:131`, `BountyDisplay.tsx`).

#### 12. Browser storage keys

No `localStorage`, `sessionStorage` or raw IndexedDB use anywhere in `src` (grep). Theme choice is not persisted. Two localforage (IndexedDB) instances:

| Instance (`createInstance({name})`) | Key | Value | File:line |
|---|---|---|---|
| `q-support-general` | `general-consent` | `true` after the first-run dialog opens | `common/ConsentModal.tsx:11-13,26,30` |
| `notification` | `comments` | `Item[] {id, lastSeen, postId, postName}` (max 10) — written after each comment publish | `common/Comments/CommentEditor.tsx:22-24,35-61,175-180` |
| `notification` | `post-comments` | `{ [postId]: { lastSeen } }` — only touched by `updateItemDate`, which has no caller | `CommentEditor.tsx:62-84` |

Nothing ever reads `comments`/`post-comments` back (the Q-Tube notification bell was not carried over), so the `notification` instance is write-only.

#### 13. Things the map surfaced that other dimensions should pick up
- Toolchain: `DataEditor.tsx:16` `import { s } from "vite/dist/node/types.d-aGj9QkWt"` will break `tsc && vite build` on Vite 8; `FeeData.tsx:17` top-level await against `qortalRequest` blocks boot and breaks any test/dev run without Hub.
- Efficiency: main list, count, both Q-App-name searches, comment replies and AT transaction searches all use `limit: 0`; every issue triggers 4-5 round trips (fetch + payment verification) before it can render; `BountyDisplay` polls forever; `DownloadWrapper` and `FileElement` poll with `setInterval` regardless of visibility.
- Search UX: the Navbar search popover is unreachable and, if reached, shows nothing (`filteredFiles` never populated).
- Layout: 100 px app bar, fixed-width 75 px rows with 280/250/400/200 px columns, 1080 px image row — nothing adapts below ~1200 px.
- Data compatibility anchors to preserve: identifier schemes in §9, the `**cat:…;sub:…;sub2:…;Qapp:…;**` description prefix (it is the server-side filter key), `feeData.signature` + fee verification rules, `SEND_COIN` shapes in `SendFeeFunctions.ts:41-46` and `Donate.tsx:96-101`, inline base64 `images[]`, and `commentsId`/comment identifier derivation from the last 12 chars of the issue id.

</details>

<details>
<summary>Data contract (raw audit notes, 2026-09-29; binding per CLAUDE.md rule 1)</summary>

### Q-Support+ audit — Data contract (BINDING, CLAUDE.md ground rule 1)

Read-only audit of `apps/Q-Support+` at import commit `52bbad3` (upstream Qortal/q-support@5e2833f). All paths below are relative to `apps/Q-Support+/` unless they start with `docs/`. Every claim cites `file:line`. Nothing in this document was produced by running the app; it is from reading the source and the installed `node_modules` (quill 1.3.7, react-quill 2.0.0, dompurify 3.0.6, short-unique-id 4.4.4, quill-image-resize-module-react 3.0.0).

**Summary of what the app touches on QDN (services actually used at runtime): `DOCUMENT` (issues, fee schedule, Q-Fund crowdfund read), `FILE` (attachments), `BLOG_COMMENT` (comments and replies), `THUMBNAIL` (read-only, `qortal_avatar`), `APP` + `WEBSITE` (read-only name listing). `PLAYLIST` appears in code but is dead (see §10).** Chain-side: `SEND_COIN` (publish fee and Q-Fund donations), `SEND_CHAT_MESSAGE` (comment notification DM), Hub lists (`blockedNames`).

---

#### 1. Identifier constants and suffix generation

| Constant | Value (prod) | Value if `useTestIdentifiers` | Where |
|---|---|---|---|
| `QSUPPORT_FILE_BASE` | `q_support_issue_` | `MYTEST_support_issue_` | `src/constants/Identifiers.ts:3-5` |
| `QSUPPORT_PLAYLIST_BASE` | `q_support_playlist_` | `MYTEST_support_playlist_` | `Identifiers.ts:7-9` |
| `QSUPPORT_COMMENT_BASE` | `qcomment_v1_q_support_` | `qcomment_v1_MYTEST_support_` | `Identifiers.ts:11-13` |
| `FEE_BASE` | `q_support_fees` | `MYTEST_support_fees` | `src/constants/PublishFees/FeeData.tsx:14-16` |
| `useTestIdentifiers` | `false` | — | `Identifiers.ts:1` (**must stay `false`**) |
| `appName` / `feeDestinationName` | `"Q-Support"` / `"Q-Support"` | — | `FeeData.tsx:11-12` (**must stay `"Q-Support"`; see §7**) |

Random suffixes: every module creates `const uid = new ShortUniqueId()` with default options (`PublishIssue.tsx:66`, `EditIssue.tsx:58`, `CommentEditor.tsx:322`, `EditPlaylist.tsx:50`). short-unique-id 4.4.4 default length is **6** alphanumeric chars (`node_modules/short-unique-id/dist/short-unique-id.js:36,41`). A second `shortuid` (length 5) is declared but never used (`PublishIssue.tsx:67`, `EditIssue.tsx:59`). No hashing (no `publicSalt`, no qapp-core) anywhere in this app.

`sanitizeTitle` (used only inside identifiers): `title.replace(/[^a-zA-Z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").trim().toLowerCase()` then `.slice(0, 30)` (`PublishIssue.tsx:210-215,228,282`; `EditIssue.tsx:235-240,256`).

---

#### 2. Issue = `DOCUMENT` resource (the primary record)

##### 2.1 Identity
- **service:** `DOCUMENT` (`PublishIssue.tsx:335`, `EditIssue.tsx:364`)
- **name:** the publishing user's primary name (`PublishIssue.tsx:188-189,334`; obtained via `GET_USER_ACCOUNT` + `GET_PRIMARY_NAME` in `src/wrappers/GlobalWrapper.tsx:77-95`)
- **identifier:** `q_support_issue_<sanitizeTitle[0:30]>_<uid6>_metadata` (`PublishIssue.tsx:281-282,339`). Max length 16+30+1+6+9 = 62 ≤ 64. On edit the **same identifier** is republished (`EditIssue.tsx:368`, `identifier: editIssueProperties.id`), so the latest version wins.
- **tag1:** `q_support_issue_` (`PublishIssue.tsx:340`; `EditIssue.tsx:369`). Tags are never searched by the app.
- **filename:** `video_metadata.json` (`PublishIssue.tsx:341`, `EditIssue.tsx:370`) — Q-Tube leftover, never read back. Keep as is (harmless, and identical behaviour).
- **title (metadata):** `title.slice(0, 50)` (`PublishIssue.tsx:337`). The JSON keeps the full title (max 60 chars on publish `PublishIssue.tsx:548`, but 180 on edit `EditIssue.tsx:568` — inconsistent upstream).
- Published through `PUBLISH_MULTIPLE_QDN_RESOURCES` with the FILE resources first and the DOCUMENT last (`PublishIssue.tsx:347-350`, `src/components/common/MultiplePublish/MultiplePublishAll.tsx:41-45`, timeout = resources × 30 s).

##### 2.2 Metadata `description` encoding (this is what search filters match on)
Built at `PublishIssue.tsx:318-323` and `EditIssue.tsx:348-353`:

```
"**" + getCategoriesFetchString(categories) + getQappNameFetchString(QappName) + "**" + fullDescription.slice(0,150)
```
- `getCategoriesFetchString` (`src/components/common/CategoryList/CategoryList.tsx:292-303`): index 0 → `cat:<id>;`, index 1 → `sub:<id>;`, index n≥2 → `sub<n>:<id>;`. Empty entries are skipped.
- `getQappNameFetchString` (`src/components/common/AutocompleteQappNames.tsx:652-654`): `Qapp:<name>;` or `""`.
- Example: `**cat:3;sub:11;sub2:101;Qapp:Q-Tube;**Video will not play when …`
- The 150-char text after `**…**` is `extractTextFromHTML(htmlDescription)` — plain text with block tags replaced by spaces, whitespace collapsed (`src/components/common/TextEditor/utils.ts:92-104`).
- Core caps description at 240 chars; the code logs "characters left: 240 − len" (`PublishIssue.tsx:325-329`) but does not truncate the whole string, so a long `Qapp:` name plus 150 chars of text can exceed 240 (bug to watch, not a contract change).
- **The app never parses `**…**` back out of `description`** (grep: only a commented-out parser in `src/components/EditPlaylist/EditPlaylist.tsx:100-144`). It is used purely as a Core search key.

Category ids used in the encoding (`src/constants/Categories/Categories.ts`):
- level 0 "Issue Location": 1 Core, 2 Legacy UI, 3 Q-Apps/Websites, 4 Qortal Hub, 5 Qortal Extension, 6 Qortal Go, 99 Other (`Categories.ts:48-92`)
- level 1 "Issue Type": 11 Bug Report, 12 Feature Request, 13 Tech Support, 19 Other (`Categories.ts:95-110`)
- level 2 "Issue State": 101 Open, 102 Closed, 103 In Progress, 104 Complete (`Categories.ts:116-121`). Level 2 defaults to `"101"` when not chosen (`PublishIssue.tsx:477-486`).
- `"3"` (Q-Apps/Websites) is the magic id that makes `QappName` required (`PublishIssue.tsx:180-185`, `EditIssue.tsx:205-210`).

##### 2.3 JSON payload (`data64` = base64 of `JSON.stringify(issueObject)`, `src/utils/PublishFormatter.ts:451-478`)
Built at `PublishIssue.tsx:305-317` (edit: `EditIssue.tsx:318-330,344`):

| Field | Type | Optional | Notes |
|---|---|---|---|
| `title` | string | no | full title, `titleFormatter` applied (`src/constants/Misc.ts:17`) |
| `version` | number | no | always `1` (`PublishIssue.tsx:307`); edit copies the stored value (`EditIssue.tsx:320`) |
| `fullDescription` | string | no | **plain text, at most 150 chars** — `extractTextFromHTML(description)` uses the default `length = 150` (`utils.ts:92`, called at `PublishIssue.tsx:222`). Used as the display fallback when `htmlDescription` is absent (`IssueContent.tsx:460-472`) and as the edit fallback (`EditIssue.tsx:158-160`). |
| `htmlDescription` | string | no (in practice) | **raw Quill 1 HTML** from `ReactQuill.onChange`, i.e. `editor.root.innerHTML` (`node_modules/react-quill/lib/index.js:87,311`), **not sanitized on write**. See §12. |
| `commentsId` | string | no | `q_support_issue__cm_<uid6>` (`PublishIssue.tsx:310`, note the double underscore). **Never read anywhere**; comments use a different scheme (§6). Keep writing it. |
| `category` | string | no | level-0 id as a string, e.g. `"3"` (`CategoryList.tsx:84-93` `categoriesToObject`) |
| `subcategory` | string | no | level-1 id, e.g. `"11"` |
| `subcategory2` | string | no | level-2 id, e.g. `"101"` (index ≥2 → `subcategory<n>`) |
| `files` | `FileReference[]` | no (may be `[]`) | see §3 |
| `images` | `string[]` | yes (`undefined` when none, `[]` after edit clears) | data URLs, see §4 |
| `QappName` | string \| null \| undefined | yes | selected Q-App/Website name (`PublishIssue.tsx:286,314`) |
| `feeData` | `{ signature?: string }` | no | §7. `signature` is the `SEND_COIN` tx signature; if the user declined, `signature` is `undefined` and `JSON.stringify` drops it → `feeData: {}` (`PublishIssue.tsx:288-296`). Edit: kept from the stored issue unless "Publish Edit with Fee" (`EditIssue.tsx:328,331-346`). |
| `bountyData` | `BountyData` | no | §8 |

The `Issue` TS interface in `src/state/features/fileSlice.ts:36-53` only covers the search-result half; the JSON half is untyped (`any`).

##### 2.4 Read path and the merged in-memory shape
- Search rows are mapped to `{ title: metadata.title, service, category: metadata.category (Core's own category, always undefined here), categoryName, tags: metadata.tags||[], description: metadata.description, created, updated, user: name, videoImage: "", id: identifier }` (`src/hooks/useFetchIssues.tsx:156-169, 252-266, 335-348`; `IssueContent.tsx:129-140`; `IssueListComponentLevel.tsx:340-353`).
- Then `FETCH_QDN_RESOURCE {name, service: content.service||"DOCUMENT", identifier}` and the JSON is spread **over** the search row (`src/utils/fetchVideos.ts:456-469`), so JSON `category`/`title` win, and `isValid: true` is added. `checkStructure` always returns true (`src/utils/checkStructure.ts:660-664`), so any JSON is accepted.
- List reads (all direct `fetch('/arbitrary/resources/search?…')`):
  - Home list: `mode=ALL&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=<n>&limit=<0 unless given>&service=DOCUMENT&identifier=q_support_issue_` plus optional `&name=<exact user>`, `&description=<cat:…;sub:…;>` or `&description=:<id>;` (single-level filter, `Home.tsx:113-114`), `&query=Qapp:<Name>;` and/or `&query=<keywords>` (`useFetchIssues.tsx:214-243`). Note two `query=` params can be emitted together (`useFetchIssues.tsx:227-233`).
  - Navbar search: `service=DOCUMENT&query=<text with spaces→_>&identifier=q_support_issue_&limit=10` (`useFetchIssues.tsx:312`).
  - New-issue poll / count: `service=DOCUMENT&query=q_support_issue_&limit=20` (`useFetchIssues.tsx:123,368`) and `limit=0&service=DOCUMENT&identifier=q_support_issue_` for the stats counter (`useFetchIssues.tsx:407`).
  - Profile page: `service=DOCUMENT&query=q_support_issue__&name=<name>&limit=50` (`IssueListComponentLevel.tsx:331`; note the trailing `_` in `query`).
  - Single issue: `service=DOCUMENT&query=q_support_issue_&limit=1&includemetadata=true&name=<name>&exactmatchnames=true&identifier=<id>` then `FETCH_QDN_RESOURCE` (`IssueContent.tsx:118-147`).
- Route/deep link: `/issue/:name/:id` (`src/App.tsx:735`), and the DM link `qortal://APP/Q-Support/issue/<name>/<id>` (`CommentEditor.tsx:436-437`).

---

#### 3. Attached files = `FILE` resources

- **service:** `FILE`; **name:** the publisher; **identifier:** `q_support_issue_<sanitizeTitle[0:30]>_<uid6>` — same base as the issue but a *different* uid and **no `_metadata` suffix** (`PublishIssue.tsx:226-228`, `EditIssue.tsx:254-256`).
- Publish body: `{ action: "PUBLISH_QDN_RESOURCE", name, service: "FILE", file: File, title: title.slice(0,50), description: "**" + selectedCategories + "**" + fullDescription.slice(0,150), identifier, filename, tag1: "q_support_issue_" }` (`PublishIssue.tsx:259-269`). **Note** the FILE description packs the categories as the array's `toString()`, e.g. `**3,11,101**…` (`PublishIssue.tsx:256`), unlike the DOCUMENT's `cat:…;` form.
- `filename` on QDN: first 15 chars of the base name, whitespace→`_`, non-alphanumerics stripped, original extension re-appended (`PublishIssue.tsx:230-254`).
- Limits: up to 10 files, 400 MB each (`PublishIssue.tsx:126-128`).
- **How the list is stored:** in the issue JSON `files: FileReference[]` where `FileReference = { filename: <original File.name>, identifier, name, service: "FILE", mimetype: File.type, size: File.size }` (`PublishIssue.tsx:271-278`). On edit, existing entries (those with `identifier`) are carried over untouched and only new drops are published (`EditIssue.tsx:248-252`). Removing a file from the edit list drops the reference only; the FILE resource stays on QDN.
- Read: `IssueContent.tsx:501-541` renders `file.filename`, `file.size`, and `FileElement` with `{...file, mimeType: file.mimetype}`; download = `GET_QDN_RESOURCE_PROPERTIES` → `GET_QDN_RESOURCE_URL` → poll `GET_QDN_RESOURCE_STATUS` every 5 s (`src/wrappers/DownloadWrapper.tsx:208-346`), then `fetch('/arbitrary/FILE/<name>/<identifier>')` → `SAVE_FILE {blob, filename, mimeType}` (`src/components/common/FileElement.tsx:114-137`).

---

#### 4. Images: inline base64 in the issue JSON (no THUMBNAIL/IMAGE resource)

- Up to 3 images (`src/components/common/ImagePublisher/ImageUploader.tsx:98`), each compressed with Compressor.js to **`image/webp`, quality 0.6, maxWidth 1200** (`ImageUploader.tsx:103-106`), converted with `FileReader.readAsDataURL` (`ImageUploader.tsx:78-86`), and stored as **`images: string[]` of `data:image/webp;base64,…` URLs** inside the DOCUMENT JSON (`PublishIssue.tsx:313`, `ImagePublisher.tsx:27-34`).
- Read: `IssueContent.tsx:397-414` renders `<img src={image}>` directly. Edit pre-fills from `editIssueProperties.images` (`EditIssue.tsx:554-557`).
- Consequence for the + app: the DOCUMENT payload can be several hundred KB; any change (e.g. moving images to a THUMBNAIL/IMAGE resource) would be a **new, additive** field only; `images` must keep being written for the original app.
- The app never publishes to `THUMBNAIL`. `THUMBNAIL` is only *read* for avatars (§9).

---

#### 5. Body HTML from Quill: also inline images

The toolbar has no `image` button (`src/components/common/TextEditor/TextEditor.tsx:13-27`), but Quill 1's clipboard accepts pasted/dragged images and its Image blot allows `data:image/…;base64` sources (`node_modules/quill/dist/quill.js:10833`), and the registered `imageResize` module sets `img.width` on resize (`node_modules/quill-image-resize-module-react/src/modules/Resize.js:88-91`). So `htmlDescription` may contain `<img src="data:image/png;base64,…" width="NNN">`. DOMPurify keeps `img`, `src` data URIs (`DEFAULT_DATA_URI_TAGS` includes `img`, `purify.es.js:497`) and `width`, so these render in both apps.

---

#### 6. Comments and replies = `BLOG_COMMENT` resources (plain text, not Quill)

`CommentEditor.tsx` is a plain MUI multiline `TextField` (`CommentEditor.tsx:547-559`); **no Quill, no HTML** in comments.

##### 6.1 Identifiers (`src/components/common/Comments/CommentEditor.tsx:512-531`)
Let `P = postId.slice(-12)` where `postId` is the issue identifier (route `:id`, `IssueContent.tsx:553`). Because the issue id ends in `_<uid6>_metadata`, **`P` is the last 3 chars of the uid + `_metadata`** (e.g. `xyz_metadata`). That is the real, deployed contract; keep it exactly.
- Top-level comment: `qcomment_v1_q_support_<P>_base_<uid6>` (`CommentEditor.tsx:516`)
- Reply: `qcomment_v1_q_support_<P>_reply_<last 6 chars of the parent comment id = parent uid>_<uid6>` (`CommentEditor.tsx:519-526`; the `replace("_base_","")` on line 521 discards its result, so it has no effect)
- Edit: republish under the **same identifier** (`CommentEditor.tsx:527-529`)
- Length: 22 + 12 + 6 + 6 = 46 (base) / 22+12+7+6+1+6 = 54 (reply) ≤ 64.

##### 6.2 Data
- `PUBLISH_QDN_RESOURCE { name: user.name, service: "BLOG_COMMENT", data64: utf8ToBase64(text), identifier }` (`CommentEditor.tsx:462-468`). `utf8ToBase64` = `btoa(unescape-style UTF-8)` (`CommentEditor.tsx:397-407`). **No title/description/tags/filename** on comments. Max 10 000 chars (`src/constants/Misc.ts:26`, `CommentEditor.tsx:447`).
- Read: search `/arbitrary/resources/search?mode=ALL&service=BLOG_COMMENT&query=qcomment_v1_q_support_<P>_base_&limit=20&includemetadata=false&offset=<n>&reverse=false&excludeblocked=true` then `fetch('/arbitrary/BLOG_COMMENT/<name>/<identifier>')` as **text** per comment (`CommentSection.tsx:722-749`); replies per comment: `query=qcomment_v1_q_support_<P>_reply_<parent uid>&limit=0` (`CommentSection.tsx:677-699`). Rendered as plain text with `white-space: pre-wrap` (`Comment.tsx:242`, `Comments-styles.tsx:364-372`).
- Threading is by identifier substring: a row whose id contains `_reply_` is a reply; replies attach to the comment whose `identifier.slice(-6)` appears after `_reply_` (`CommentSection.tsx:773-786`).
- In-memory comment object: `{ created, identifier, message, service: "BLOG_COMMENT", name }` (`CommentEditor.tsx:532-538`); from search: the search row + `message`.

##### 6.3 Side effects on a new top-level comment
- `SEND_CHAT_MESSAGE { destinationAddress: <owner of postName via GET_NAME_DATA>, message: "This is an automated Q-Support notification … qortal://APP/Q-Support/issue/<name>/<id>" }`, skipped when the commenter is the author (`src/utils/qortalRequests.ts:194-216`, `CommentEditor.tsx:436-439,484-486`). Not for replies/edits. (With `useTestIdentifiers` it would fire before validation, `CommentEditor.tsx:439`.) **Open question for the brief:** whether the + app's DM should link to `qortal://APP/Q-Support+/…` (docs/QORTAL.md says link to + versions) or keep `Q-Support` so recipients without Q-Support+ can open it.
- Local-only bookkeeping in localforage instance `notification`, key `comments` (`Item[] = {id, lastSeen, postId, postName}`, max 10) via `addItem` (`CommentEditor.tsx:324-363,476-483`); `updateItemDate` (key `post-comments`) is exported but never called. Nothing reads `comments` back in this app.

---

#### 7. Publish-fee records (FeeData, FeePricePublish, SendFeeFunctions, VerifyPayment)

##### 7.1 Fee schedule resource (read by everyone, written only by the owner of name `Q-Support`)
- **Read:** `FETCH_QDN_RESOURCE { name: "Q-Support", service: "DOCUMENT", identifier: "q_support_fees" }` (`src/constants/PublishFees/FeePricePublish/FeePricePublish.ts:24-29`; name literal `"Q-Support"` at line 27, identifier `FEE_BASE`). Cached in Redux `global.feeData` (`FeePricePublish.ts:18-21,38-45`). It is fetched at **module load time via top-level `await`** (`FeeData.tsx:17`), i.e. before React renders.
- **JSON:** `FeePrice[]` = `[{ time: number (ms epoch), feeAmount: number, feeType: "default"|"comment"|"like"|"dislike"|"superlike", coinType: "QORT"|"BTC"|"LTC"|"DOGE"|"DGB"|"RVN"|"ARRR" }]`, ordered by time; the current price is the **last** matching row (`FeePricePublish.ts:8-13,47-59`), the price at a past time is the last row with `time <= t` (`FeePricePublish.ts:61-81`).
- **Write:** `PUBLISH_QDN_RESOURCE { name: "Q-Support", identifier: "q_support_fees", service: "DOCUMENT", data64 }` from the `DataEditor`, shown only when `userHasName("Q-Support")` (`FeePricePublish/DataEditor.tsx:303-319`, `FeeHistoryModalBody.tsx:148-165`). No title/description/tags. Because the + app is published under a different name, this editor can never appear for a Q-Support+ user unless they own `Q-Support`; **keep the name literal so the + app reads the same schedule.**

##### 7.2 Paying the fee (issue publish, optional on edit)
- `payPublishFeeQORT("default","QORT")` → `fetchCurrentPriceData` → `sendQORTtoName("Q-Support", feeAmount)` → `GET_NAME_DATA {name:"Q-Support"}` → `SEND_COIN { coin:"QORT", destinationAddress: <owner of Q-Support>, amount }` (`src/constants/PublishFees/SendFeeFunctions.ts:73-78,93-118,137-144`). Returns the tx `signature`, or `undefined` if the user refused (`sendCoin` swallows the error, `SendFeeFunctions.ts:105-107`).
- Publish: checkbox "I agree to pay a fee of <amount> QORT" defaults **on** (`PublishIssue.tsx:567-571`); fee is sent **before** the QDN publish (`PublishIssue.tsx:290-296`), and the issue is still published if the coin send was refused (`signature: undefined`). Edit: "Publish Edit with Fee" only when the issue verifies as unpaid; a refusal aborts the edit (`EditIssue.tsx:331-346,604-619`).
- **Nothing is published to QDN for the fee itself**; the only on-chain record is the PAYMENT tx, and the only QDN record is `feeData.signature` inside the issue JSON. `PublishFeeData` fields other than `signature` (`senderName`, `createdTimestamp`, `updatedTimestamp`, `feeType`, `coinType`, `isPaid`, `SendFeeFunctions.ts:120-128`) are **derived at read time**, never stored.
- **Bounty payments keep exactly this behaviour** (per the task): same recipient resolution, same amount source, same "fee first, then publish", same refusal handling.

##### 7.3 Verification (read side; decides the QORT badge)
`verifyPayment(issue)` (`src/constants/PublishFees/VerifyPayment.ts:232-245`) builds `{ signature: feeData.signature, createdTimestamp: +created, updatedTimestamp: +updated||0, feeType: feeData.feeType||"default", coinType: feeData.coinType||"QORT", senderName: user, isPaid }` (`VerifyPayment-Functions.ts:326-338`), returns false if any value is `null`/`undefined`, then:
- `fetch('/transactions/signature/<sig>')` (`VerifyPayment.ts:156-166`), `GET_NAME_DATA(senderName)`, `GET_ACCOUNT_NAMES(tx.recipient)` (`VerifyPayment-Functions.ts:295-313`), `verifyFeeAmount` against the schedule at `tx.timestamp`;
- passes when: tx time within ±10 min of `created` (or between `created−10min` and `updated` if edited, `maxFeePublishTimeDiff`, `FeeData.tsx:33`, `VerifyPayment.ts:191-207`), `tx.creatorAddress === owner(senderName)`, one of the recipient's names is `"Q-Support"`, and `tx.amount >= scheduled fee` (`VerifyPayment.ts:209-229`).
- Result is attached in memory only as `feeData.isPaid` (`VerifyPayment.ts:247-255`); it is called for every issue on every list load (`useFetchIssues.tsx:284-287`, `IssueListComponentLevel.tsx:378`, `IssueContent.tsx:155,244`, `EditIssue.tsx:163`).

---

#### 8. Bounty / Q-Fund data

##### 8.1 Stored: `bountyData` in the issue JSON (`PublishIssue.tsx:298-304`, `EditIssue.tsx:310-316`, type at `src/utils/qortalRequests.ts:218-223`)
| Field | Type | When |
|---|---|---|
| `amount` | number \| undefined | when the "Bounty Amount or Q-Fund Link" input is numeric (`isNumber`, `src/utils/utilFunctions.ts:642-646`) |
| `crowdfundLink` | string \| undefined | when it is not numeric: expected `qortal://APP/Q-Fund/crowdfund/<name>/<identifier>` — parsed by `split("/")[5]` = name, `[6]` = identifier (`qortalRequests.ts:251-262`) |
| `coinType` | `CoinType` | selected coin; forced to `"QORT"` for links (`PublishIssue.tsx:511-517`); `supportedCoins` sorted list at `FeeData.tsx:22-32` |
| `sourceCodeLink` | string | free text ≤200 chars (`PublishIssue.tsx:498-505`) |

`undefined` members are dropped by `JSON.stringify`. `validateBountyInput` accepts any number, or any link whose Q-Fund DOCUMENT fetch succeeds — it checks `crowdfund.aTAddress !== ""` on the top level, which is `undefined !== ""` (always true), so it does not really validate (`qortalRequests.ts:371-383`; bug, behaviour to preserve or fix additively).

##### 8.2 Q-Fund crowdfund read (foreign data, read-only)
- `FETCH_QDN_RESOURCE { service: "DOCUMENT", name, identifier }` from the link (`qortalRequests.ts:251-262`); fields used: `deployedAT.aTAddress` (`qortalRequests.ts:225-227,298-301,322-325`). This is Q-Fund's own JSON; the app must not write it.
- AT state: `fetch('/at/<atAddress>')` → `sleepUntilHeight`, `isFinished` (`qortalRequests.ts:264-280,327-342`; `Donate.tsx:283-300`), `fetch('/blocks/height')` (`qortalRequests.ts:282-296`), `GET_DAY_SUMMARY` for blocks/day (`qortalRequests.ts:365-369`), raised amount via `SEARCH_TRANSACTIONS { txType:["PAYMENT"], confirmationStatus:"CONFIRMED", address: atAddress, limit: 0, reverse: true }` summed (`qortalRequests.ts:229-244`). `getBountyAmounts` overwrites `bountyData.amount` in memory with the AT total for crowdfund issues and **drops `crowdfundLink`/`sourceCodeLink` from the in-memory copy** (`qortalRequests.ts:385-408`, `appendBountyAmount`) — lists merge it back from the hash map (`IssueList.tsx:114-117`).
- `BountyDisplay` re-runs all of the above on a `setInterval(…, 60_001)` per rendered row that is never cleared (`src/components/common/BountyDisplay.tsx:62-65`).

##### 8.3 Donation (chain write, no QDN write)
`Donate.tsx:321-326`: `SEND_COIN { coin: "QORT", destinationAddress: <AT address>, amount }` after re-checking `/at/<addr>` is not finished and more than 4 blocks remain (`Donate.tsx:277-320`). Whole-QORT amounts, min 1, max = balance (`Donate.tsx:439-449`; balance via `GET_BALANCE`, `qortalRequests.ts:410-420`).

---

#### 9. Avatar (`THUMBNAIL` / `qortal_avatar`, read-only)
- `GET_QDN_RESOURCE_URL { name, service: "THUMBNAIL", identifier: "qortal_avatar" }`: logged-in user (`GlobalWrapper.tsx:44-73`, cached in `global.userAvatarHash`), every comment and reply card (`Comment.tsx:202-219`), and **the selected Q-App's avatar used as the issue icon** when `QappName` is set (`IssueContent-functions.ts:568-581`, `qortalRequests.ts:422-429`, via `IssueIcon.tsx:197-205` on every list row and the issue page).
- Direct `<img src="/arbitrary/THUMBNAIL/<name>/qortal_avatar">` in lists and headers (`IssueList.tsx:238`, `IssueListComponentLevel.tsx:519`, `IssueContent.tsx:346`, `IndividualProfile.tsx:609`).
- `useFetchIssues.getAvatar` (`useFetchIssues.tsx:72-90`) is defined but never called. The app never publishes an avatar.

---

#### 10. Playlists (`PLAYLIST`) — present in code, **dead at runtime**
- Write path `EditPlaylist.tsx:325-336`: `PUBLISH_QDN_RESOURCE { name, service: "PLAYLIST", identifier: q_support_playlist_<sanitizeTitle[0:30]>_<uid6> (or existing id), title: title.slice(0,50), description: "**category:<id>;subcategory:<id>;c:<code>;…**" + text.slice(0,120), tag1: "q_support_issue_", data64 }` with JSON `{ title, version: 1, description, htmlDescription, image: string[] (data URLs), videos: [{identifier, name, service, code}], commentsId: q_support_playlist__cm_<uid6>, category, subcategory }` (`EditPlaylist.tsx:301-316`).
- The modal only opens when `file.editPlaylistProperties` is non-null, and the only dispatch is `setEditPlaylist(null)` (`EditPlaylist.tsx:219`; grep finds no other caller). `filterType` is only ever set to `"videos"` (`Home.tsx:188`), so the `type === "playlists"` search branch (`useFetchIssues.tsx:234-236`) never runs. `IssueContent.checkforPlaylist` needs `issue.code`, which issues never have (`IssueContent.tsx:160,171-173`). `Playlists.tsx` is imported nowhere.
- Verdict: no PLAYLIST data exists for this app on QDN; the + app may remove the UI (record it in the brief per ground rule 6) but must not reuse the `q_support_playlist_` prefix for anything else.

---

#### 11. Other reads and Hub-local state
- Q-App/Website names for the autocomplete: `SEARCH_QDN_RESOURCES { service: "APP", limit: 0 }` and `{ service: "WEBSITE", limit: 0 }`, names deduped and sorted (`AutocompleteQappNames.tsx:628-650`), fetched on Home mount (`Home.tsx:87-92`) and again inside the component when no list is passed (`AutocompleteQappNames.tsx:560-571`). Stored in `file.publishedQappNames`.
- Auth: `GET_USER_ACCOUNT` → `{address, publicKey}`, `GET_PRIMARY_NAME {address}` (`GlobalWrapper.tsx:77-95`); `GET_ACCOUNT_NAMES {address}` (`VerifyPayment-Functions.ts:295-318`).
- Hub lists (shared across all Q-Apps, keep the list name): `ADD_LIST_ITEMS { list_name: "blockedNames", items:[user] }` (`IssueList.tsx:49-65`, refuses to block `"Q-Support"`), `GET_LIST_ITEMS` / `DELETE_LIST_ITEM` (`BlockedNamesModal.tsx:240-269`). Searches pass `excludeblocked=true`.
- Stats: `limit=0` search over all issues to count issues and distinct names (`useFetchIssues.tsx:405-430`).
- localStorage/localforage: only the `notification` localforage store (§6.3). Theme is React state only (`App.tsx:720`), not persisted.

---

#### 12. Issue body HTML: exactly how it is stored and rendered (Quill 1 → Quill 2 risk)

##### 12.1 Storage
- `htmlDescription` = the string react-quill 2.0.0 passes to `onChange`, which is **`editor.root.innerHTML`** of Quill 1.3.7 (`node_modules/react-quill/lib/index.js:87`, `TextEditor.tsx:29-37`). **No sanitization, no transformation on write** (`PublishIssue.tsx:309`, `EditIssue.tsx:322`). Empty editor gives `<p><br></p>`.
- `fullDescription` = 150-char plain-text extract (§2.3).
- **DOMPurify runs only on read**, in `DisplayHtml` (`src/components/common/TextEditor/DisplayHtml.tsx:58-67`): `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`, then `convertQortalLinks` wraps bare `qortal://…` text in `<a href className="qortal-link">` (`utils.ts:79-90`; note `className` is not a valid HTML attribute, so the `.qortal-link` CSS in `src/index.css:168-174` never applies). DOMPurify 3.0.6 keeps `class`, `style`, `width`, `data-*` (`ALLOW_DATA_ATTR = true`, `purify.es.js:422`) and `data:` URIs on `img` (`purify.es.js:497`), so everything Quill 1 emits survives.
- Rendering: `<div class="ql-editor" dangerouslySetInnerHTML>` inside a `Box` (`DisplayHtml.tsx:71-76`), with Quill's **snow, core and bubble stylesheets imported globally** (`DisplayHtml.tsx:41-43`, `TextEditor.tsx:3`) plus the app's own `.ql-editor { min-height: 100px; width: 100% } .ql-editor img { cursor: default } .ql-container { font-size: 16px }` (`src/index.css:213-224`). No other app CSS targets `ql-*`.

##### 12.2 Exact Quill configuration
`TextEditor.tsx:8-28`, theme `snow`, modules:
- `imageResize: { parchment: Quill.import("parchment"), modules: ["Resize", "DisplaySize"] }` via `Quill.register("modules/imageResize", ImageResize)` from `quill-image-resize-module-react` 3.0.0 (Quill 1 only; needs a Quill 2 replacement such as `quill-resize-image` or dropping resize — resize only sets the `width` attribute, so stored content is unaffected).
- toolbar: `bold italic underline strike` | `blockquote code-block` | `header:1 header:2` | `list:ordered list:bullet` | `script:sub script:super` | `indent:-1 indent:+1` | `direction:rtl` | `size: [small,false,large,huge]` | `header:[1..6,false]` | `color:[] background:[]` | `font:[]` | `align:[]` | `clean`.
- No `formats` whitelist, so Quill also accepts pasted `link`, `image`, `video` (`<iframe class="ql-video">`) and `code` (inline).
- `CommentEditor.tsx` uses **no Quill** (§6).

##### 12.3 Markup Quill 1.3.7 writes for these formats (from `node_modules/quill/dist/quill.js`), i.e. what existing issues on QDN contain
| Format | DOM (Quill 1) | Ref |
|---|---|---|
| bold / italic / underline / strike | `<strong>`, `<em>`, `<u>`, `<s>` | `quill.js:9311,10610,10754,10714` |
| sub/superscript | `<sub>`, `<sup>` | `quill.js:10674` |
| header | `<h1>…<h6>` | `quill.js:10373` |
| blockquote | `<blockquote>` | `quill.js:10324` |
| code-block | `<pre class="ql-syntax" spellcheck="false">` | `quill.js:2413,11122` |
| list | `<ol><li>` / `<ul><li>`; nesting via `class="ql-indent-N"` on `<li>` | `quill.js:10465-10484,10567` |
| indent | `class="ql-indent-1…9"` (block) | `quill.js:10281-10282` |
| align | `class="ql-align-center|right|justify"` | `quill.js:6292` |
| direction | `class="ql-direction-rtl"` | `quill.js:6353` |
| size | `class="ql-size-small|large|huge"` | `quill.js:6437` |
| font | `class="ql-font-serif|monospace"` | `quill.js:6393` |
| color / background | **inline `style="color: …"` / `style="background-color: …"`** (StyleAttributors, not classes) | `quill.js:10176-10177` |
| image | `<img src="data:…" width="N">` | §5 |
CSS class names the stored content depends on, all present in `node_modules/react-quill/dist/quill.snow.css`: `ql-editor`, `ql-align-center/right/justify`, `ql-indent-1..9`, `ql-size-small/large/huge`, `ql-font-serif/monospace`, `ql-direction-rtl`, `ql-syntax`, `ql-video`, plus `.ql-editor ol/ul/li` counters (`quill.snow.css:49-108`).

##### 12.4 What changes with react-quill-new / Quill 2 (verify against the installed package at upgrade time; no Quill 2 is installed in this repo yet — `Q-Tube+`, `Q-Mail+`, `Q-Share+`, `Q-Fund+` have no `node_modules`)
Known Quill 2.0 differences that affect *round-tripping* (Quill 2 release notes):
1. **Lists:** the editor DOM is `<ol><li data-list="bullet">` / `<li data-list="ordered">` for both list kinds; bullets are drawn by Quill 2 CSS (`li[data-list=bullet] > .ql-ui::before`). If `htmlDescription` is saved from `root.innerHTML`, the **original Q-Support (Quill 1 CSS) will show bullets as numbered lists and lose `ql-ui` markers**. Quill 2 also emits an inner `<span class="ql-ui" contenteditable="false">` per `<li>`.
2. **Code blocks:** `<div class="ql-code-block-container" spellcheck="false"><div class="ql-code-block">…</div></div>` instead of `<pre class="ql-syntax">`; the original app's CSS would show it as plain divs.
3. Quill 2 *reads* Quill 1 HTML fine (it still parses `<ul>/<ol>`, `<pre>`, `ql-*` classes), so **existing issues open correctly in the + editor**; the risk is only in what the + app writes.
4. `quill.getSemanticHTML()` (Quill 2) emits `<ul>/<ol>` and `<pre>` again, but drops `ql-indent`/`ql-align` classes in favour of inline styles in some versions — must be checked.
**Binding requirement:** whatever the + app stores in `htmlDescription` must render correctly under Quill 1's `quill.snow.css` + `.ql-editor` in the original app. Recommended approach (to be decided in the plan, not here): keep `htmlDescription` in the Quill 1 dialect by post-processing the Quill 2 output before publish (rewrite `li[data-list=bullet]` groups to `<ul>`, `ordered` to `<ol>`, strip `span.ql-ui`, rewrite `ql-code-block-container` to `<pre class="ql-syntax">`), and make `DisplayHtml` in the + app tolerant of both dialects. Add tests with real Quill-1 samples in both directions. Additive alternative: write a new field (e.g. `htmlDescriptionV2`) and keep `htmlDescription` Quill-1-compatible — still requires the conversion.

---

#### 13. Bugs and quirks that touch the data contract (do not "fix" silently; keep or fix additively and record in the brief)
1. `fullDescription` is truncated to 150 chars on write (`utils.ts:92`, `PublishIssue.tsx:222`); legacy issues without `htmlDescription` therefore only ever had 150 chars of text.
2. `feeData: {}` is written when the fee send is refused (`PublishIssue.tsx:290-296`), so `feeData.signature` is optional in practice.
3. Comment id key uses `postId.slice(-12)` = `<3 chars>_metadata` (`CommentEditor.tsx:516`); collisions between issues whose uids share the last 3 chars are possible and are part of the existing contract.
4. `validateBountyInput` cannot reject a bad Q-Fund link (`qortalRequests.ts:371-383`).
5. Two `query=` params when both a Q-App filter and keywords are set (`useFetchIssues.tsx:227-233`).
6. FILE description packs categories as `**3,11,101**`, DOCUMENT as `**cat:3;sub:11;sub2:101;**` (`PublishIssue.tsx:256` vs `319-321`).
7. `convertQortalLinks` writes `className=` (`utils.ts:86`), so the link styling never applies.
8. Metadata description can exceed Core's 240-char limit (`PublishIssue.tsx:321-329`).
9. Stray imports `import { s } from "vite/dist/node/types.d-aGj9QkWt"` and `import { key } from "localforage"` in `DataEditor.tsx:179,182` (unused; will matter under stricter TS/eslint).
10. `getSignature` uses a relative `fetch('/transactions/signature/…')` (`VerifyPayment.ts:157`) — fine in Hub, but in GO/qapp-core contexts direct fetches may need the proxy; unchanged behaviour required.

---

#### 14. Binding "must keep" list for the + app
- Service/name/identifier triples in §2, §3, §6, §7.1 exactly, including `_metadata`, the FILE base without suffix, `qcomment_v1_q_support_<last12>_base_<uid6>` and `…_reply_<parent uid>_<uid6>`, `q_support_fees` under name `Q-Support`, and `tag1 = q_support_issue_`.
- Every JSON field in §2.3 (including `commentsId`, `version`, `fullDescription`, `htmlDescription`, `category`/`subcategory`/`subcategory2` as strings, `files[]` shape, `images[]` data URLs, `QappName`, `feeData.signature`, `bountyData` shape) and the metadata `description` encoding in §2.2 (search filters in the original app depend on it).
- Fee behaviour: recipient = owner of name `Q-Support` resolved at pay time, amount from the schedule, `SEND_COIN` before publish, refusal handling as today (§7.2); verification rules (§7.3) unchanged.
- Comment payloads as plain UTF-8 text (no HTML), edits under the same id, DM notification on new top-level comments (§6).
- `htmlDescription` must stay renderable under Quill 1 CSS (§12.4).
- `useTestIdentifiers` stays `false`; do not reuse `q_support_playlist_`.
- New data only as extra JSON fields or new identifiers with a new prefix.

</details>

## Plan

_Not written yet; the session paused after the platform upgrade. Follow-ups lists the intended order._

## Done

_Platform upgrade only so far; numbers are in the Status section above. No redesign, efficiency or feature work has started._

## Follow-ups

Exactly what is unfinished, in the order the qplus-app skill wants it. Pick up from item 1.

1. **Test harness** (skill step 4, overnight checkpoint): add `vitest` 5, `jsdom`, `@testing-library/react` ≥ 16.1, `@testing-library/jest-dom`; `src/test/setup.ts` with a `qortalRequest` mock that answers by action and records calls, plus a relative-`fetch` route mock (copy the pattern from `apps/Names+/src/test/setup.ts` on branch `names-plus/pass-1`); `vite.config.ts` gets the `test` block (`defineConfig` from `vitest/config`, `environment: 'jsdom'`, `setupFiles`, `css: false`). First tests to write: `quillCompat.test.ts` (Quill 2 bullet/ordered/mixed lists → `<ul>`/`<ol>`, `ql-indent-N` kept on `li`, code-block container → `pre.ql-syntax` with `\n`-joined lines, `.ql-ui` spans dropped, Quill 1 input unchanged), and `extractTextFromHTML`. `npm test` = `vitest run`.
2. **Lint**: it failed at the baseline (27 errors, 261 warnings, `--max-warnings 0`). Move to eslint 9 flat config + typescript-eslint 8 + eslint-plugin-react-hooks 6 (as Names+ did), fix the errors, and decide whether to keep `--max-warnings 0` (most warnings are `any` and unused vars in upstream code). Own commit.
3. **Theme kit + Settings + shell** (checkpoint): `mkdir "apps/Q-Support+/src/hub-theme" && scripts/sync-theme.sh`; `src/theme/qplus-theme.ts` with `THEME_STORAGE_KEY = 'qsupportplus-ui-theme'` and `hub20Options(mode)` built from the options in `src/styles/theme.tsx` (it currently exports finished `darkTheme`/`lightTheme` objects; export the options instead); replace the `ThemeProvider`/`setTheme` plumbing in `App.tsx` and `GlobalWrapper.tsx` with `HubThemeProvider`; paste `boot-inline.js` into `index.html` with that key; NavRail/BottomNav/PageHeader as in Names+ (`apps/Names+/src/components/layout/` on `names-plus/pass-1`); a `/settings` route with Account, Appearance (`<ThemePicker />`), app options (blocked names live in `BlockedNamesModal`, move them here), About with version + ChangelogDialog. Bump `package.json` version to `1.1.0-plus.1`, add `src/constants/changelog.ts`, and a README section. Then `scripts/build-zip.sh Q-Support+`, push, and open the PR with `gh pr create --base main --title "Q-Support+: React 19.3 / MUI 9.4 + redesign pass 1"` and "Checkpoint reached" in the body.
4. **Audit**: the read-only audit workflow was stopped when the session paused. Two of its seven sections finished (architecture map and data contract; both are appended raw under "Audit" below and should be condensed into the brief). Still to do: the Qortal call inventory with first-load search counts and the 4 `limit: 0` searches, the upgrade-verification greps of MIGRATION-NOTES §5.3 (the code greps are clean; the runtime checks in a browser are not done), the money/publish behaviour spec for `SEND_COIN` (Donate.tsx, SendFeeFunctions.ts, VerifyPayment.ts), UX problems and bugs, dead code and bundle (the 9 TTF fonts in `src/styles/fonts/` are 1.4 MB of the dist and the Playlist/VideoPlayer code is a Q-Tube leftover), then the Plan section.
5. **Then** the rest of the pass: efficiency fixes (no `limit: 0`, paging, search dedupe + session cache, lazy avatars, code-split the Quill editor, publish dialogs and video player), the Hub 3.0 redesign of Home / issue page / publish + edit / comments including the phone layout, the placeholder category and status icons → MUI icons (`src/components/common/IssueIcon.tsx`), and 2–4 features from the ideas list. Bounty payments (`SEND_COIN`) must keep exactly the same behaviour; add tests around them before touching nearby code.

Things to verify in Hub before publishing (Simon or a local session):

- Open an issue written by the original Q-Support in Q-Support+ and one written by Q-Support+ in the original, with bullet and numbered lists and a code block, in both directions.
- The Quill 2 editor (toolbar, paste an image, resize it) inside Hub's iframe.
- react-toastify 11 notifications, react-dropzone 14.4 file attachments, the draggable video player (react-rnd 10.5) still work; MUI 9 changed `ListItemIcon` to 36 px and Dialog Esc handling, so click through the publish, edit, donate and fee-history dialogs.
- The `/render/APP/Q-Support+` base path with `+` in the name (docs/QORTAL.md, deep links).

Open questions for Simon:

- The original category and status icons were never in git. Replace with MUI icons (the plan), or extract the originals from the published Q-Support zip?
- Nine bundled TTF fonts (Cairo, Raleway, Merriweather Sans, …) come from the Q-Tube fork and are 1.4 MB of the zip; the plan is to drop all but what the Hub 2.0 theme needs. OK?
