# Q-Mail+

Encrypted mail between Qortal names, with threads, attachments and group mail.

**Published:** not yet. **Version on the branch:** 1.0.0 (PR [#15](https://github.com/SJQortal/Q-Apps-Plus/pull/15)).

## Baseline at import

- **Upstream:** [Qortal/q-mail](https://github.com/Qortal/q-mail) branch `main` at `ddf3aa9` (2026-05-28, 14 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 5, TypeScript 4.9
- **Original theme (becomes Hub 2.0):** src/styles/theme.ts
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 2.1 MB, biggest JS chunk 1.6 MB
- **QDN services:** MAIL_PRIVATE, BLOG_POST, BLOG_COMMENT, BLOG, THUMBNAIL, VIDEO, AUDIO, FILE
- **Identifiers seen (partial; complete this in the audit):** `_mail_qortal_qmail_`, `qortal_qmail_thmsg_`, `qortal_qmail_thread_group`, `qortal_group_avatar_`, `qortal_avatar`
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×17, GET_QDN_RESOURCE_URL ×11, FETCH_QDN_RESOURCE ×9, GET_ACCOUNT_DATA ×8, DECRYPT_DATA ×7, PUBLISH_MULTIPLE ×6; `/arbitrary/resources` fetched directly ×34

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- **`react-quill` 2 crashes on React 19** (it calls `findDOMNode`). Switch to `react-quill-new` (Quill 2) and check that content written by the + app still displays correctly in the original app, and the other way round (docs/MIGRATION-NOTES.md, Q-Apps+ specifics).
- This is the largest app (~36k lines). The biggest JS chunk is 1.6 MB, so code-splitting will pay off.
- Mail is encrypted (`MAIL_PRIVATE` + `DECRYPT_DATA`). Do not touch the encryption or recipient format.
- Upstream branch `feature/version-2` (2025-09, crowetic) has "changes from greenflame, multi-name support". It diverged from `main` (22 ahead / 13 behind). In the audit, check whether `main` already has multi-name support; if not, it is a candidate feature. Read that branch with `git log up-q-mail/feature/version-2` after running `scripts/sync-upstream.sh --check`.
- Has 4 `limit: 0` searches.

## Feature ideas to weigh in the audit

- search across mail
- unread counts per name/thread
- drafts
- keyboard shortcuts on desktop
- better attachment previews
- contacts or recent recipients
- multi-name inbox (see note above)

## Audit

_Deep-dive audit of 2026-10-01 (overnight session). Written by a read-only workflow of eight parallel readers; every data-contract and call-inventory claim was then checked by three adversarial verifiers each (159 agents), and refuted claims were corrected before synthesis. Line numbers refer to the tree at commit `43d9236` unless marked "(now N)"; the anchor table at the top maps them to the current `Mail.tsx`. Earlier, lighter notes from 2026-09-29 are kept below under "Pre-audit notes"._

**Headline numbers at the start of the pass** (commit `43d9236`, after the platform upgrade): tsc 0 errors; dist 2.2 MB; main chunk 1,576 kB (gzip 482 kB); first load for one name and two groups ≈ 20–30 searches plus one `GET_QDN_RESOURCE_URL` per inbox message; 4 `limit=0` calls (`/groups/members/<id>?limit=0` ×2 live, 1 commented out, 1 in excluded code); 9 fixed-period pollers, none pausing when the tab is hidden; no lint script; 17 tests.

Read-only audit of `apps/Q-Mail+` on branch `q-mail-plus/pass-1`, compiled from eight reports (architecture, data contract, Qortal call inventory, bundle, UX, bugs, features, upstream) and an adversarial verification pass over every data-contract and call-inventory claim. All paths are relative to `apps/Q-Mail+/` unless stated. Only files reachable from `src/main.tsx` are described; the 55 tsconfig-excluded Q-Blog leftovers are ignored except where they are named as dead weight.

**Provenance and line numbers.** The reports were written against the tree at `43d9236` (MUI 9.4 upgrade) and `507641e` (theme kit + Settings), where `src/pages/Mail/Mail.tsx` was 4,723 lines. Three commits have landed since the reports were taken: `507641e Q-Mail+: theme kit with four themes and a Settings page`, `224fb37 Q-Mail+: drop the Q-Blog audio player that crashed React 19 at load`, and `d5f6dfd Q-Mail+: Hub 3.0 layout shell (rail, list, reading pane, phone stack)`, which cut `Mail.tsx` to 3,691 lines, deleted `src/components/layout/Navbar/*`, removed 343 lines of `src/index.css` and added `src/layout/{MailShell,Rail,BottomNav,ComposeFab,PaneHeader,states,useAppViewport,useLayoutMode}.tsx`. Every `Mail.tsx:N` citation below is to the 4,723-line file unless it is marked **(now N)**, in which case it was re-verified in the current 3,691-line file. The verifiers' citations (quoted as "verifier:" where they differ) are against the current tree. Every other file keeps its line numbers across the three commits except `GlobalWrapper.tsx` (361 → 353 lines; auth, groups and storage code moved by a few lines, noted where it matters) and `App.tsx` (rewritten by `507641e`, 56 lines).

Anchor table for the current `Mail.tsx` (3,691 lines), to translate the old citations:

| Symbol | Old line | Now |
|---|---|---|
| `MAIL_STATE_DOCUMENT_SERVICE` / `_IDENTIFIER` | 121-122 | 107-108 |
| `normalizePublishedStateEntry` / `mergePublishedStateEntries` | 371-385 / 387-402 | 357 / 373 |
| `buildSidebarItems` | 416-496 | 402 |
| `fetchHasMailResources` | 498-525 | 484 |
| `hasGroupThreadActivity` | 527-549 | 513 |
| `fetchGroupAvatarPublisherName` / `fetchGroupAvatarUrl` | 551-592 / 594-624 | 537 / 580 |
| `isDeletedSentResourceInSearch` | 626-637 | 612 |
| `hasSentMailActivityForOwnedName` | 639-691 | 625 |
| `hasInboxMailActivityForOwnedName` | 693-752 | 679 |
| `hasInboxMailActivityForSavedAlias` | 754-777 | 740 |
| `fetchInboxMessagesForOwnedName` | 795-900 | 781 |
| Joyride `steps` / `TOUR_STATUS_STORAGE_KEY` | 902-1007 / 1009 | 888 / 995 |
| `useLayoutMode()` / `isMobile` | `useMediaQuery("(max-width:950px)")` at 1070 | 1056-1057 (`layoutMode === "phone"`) |
| `ownedNameCandidates` | 1176-1196 | 1167 |
| `combinedInboxMessages` / `composePriorityRecipientNames` / `inboxMessagesForList` | 1270 / 1299 / 1330 | 1255 / 1284 / 1315 |
| inbox 30 s `setInterval` | 1383-1388 | 1365-1373 |
| `openMessage` | 1400-1454 | 1385 |
| `openReplyComposerFromMessage` / `openForwardComposerFromMessage` / `handleRequestComposeThread` | 1456 / 1481 / 1503 | 1441 / 1464 / 1484 |
| `runAliasScan` | 2078-2403 | 2059 |
| `applyReadStateToMessages` / `applyUnreadStateToMessages` | 2405 / 2468 | 2386 / 2449 |
| `localMailStateById` / `hasPendingStateChanges` | 2516 / 2556 | 2497 / 2537 |
| `markMessagesAsRead` / `markMessagesAsUnread` | 2565 / 2599 | 2546 / 2580 |
| `publishMailStateToQdn` / `loadPublishedMailStateFromQdn` | 2629 / 2710 | 2610 / 2691 |
| `sidebarItems` / `onSelectSidebarItem` | 2882 / 3091 | 2863 / 2892 |
| `sentInstanceNamesForCurrentView` | 3504-3516 | 3209 |
| `<SentMail>` / `<AliasMail>` / `<ThreadsMailbox>` / `<GroupedMailboxList>` | 3960 / 3822 / 3779 / 3980 | 3317 / 3334 / 3346 / 3370 |
| `<ShowMessageV2>` / `<NewMessage>` / `<GroupMail>` | 3922 / 3704 / 3775 | 3417 / 3461 / 3503 |
| `<Rail>` / `<BottomNav>` / `<MailShell>` / `<OpenMail>` / `<Joyride>` | (new) | 3595 / 3608 / 3628 / 3650 / 3653 |

### Architecture map

#### Boot chain

| Step | File | What it does |
|---|---|---|
| HTML | `index.html:10-11` (rewritten by `507641e`, now carries the theme boot snippet) | `<div id="root">` + `<script type="module" src="/src/main.tsx">`. |
| Entry | `src/main.tsx:22-29` | Installs the Lexend/Illinois typography `<style>` (`ensureLexendIllinoisTypographyStyle`, scale small 0.875 / medium 1 / large 1.125) and sets `data-qapp-text-size="medium"` on `<html>`; `main.tsx:4` imports `src/hub-theme/fonts.css` (Inter woff2) since `507641e`. |
| | `src/main.tsx:32-41` (now `:51` for the context menu) | `BrowserRouter basename={window._qdnBase}` (`''` when unset), renders `<App />`, `<GlobalContextMenu />` (right-click "Copy" menu, `src/components/common/GlobalContextMenu/GlobalContextMenu.tsx:10-53`) and a `<div id="modal-root">`. |
| App | `src/App.tsx:24-37` (old) | `getInitialTheme()`: `window._qdnTheme` → `?theme=` query → default `'dark'`. **Now** (`App.tsx:4`) `HubThemeProvider` from `src/hub-theme` wraps the tree; `App.tsx:11` imports `SettingsPage, SETTINGS_PATH`; `App.tsx:19-34` is `AppRoutes` with the "background location" pattern so `/settings` opens over the mail view without unmounting it. |
| Routes | `src/App.tsx:51-52` (old) → now `App.tsx:31-33` | `/` → `<Mail />`; `/to/:name` → `<Mail isFromTo />`; `*` → `<Mail />`. Settings is rendered on `SETTINGS_PATH` from the background-location routes. |

#### Wrappers

**`src/wrappers/DownloadWrapper.tsx`** — provides `MyContext { downloadVideo }` (`:37`). `performDownload` (`:77-194`) dispatches `setAddToDownloads`, calls `GET_QDN_RESOURCE_PROPERTIES` + `GET_QDN_RESOURCE_URL` (`:44-67`), then polls `GET_QDN_RESOURCE_STATUS` every 5 s (`:98`, `:187`) until `READY`/`NOT_PUBLISHED`, re-calling `GET_QDN_RESOURCE_PROPERTIES` when progress stalls (`:129-152`). Consumers: `OpenMail` (mail body download) and `FileElement` (attachments, `src/components/FileElement.tsx:74`). `DownloadTaskManager` is imported (`:10`) but commented out (`:220`).

**`src/wrappers/GlobalWrapper.tsx`** — the auth/session layer:
- `askForAccountInformation` (`:248-260`, now `:246-258`): `GET_USER_ACCOUNT` → `getAccountNames` (`GET_ACCOUNT_NAMES`) + `getPrimaryAccountName` (`GET_PRIMARY_NAME`) (`src/utils/qortalRequestFunctions.ts:3-26`) → `dispatch(addUser({...account, name: primary, names}))`.
- `NOTIFICATION_MARK_SEEN` for `q-mail-notification` on mount (`:55-62`).
- Own avatar via `GET_QDN_RESOURCE_URL THUMBNAIL/qortal_avatar` (`:64-79`), treating the string `"Resource does not exist"` as absent (`:72`).
- Groups: `fetch('/groups/member/'+address)` → `dispatch(setPrivateGroups)` (`:88-112`, now `:86-110`), re-polled every 600 000 ms (`:232-246`, now `:230-244`).
- `getLocalSubjects(name)` (`:199-230`): reads `localStorage qmail_persistance_${name}`, keeps newest 500, writes back, `dispatch(addAllHashMapSubject)`.
- `useQMailAppShell` (`:284-295`) and `applyQAppTextSize` on text-size change (`:297-302`).
- Renders: `PageLoader` when `isLoadingGlobal`, `LoaderBar` when `isLoadingCustom`, the old `<NavBar>` (deleted in `d5f6dfd`; its `setActiveName` prop handler at `:308-320` cleared messages and switched `user.name`), `<ConsentModal/>`, `children`, and until `224fb37` an `<AudioPlayer>` when `audios` was set (`:304-327`). `setActiveName` now lives in `src/app-shell/AppShellContext.tsx:19-27` (added by `507641e`).

#### App shell (`src/app-shell/useQMailAppShell.ts` + `src/qapp-lib/app-shell/*`)
- Config (`useQMailAppShell.ts:130-158`): `appId 'qmail'`, `appName 'Q-Mail'`, version from `package.json`, rating enabled with `pollName 'app-library-APP-rating-qmails'` (verifier: the string is at `:143`, inside the `rating` block at `:141-144`), defaults `textSize 'medium'`, `authOnStartup true`, `themeMode 'hub'` (`:143-147`). `onThemeChanged` calls `setTheme` in App (`:149-151`). `maybeAuthOnStartup` runs at `:166-169`.
- Deps (`:104-128`): `createBrowserDeps` with **storage prefix `''`** (`:117-119`), theme root `document.documentElement`, datasetKey `theme`, `themeDataKey '_qdnTheme'`, event `THEME_CHANGED`.
- `src/qapp-lib/app-shell/adapters.ts:32-72`: storage get/set = `localStorage` JSON under `${prefix}:${key}` (`:48-49`). `createQortalRatingAdapter` (`:91-120`) is **local-only**: its `_options` parameter is never read, so it never calls `qortalRequest`; votes live in `localStorage qapp-lib:ratings:${service}:${pollName}:${appId}` (`:78-79`), i.e. `qapp-lib:ratings:APP:app-library-APP-rating-qmails:qmail`.
- `src/qapp-lib/app-shell/react.tsx`: `APP_SHELL_STORAGE_KEY='app-shell'` (`:55`); `readHubTheme` reads `<html data-theme>` or `window._qdnTheme`, anything but `light` → `dark` (`:75-83`); `applyResolvedTheme` writes `data-theme`, `window._qdnTheme`, dispatches `THEME_CHANGED` (`:85-95`); `resolveTheme`: `'hub'` → host theme, else the chosen mode (`:97-103`); rating summary/submit forward `service 'APP'` and the poll name to the adapter (`:227-236`, `:382-392`); `maybeAuthOnStartup` (`:320-326`); `AppMenu` renders Authentication / Settings / Rating sections (`:448-582`). The rating control is now surfaced by `src/pages/Settings/SettingsPage.tsx:280-289` (`controller.submitRating`).
- `src/qapp-lib/app-shell/core.ts:5-45` defines `AppShellState` / `AppShellController`.

#### Navbar and left sidebar (baseline, removed by `d5f6dfd`)

The reports describe the upstream shell, which is what the bundle, UX and bug findings were measured against; it no longer exists in the worktree but its behaviours are listed so the redesign can confirm each one was carried over or deliberately dropped.

- `src/components/layout/Navbar/Navbar.tsx` (deleted): `isMobile = useMediaQuery('(max-width:950px)')` (`:65`); logo `IconButton.qapp-lib-top-bar-icon` emitting `qmail:left-sidebar-anchor-click|pointer-enter|pointer-leave` document events (`:124-134`, `:149-216`); mobile "Mailboxes / Tap to open" + hamburger (`:179-215`); version text (`:217-230`); changelog `InfoOutlined` button emitting `qmail:toggle-changelog` (`:231-251`); right-hand menu `Popover` with `AppMenu` (`:273-315`), the **"Always fetch and apply QDN state"** checkbox persisted via `writeAutoApplyQdnState(userAddress)` (`:317-345`), and "Blocked Names" → `BlockedNamesModal` (`GET_LIST_ITEMS blockedNames` / `DELETE_LIST_ITEM`, `src/components/common/BlockedNamesModal/BlockedNamesModal.tsx:29-58`) (`:346-371`); `qmail:authenticate` → `appShellController.authenticate()` (`:85-94`), fired by the "Authenticate" buttons in Mail's auth prompts (`Mail.tsx:2858`, now `:2839`); legacy `UserNavbar` branch (`:96-105`) never true. The upstream 2.2.0 name-switcher dropdown was never carried into v3: `accountNames`/`setActiveName` were declared (`:47-48`, `:59-60`) and never used.
- `src/qapp-lib/left-sidebar/*` (still on disk, no longer rendered by `Mail.tsx`; `Mail.tsx` now imports only the `LeftSidebarItem` type, now `:70`): `core.ts:12-36` state/config; `react.tsx:20-21` `getMode = width < breakpointPx ? 'mobile' : 'desktop'`, default 960, Mail overrode to 950 (`Mail.tsx:2943`); storage key `qmail:left-sidebar` (`:17-18`, `:59-65`, `:78-82`); controller (`:67-243`) with hover preview, pinning, `setViewportWidth` (`:209-224`), `handleEscapeKey`, `handleOutsideInteraction` (`:231-236`); `LeftSidebar` component (`:301-551`) rendering `ButtonBase` items with inline `sx` and `outline: 2px solid transparent` (`:441-446`). **Mismatch (baseline):** `src/index.css:431-674` styled `.qapp-lib-left-sidebar*` and `[data-qapp-lib-sidebar-item^=…]` selectors that no TSX emitted; those 343 lines were deleted by `d5f6dfd`. The Joyride steps 2-4 still target `[data-qapp-lib-sidebar-item='inbox'|'compose'|'aliases']` (`Mail.tsx:930,947,974`, now `:888-993`) and the new `src/layout/Rail.tsx` does not emit that attribute either (grep: no `data-qapp-lib-sidebar-item` in `src/layout/`), so the tour is still broken after step 1 (see Bugs #10).

#### New shell (`d5f6dfd`, current tree)
- `src/layout/useLayoutMode.ts:12-27`: `phone` < 600 px, `medium` 600-899, `desktop` ≥ 900 (`PHONE_MAX_WIDTH = 600`, `DESKTOP_MIN_WIDTH = 900`, `:13-14`), via `useMediaQuery`. `Mail.tsx` (now `:1056-1057`) derives `isMobile = layoutMode === "phone"`.
- `src/layout/useAppViewport.ts:12-54`: writes `--qmail-app-height` on `<html>` from `min(visualViewport.height, innerHeight)` when embedded or when the keyboard shrinks the visual viewport, else `100dvh`; listens to `resize` and `visualViewport` `resize`/`scroll` (`:44-47`). Called at `Mail.tsx` (now `:1060`).
- `src/layout/MailShell.tsx:19-21` (`RAIL_WIDTH 240`, `LIST_WIDTH_DESKTOP 380`, `LIST_WIDTH_MEDIUM 300`), `:90` `PaneScroll`, `:99-183` `MailShell({mode, rail, railOpen, onRailOpenChange, bottomNav, fab, banner, list, reading, readingPlaceholder, readingOpen, wide, wideKeepsChrome, overlays})`; rail in a column on desktop (`:152`) and in a drawer otherwise (`:156`).
- `src/layout/Rail.tsx:38-45` exports the sidebar id prefixes (`inbox-instance:`, `aliases-instance:`, `sent-instance:`, `threads-group:`, `alias-compose`, `publish-mail-state`, `NAME_FILTER_THRESHOLD 15`); `groupRailItems` (`:63`); `Rail` (`:189`) renders MUI `Badge`s for `badgeText` (`:228`, `:314`) and the publish-state item as a cloud icon with a warning dot (`:330-332`).
- `src/layout/BottomNav.tsx:6` (`BOTTOM_NAV_HEIGHT 60`), `:54` `BottomNav`; `src/layout/ComposeFab.tsx:25`; `src/layout/PaneHeader.tsx:50` (`title, subtitle, onBack, backLabel, leading, actions`); `src/layout/states.tsx:30` `ListSkeleton`, `:54` `EmptyState`, `:71` `ErrorState`, `:93` `fetchingLabel`, `:109` `FetchingFromPeers`, `:139` `LoadingBanner`. `Mail.tsx` imports only `EmptyState, LoadingBanner` (now `:76`) and uses them at `:3433` and `:3637`; `GroupedMailboxList`, `SentMail`, `AliasMail`, `ThreadsMailbox`, `GroupMail` do not use `states.tsx` yet (grep: none).
- `Mail.tsx` (now `:3590-3675`): `rail = <Rail items={sidebarItems} activeItemId onSelect={onSelectSidebarItem} avatarUrlByName groupAvatarUrlById onOpenSettings={openSettings} version onClose/>`; `bottomNav` with Inbox / Sent / Threads / Aliases / Menu (`menu` opens the rail drawer); `<MailShell … fab={<ComposeFab onClick={() => onSelectSidebarItem("compose")}/>} banner={isMailBootstrapLoading ? <LoadingBanner text="Fetching mail and state…"/> : null} list={listPane} reading={readingPane} overlays={<LoadPublishedStateModal/> + <OpenMail/> + <Joyride/>}/>`. The list pane (now `:3360-3400`) is `PaneHeader` + `PaneScroll` + `MailboxSearchBar` + `GroupedMailboxList` + spinners (`:3379-3380`); the reading pane (now `:3405-3420`) is `PaneHeader` (phone only, with "Back to messages") + `ShowMessageV2`. Both `activeMailboxItem` and `mobileMode` are still set in tandem by every navigation handler (e.g. reply/forward now `:1458-1459`, `:1478-1479`; composer close `:3235-3260`), so the two parallel navigation states survive the shell commit.
- `src/hub-theme/*` (`507641e`): `HubThemeProvider.tsx`, `ThemePicker.tsx`, `boot.ts`, `tokens.ts`, `mui-theme.ts`, `fonts.css` + four Inter woff2; `src/pages/Settings/SettingsPage.tsx` (309 lines), `ChangelogDialog.tsx`, `src/theme/qplus-theme.ts`. `index.css:160-161` sets `--qapp-font-sans: var(--qp-font)` for every theme except `data-ui-theme='hub20'`.

#### Redux store (`src/state/store.ts:9-17`)

| Key | File | Holds | Used by |
|---|---|---|---|
| `notifications` | `notificationsSlice.ts:3-73` | `alertTypes {alertSuccess, alertError, alertInfo}`; `setNotification({alertType,msg})`, `removeNotification` | `Notification.tsx` turns them into react-toastify toasts and immediately clears (`:12-50`). |
| `auth` | `authSlice.ts:8-34` | `user: {address, publicKey, name?, names?: NameRecord[]}` (`NameRecord {name, owner}` at `:3-13`); `addUser` | Everything identity-related. |
| `global` | `globalSlice.ts:4-39` | Mostly Q-Blog leftovers (`currentBlog`, `visitingBlog`, `audios`, `currAudio`, …). Live for mail: `isLoadingGlobal`, `isLoadingCustom` (string), `downloads` (per identifier status, `:98-109`), `userAvatarHash` name→url (`:110-115`, stores any truthy string including the `"Resource does not exist"` sentinel), `privateGroups` groupId→group (`:116-119`), `hasFetchedPrivateGroups`. |
| `blog` | `blogSlice.ts:116-330` | Q-Blog posts/favorites/subscriptions; **dead** for mail but still registered and read by `useFetchMail` (`src/hooks/useFetchMail.tsx:31-55`). |
| `mail` | `mailSlice.ts:14-45` | `mailMessages: any[]` (inbox index rows for the primary name), `hashMapMailMessages` id→decrypted message, `hashMapSavedSubjects` id→`{timestamp, subject(encrypted), attachments}`, plus copied blog fields. Reducers: `upsertMessages` (`:224`), `upsertMessagesBeginning` (`:254`), `addToHashMapMail` (`:193`), `addAllHashMapSubject` (`:197`), `addToHashMapSubject` (`:201`), `clearMessages` (`:205`). Slice `name` is `'blog'` (`:131`) — a copy/paste of blogSlice; the two share action type strings, so `mail/upsertMessages` is dispatched as `blog/upsertMessages`. |

`localForage` instances `q-blog-favorites` / `q-blog-favorites-${name}` are created in `mailSlice.ts:4-6,72-76`, `blogSlice.ts:4-6` and `GlobalWrapper.tsx:48-51` but no mail code stores anything in them.

#### `src/pages/Mail/Mail.tsx` (4,723 lines at audit time; 3,691 now)

Module-level pieces (before the component):
- Sidebar item id scheme (`:104-167`, now also exported from `src/layout/Rail.tsx:38-43`): section ids `inbox|aliases|sent|threads|compose|alias-compose|publish-mail-state`; nested ids `inbox-instance:<enc name>`, `aliases-instance:<enc name>`, `sent-instance:<enc name>`, `threads-group:<enc groupId>`.
- Local-storage helpers: watched aliases (`:171-207`), alias reply links (`:209-250`), alias scan checkpoint (`:252-303`).
- Published-state types/helpers (`:337-414`): `QMailPublishedStateEntry {read?, updatedAt?, subject?}`, `QMailPublishedStateDocument {version, updatedAt, ownerAddress, names, messages}`, `normalize/merge/arePublishedStateEntriesEqual`.
- `buildSidebarItems` (`:416-496`): `Compose`, optional `Alias Compose` (when an alias inbox is selected), `Inbox` + one child per owned name with inbox mail, `Aliases` + one child per watched alias (secondaryLabel = linked reply alias), `Sent` + one child per owned name with sent mail, `Q-Mail Threads` (badge `+`/`-`, children hidden unless expanded), and `Publish Q-Mail State` (badge `!` when pending, disabled while publishing).
- QDN probes (all raw `fetch('/arbitrary/resources/search?…')`): `hasGroupThreadActivity` (`:527-549`, `limit 1`), `fetchGroupAvatarPublisherName/Url` (`:551-624`), `hasSentMailActivityForOwnedName` (`:639-691`, two queries `limit 20`), `hasInboxMailActivityForOwnedName` (`:693-752`, two queries), `hasInboxMailActivityForSavedAlias` (`:754-777`), `fetchInboxMessagesForOwnedName` (`:795-900`, pages of 200 until exhausted, two query shapes).
- Joyride `steps` (`:902-1007`), `TOUR_STATUS_STORAGE_KEY='tourStatus-qmail'` (`:1009-1010`).

Component state (selected, `:1020-1116`): `isOpen`/`message` (open message, `:1024,1026`), `replyTo`/`forwardInfo` (`:1027-1028`), `currentThread` (`:1029`), `watchedAliases` + scan states (`:1030-1050`), `ownedInboxNames`/`ownedSentNames` (`:1051-1052`), `run` (tour), `filterMode` (`'Recently active'`), `selectedAlias` + `selectedAliasScope: 'inbox'|'aliases'|'sent'|null` (`:1055-1057`), `selectedGroup` (`:1058`), `groupOptionsWithThreads`, `groupAvatarUrlById`, `mailInfo` (for `OpenMail`), **`isMobile`** (`:1070`), **`mobileMode`** (`'inbox'|'sent'|'aliases'|'threads'|'compose'`, `:1071`), **`activeMailboxItem: MailboxSidebarItemId`** (`:1072-1073`), `composeMode 'standard'|'alias'` (`:1074`), `isThreadsSectionExpanded`, `composePrefill`, `composeReturnView 'inbox'|'threads'`, `composeReturnGroupId`, `composeRecipientAlias`, `composeRequireReplyAlias`, `composeDefaultReplyAlias` (`:1077-1088`), `isChangelogOpen` (`:1089`), `isPublishingMailState`, `publishedMailStateById` (`:1090-1093`), `inboxSearchQuery`, `combinedAliasInboxMessages` name→rows (`:1095`), `isLoadingCombinedAliasInbox`, `isLoadingQdnState`, `aliasReplyLinks`, `rememberQdnStatePreferenceOnLoad`.

Derived flags:
- `hasAuthenticatedIdentity = Boolean(user?.name && user?.address)` (`:1197`).
- `isAliasesViewActive/isSentViewActive/isInboxViewActive` = desktop `activeMailboxItem===X` **or** mobile `mobileMode===X` (`:1207-1215`).
- `selectedInboxInstanceName` (inbox view + scope `inbox`), `selectedAliasInboxName` (scope `aliases` and not the primary name), `activeAliasInboxName` (only while aliases view active), `selectedSentInstanceName` (`:1216-1226`).
- `combinedInboxMessages` = `mailMessages` merged with every `combinedAliasInboxMessages[name]`, newest first (`:1270-1298`). `inboxMessagesForList`: no instance → combined; instance == primary → `mailMessages`; other owned name → `null` (`:1330-1343`), i.e. the list is empty for a non-primary instance today (Bugs #1).
- `useMailboxSearch` for the inbox (`:1349-1357`).
- `sidebarItems` memo (`:2882-2910`), `activeSidebarItem` (`:3372-3415`) pushed to the controller (`:3417-3419`).

Data loading and polling inside Mail:
- First load / name change: `clearMessages`, `getMessages(true)` → `useFetchMail.getAllMailMessages` (`:1556-1565`, `src/hooks/useFetchMail.tsx:278-326`: pages of 200 on `qortal_qmail_<name20>_<addr6>_mail_`, `includemetadata=false`, then `GET_QDN_RESOURCE_URL` avatar per message).
- `checkNewMessages` every 30 000 ms (`:1380-1398` → `useFetchMail.tsx:98-141`, `limit 20`), prepends only what is newer than `mailMessages[0]`.
- Owned-name probing on `ownedNameCandidates` (`:1682-1726`), watched-alias activity (`:1641-1680`), avatars for owned names (`:1728-1774`), groups with threads (`:1817-1854`), group avatars (`:1885-1912`), combined alias inbox fetch when inbox view is active and no instance selected (`:1914-1969`).
- Sidebar plumbing (baseline): resize → `setViewportWidth` (`:3421-3430`); anchor events from Navbar (`:3432-3464`); Escape (`:3466-3477`); outside `pointerdown` (`:3479-3502`); `qmail:toggle-changelog` (`:3356-3366`). All replaced by `MailShell`/`Rail` props in `d5f6dfd`.

Render tree outline at audit time (`return (` at `:3522` → `:4697`):
```
<MailContainer .qmail-mail-page>                                   :3523  (height calc(100vh - 78px), Mail-styles.ts:21-27)
  <LoadPublishedStateModal/>                                       :3524
  {isMailBootstrapLoading && <sticky "Fetching mail and state..." banner>}  :3525-3651
  {!isMobile && (                                                  :3653-4051   DESKTOP
    <MailBody>                                                     :3654
      <LeftSidebar …/>                                             :3655-3666
      <Box flex:1>                                                 :3667
        isChangelogOpen              → <ChangelogPage/>            :3674-3694
        activeMailboxItem==='compose'→ <NewMessage inlineMode hideButton … onRequestClose/>  :3695-3754
        activeMailboxItem==='threads'→ auth ? (selectedGroup ? <GroupMail/> : <ThreadsMailbox/>) : authPrompt("Threads")  :3755-3801
        activeMailboxItem==='aliases'→ auth ? (activeAliasInboxName ? <AliasMail/> : <AliasesPage/>) : authPrompt("Inbox")  :3802-3901
        else (inbox | sent)                                        :3902-4047
          isOpen && message          → <ShowMessageV2 … onClose/>  :3904-3936
          else                                                     :3937-4046
            activeMailboxItem==='sent' → auth ? <SentMail instanceNames onOpen/> : authPrompt("Sent")  :3958-3969
            else (inbox)               → auth ? [ !aliasInbox: <MailboxSearchBar/> <GroupedMailboxList showSelectAll onMarkAsRead/Unread/> spinners ;
                                                  aliasInbox: <AliasMail/> ; <Joyride/> ] : authPrompt("Inbox")  :3970-4035
            {mailInfo && isShow && <OpenMail/>}                    :4036-4042
  )}
  {isMobile && (                                                   :4052-4694   MOBILE
    <MailBody height 100%>                                         :4053
      <LeftSidebar …/>                                             :4058-4069  (absolute overlay + backdrop)
      {isChangelogOpen && <absolute z6 overlay><ChangelogPage/>}   :4070-4101
      {isOpen && message && <absolute z5 overlay><ShowMessageV2/>} :4102-4145
      {mailInfo && isShow && <OpenMail/>}                          :4146-4148
      mobileMode==='compose' → <NewMessage inlineMode …/>          :4150-4214
      mobileMode==='aliases' → auth ? (activeAliasInboxName ? <AliasMail/> : <AliasesPage/>) : prompt  :4216-4317
      mobileMode==='inbox'   → [Inbox|Sent toggle buttons :4326-4379] + scroll(calc(100% - 75px)) { auth ? (search+GroupedMailboxList | AliasMail) : prompt }  :4319-4457
      mobileMode==='sent'    → [Inbox|Sent toggles :4467-4520] + scroll(display none while message open :4525) { auth ? <SentMail/> : prompt }  :4459-4552
      mobileMode==='threads' → [Inbox|Sent|Threads toggles :4561-4643] + scroll { auth ? (selectedGroup ? <GroupMail/> : <ThreadsMailbox/>) : prompt }  :4553-4692
  )}
</MailContainer>
```
`TabPanel` is exported at `:4706-4723` (now `:3677-3691`) and unused. The current tree replaces the two `isMobile` trees with one `MailShell` (now `:3627-3675`) whose `list`/`reading` panes are built from the same view switches; `Mail-styles.ts:21-27` (`MailContainer`, `calc(100vh - 78px)`) and `src/components/common/PageLoader.tsx:23` (`100vh`) are still present.

#### How desktop vs mobile was decided (baseline) and is now
- Baseline: **one breakpoint, 950 px, expressed five separate ways**: `useMediaQuery("(max-width:950px)")` in `Mail.tsx:1070`, `Navbar.tsx:65`, `NewMessage.tsx:338`, `NewThread.tsx:100`, `GroupMail.tsx:80`, `MailMessageRow.tsx:87`, `ShowMessageV2.tsx:40`; `@media (max-width:950px)` blocks in `Mail-styles.ts:204,218,438,469,513`; the sidebar controller's `breakpointPx: 950` compared against `window.innerWidth` on `resize` (`Mail.tsx:2943`, `:3421-3430`; `left-sidebar/react.tsx:20-21`). MUI theme breakpoints (`src/styles/theme.ts:53-61`, `md: 900`) were only used for a few `sx` `{xs, md}` paddings (e.g. `Mail.tsx:3549-3552`, `GroupedMailboxList.tsx:474-477`).
- Baseline: desktop and mobile were **two separate JSX trees** keyed by `isMobile` (`Mail.tsx:3653` / `:4052`); desktop navigation state is `activeMailboxItem`, mobile is `mobileMode`, and every sidebar handler sets both (`:3106-3262`). Mobile additionally had inline Inbox/Sent/Threads toggle buttons that only set `mobileMode` (`:4334-4378`, `:4475-4519`, `:4569-4642`). Reply/forward from a message only set `activeMailboxItem='compose'` when `!isMobile` (`:1474-1476`, `:1496-1498`) — on mobile they set `replyTo`/`forwardInfo` but did **not** switch `mobileMode` to `'compose'`. **Now** both handlers set both states (`:1458-1459`, `:1478-1479`), which fixes that.
- Now: `Mail.tsx` uses `useLayoutMode()` (600/900) and `MailShell`; the component-level `useMediaQuery("(max-width:950px)")` calls in `NewMessage.tsx:338`, `NewThread.tsx:100`, `GroupMail.tsx:80`, `MailMessageRow.tsx:87`, `ShowMessageV2.tsx:40` and the `Mail-styles.ts` `@media (max-width:950px)` blocks were not touched by `d5f6dfd`, so those components still flip layout at 950 px while the shell flips at 600/900.

#### Compose flow

Entry points (all end in `activeMailboxItem='compose'` + `mobileMode='compose'`):
1. Sidebar `compose` (`Mail.tsx:3106-3123`, now `:2905-2912`): resets everything, `composeMode='standard'`, `composeReturnView='inbox'`.
2. Sidebar `alias-compose` (`:3125-3149`, now `:2930-2937`): only when an alias inbox is selected; `composeMode='alias'`, `composeRequireReplyAlias=true`, default reply alias from `aliasReplyLinks`.
3. Reply from an open message: `ShowMessageV2.setReplyTo` → `openReplyComposerFromMessage` (`:1456-1479`, now `:1441-1462`): sets `replyTo`, `composeRecipientAlias=activeAliasInboxName`, alias mode if replying inside an alias inbox.
4. Forward: `ShowMessageV2.handleForwardedMessage` builds `updateMessageDetails(from, subject, to)` HTML + body (`ShowMessageV2.tsx:57-77`, `src/utils/helpers.ts:26-34`) → `openForwardComposerFromMessage` (`Mail.tsx:1481-1501`, now `:1464-1482`) sets `forwardInfo` (NewMessage pre-fills the editor, `NewMessage.tsx:747-753`).
5. "New Thread" in `GroupMail` → `onRequestComposeThread` → `handleRequestComposeThread` (`Mail.tsx:1503-1546`, now `:1484`): `composePrefill {toValue: groupName, toType:'group', groupId}`, `composeReturnView='threads'`, `composeReturnGroupId`.
6. Route `/to/:name` with `isFromTo` (`Mail.tsx:1567-1590`): resets and opens compose; `NewMessage` reads `useParams().name` and pre-selects the recipient (`NewMessage.tsx:305`, `:636-654`).
7. Now also the `ComposeFab` (`Mail.tsx` now `:3634`) → `onSelectSidebarItem("compose")`.

Inside `NewMessage` (`src/pages/Mail/NewMessage.tsx`, rendered `inlineMode hideButton`): From select over owned names (`:348-358`, `:1353-1397`); To `Autocomplete freeSolo` mixing recent names, joined groups and a debounced `SEARCH_NAMES` directory lookup (`:410-488`, `:1411-1539`); Subject; optional Alias / Bcc rows (`ChipInputComponent`, hidden for group targets `:534-550`); dropzone attachments 40 MB (`:66`, `:890-931`); reply preview card with Preview/Full/Hide (`:1731-1869`); `TextEditor` (react-quill-new, `src/components/common/TextEditor/TextEditor.tsx`). Per-recipient drafts autosave to `localStorage qmail_compose_drafts_${address}` keyed `from::to` (`:535-542`, `:794-875`).

Sending (`publishQDNResource`, `:1033-1300`): validation (`:1042-1080`) → optional alias warning `useConfirmationModal` (`:1082-1085`) → attachments to base64 `ATTACHMENT_PRIVATE` `attachments_qmail_<id>_<id2>` (`:933-988`) → **group target**: `PUBLISH_QDN_RESOURCE` of a `MAIL` thread `qortal_qmail_thread_group<gid>_<token>` then queue a `PUBLISH_MULTIPLE_QDN_RESOURCES` of `MAIL_PRIVATE` `qortal_qmail_thmsg_group<gid>_<token>_<id>` + attachments encrypted to all member public keys (`:1096-1171`) → **name target**: `GET_NAME_DATA` + `GET_ACCOUNT_DATA` for the recipient key, `mailObject` (see Data contract §3a), identifier `_mail_qortal_qmail_<recipient20>_<addr6>_mail_<sendId>` or `_mail_qortal_qmail_<alias>_mail_<sendId>` when an alias is set, plus one copy per Bcc name (`:1173-1278`). The actual publish happens in `MultiplePublish` (`src/components/common/MultiplePublish/MultiplePublish.tsx:38-116`, one `qortalRequest(pub)` at `:44-46` guarded by `hasStarted` `:110-115`, retry of unsuccessful items `:88-101`).

Leaving compose: `Discard` → `discardComposerDraft` (`:591-610`) clears the stored draft and calls `onRequestClose`; a successful publish → `MultiplePublish.onSubmit` → `closeModal` → `onRequestClose` (`:2050-2072`, `:619-634`). Mail's `onRequestClose` (`Mail.tsx:3719-3751` desktop, `:4178-4210` mobile; now the single `handleComposerClose` at `:3235-3260`) returns to `threads` (re-selecting `composeReturnGroupId`), to the alias inbox when `composeMode==='alias'`, else to `inbox`, and clears all `compose*` state. Selecting any other sidebar item also leaves compose (`:3096-3104`). `onThreadPublished` is never passed from Mail, so a new thread does not auto-open after publishing.

#### Opening a message
- `openMessage(user, identifier, content, to?)` (`Mail.tsx:1400-1454`, now `:1385-1424`): if `hashMapMailMessages[identifier]` is valid and decrypted → `setMessage` + `setIsOpen(true)` with no network call; otherwise `setMailInfo({identifier, name, service MAIL_PRIVATE, to})` and `await show()` from `useModal` (`src/components/common/useModal.tsx:6-46`), which renders **`OpenMail`** (`src/pages/Mail/OpenMail.tsx`): a MUI `Dialog` "Mail download status" that checks `GET_QDN_RESOURCE_STATUS` (`:82-127`), starts `downloadVideo` (DownloadWrapper polling) when not READY and, once `READY`, calls `fetchAndEvaluateMail` (`src/utils/fetchMail.ts:11-128`: `FETCH_QDN_RESOURCE base64` → `GET_NAME_DATA`/`GET_ACCOUNT_DATA` for the other party → `DECRYPT_DATA` → `checkStructureMailMessages` (`src/utils/checkStructure.ts:35-46`) → saves the encrypted subject into `qmail_persistance_${username}` via `ENCRYPT_DATA` (`:85-111`)) and resolves `handleClose(res)` → `onOk`. Opening from Inbox/Aliases also auto-marks the message read (`Mail.tsx:1408-1409`, `:1418-1426`).
- **`ShowMessageV2`** (`src/pages/Mail/ShowMessageV2.tsx:31-349`) is the only reader actually rendered by Mail: header with `AvatarWrapper`, `to:`, timestamp, subject, Reply/Forward buttons (below the header on mobile `:203-226`), collapsible attachments via `FileElement`, body (`DisplayHtml` for `textContentV2`, sanitized `htmlContent`, `ReadOnlySlate` for legacy `textContent`), and the reply chain `generalData.threadV2[]` rendered by **`ShowMessageV2Replies`** (`ShowMessageV2Replies.tsx:42-269`, one expandable card per `data`).
- **`ShowMessage`** (`ShowMessage.tsx:34-278`) is the legacy `ReusableModal` reader that renders `MailThread` (fetches `generalData.thread` by searching each identifier, `MailThread.tsx:61-143`) and `MailThreadWithoutCalling` (`threadV2` accordion). It is still instantiated by `AliasMail.tsx:288-295` and imported by `GroupMail.tsx:30` and `Mail.tsx:41` (now `:32`), but `AliasMail`'s `isOpen` is never set true (the only `setIsOpen(true)` are commented out at `AliasMail.tsx:249`, `:262`; `ShowMessage.tsx:50-52` `openModal` is never called), and the `MailThread` render additionally requires `!alias` (`ShowMessage.tsx:134-145`) while `AliasMail` always passes `alias={value}` (`:292-293`), so it never shows. **`ShowMessageWithoutModal`** (`ShowMessageWithoutModal.tsx:50-206`, exported as `ShowMessage`) is the card used for each post inside a group **`Thread`** (`Thread.tsx:323-329`).

#### Views
**Inbox** (default): `GroupedMailboxList mailboxType="inbox"` (`GroupedMailboxList.tsx:60-601`) groups rows by sender (`:78-127`; key `sender:<lower>` `:92-95`), renders one header per group (`:319-466`), one-message groups open directly from the header (`:351-363`), multi-message groups (`isExpandableGroup = messages.length > 1`, `:320`) expand on header click (`:364-367`; `expandedGroups` starts `{}` `:74-76`) into compact `MailMessageRow`s with checkboxes (`:467-540`), "Select all" (`showSelectAll`, `:264-318`) and a sticky Mark as Read/Unread bar (`:546-598`). `MailMessageRow` (`MailMessageRow.tsx:71-436`) shows the encrypted subject from `hashMapSavedSubjects` (decrypting with a serial `DECRYPT_DATA` queue `:24-59`), `ACCESS TO DECRYPT` when unknown, lock/attachment icons, bold when unread (`generalData.threadV2` empty, `:153-158`, `:205`). Read state is purely local: `markMessagesAsRead` injects a synthetic `threadV2[0] {data:{markedAsReadLocally:true}}` (`Mail.tsx:2405-2441`).

**Aliases** (`activeMailboxItem/mobileMode 'aliases'`): `AliasesPage` (`AliasesPage.tsx:43-522`) manages *watched aliases* (names other people addressed mail to, stored locally): add, remove, link a reply alias, "Open Inbox" (enabled only when `hasInboxMailActivityForSavedAlias` found mail), and the **Alias Scan** (`Mail.tsx:2078-2403`, now `:2059`): pages the whole network's `qortal_qmail_` `MAIL_PRIVATE` index in 200s, skips owned names and address-suffix identifiers, then `FETCH_QDN_RESOURCE` + `DECRYPT_DATA` every candidate to read `recipient`/`to`, adding discovered aliases; resumable via a checkpoint; cancellable. Picking an alias sets `selectedAlias`/scope `'aliases'`, and Mail renders `AliasMail` (`AliasMail.tsx:39-329`), which fetches that alias's mailbox with the same two-query pager (`:107-198`), refreshes every 30 s (`:220-238`) and lists `MailMessageRow`s calling back into `Mail.openMessage`.

**Sent** (`'sent'`): `SentMail` (`SentMail.tsx:269-686`) queries `MAIL_PRIVATE` by `name` for `_mail_qortal_qmail_` (identifier `_mail_`) and legacy `qortal_qmail_` (`:45-59`, `:394-486`, 200/page, every 30 s `:510-526`), hides tombstoned messages (title `__qmail_deleted__` / tag `qmail-deleted`, `:109-138`) and locally deleted ids. Rows are grouped by recipient parsed from the identifier (`mailIdentifier.ts:32-75`). "Delete sent message" republishes the same identifier with a tombstone payload encrypted to the recipient (`:535-653`) and records it in `qmail_deleted_sent_${username}`. `instanceNames` comes from `sentInstanceNamesForCurrentView` (`Mail.tsx:3504-3516`, now `:3209`): one owned name when a `sent-instance:` item is selected, else all owned names with sent mail.

**Threads** (`'threads'`, group mail): `ThreadsMailbox` (`ThreadsMailbox.tsx:123-358`) lists up to 60 threads per group with threads (`qortal_qmail_thread_group<gid>` on service `MAIL`, `:61-121`), fetching the thread resource when `metadata.description` is missing. Picking a `threads-group:` sidebar item or a thread card sets `selectedGroup` (+`currentThread`) and Mail renders `GroupMail` (`GroupMail.tsx:65-729`): loads group members (`/groups/members/<id>?limit=0` + `getNameInfo` + `GET_ACCOUNT_DATA` per member, every 180 s `:420-467`), "Recently active" via the latest 100 `qortal_qmail_thmsg_group<gid>` messages (`:239-359`) or "Newest/Oldest" via paged thread search (`:133-238`), and when `currentThread` is set renders `Thread` (`Thread.tsx:41-356`): pages of 20 `qortal_qmail_thmsg_group<gid>_<threadId>` messages, each fetched+decrypted into `hashMapMailMessages` (`:54-78`), polled every 8 s (`:248-266`), posting via `NewThread` modal (`NewThread.tsx:78-718`, triggered by `openNewThreadMessageModal` event `Thread.tsx:306-312`), and recording viewed timestamps in `qmail_threads_viewedtimestamp_${name}`.

#### `qmail_state_v1` published mail state (`DOCUMENT_PRIVATE`)
Constants `MAIL_STATE_DOCUMENT_SERVICE='DOCUMENT_PRIVATE'`, `MAIL_STATE_DOCUMENT_IDENTIFIER='qmail_state_v1'` (`Mail.tsx:121-122`, now `:107-108`).
- **Tracked:** `localMailStateById` (`:2516-2554`) collects, for every inbox/alias/hash-map message, `{read: threadV2.length>0, subject}`; `hasPendingStateChanges` compares it with `publishedMailStateById` (`:2556-2563`) and drives the sidebar `!` badge.
- **Publish** (`publishMailStateToQdn`, `:2629-2708`; triggered by the `publish-mail-state` sidebar item `:3151-3155`): merges local into published entries with `updatedAt`, builds `{version:1, updatedAt, ownerAddress, names: ownedNameCandidates, messages}`, `objectToBase64`, fetches the user's own public key and `PUBLISH_QDN_RESOURCE {name: user.name, service DOCUMENT_PRIVATE, identifier qmail_state_v1, encrypt:true, publicKeys:[own]}`. This is the one QDN write that costs the user a publish besides sending mail and deleting sent mail.
- **Load** (`loadPublishedMailStateFromQdn`, `:2710-2819`; once per identity `:3340-3354`): starts `FETCH_QDN_RESOURCE base64` immediately; unless `qmail_auto_apply_qdn_state_<address>` is true it first searches (`limit 1`, `exactmatchnames`) and, if found, shows the `useConfirmationModal` "Load published QDN state?" with an "Always fetch and apply" checkbox (`:1147-1170`); then `DECRYPT_DATA` (falls back to plain decode), normalises `messages`, `setPublishedMailStateById`. Read ids are applied once to `mailMessages` and `combinedAliasInboxMessages` by injecting the synthetic `threadV2` marker (`:3285-3338`). Subjects in the document are only used for equality/pending detection, never displayed.

#### Every browser-storage key

| Key | Backend | Written/read at | Contents |
|---|---|---|---|
| `qmail_persistance_${name}` | localStorage | `GlobalWrapper.tsx:202,222,228`; `fetchMail.ts:96,108` | id → `{timestamp, subject (ENCRYPT_DATA'd string), attachments: boolean}`; capped to newest 500. |
| `qmail_watched_aliases_${address}` | localStorage | `Mail.tsx:171-207`, `:1605-1617` | `string[]` of watched aliases. |
| `qmail_alias_reply_links_${address}` | localStorage | `Mail.tsx:209-250`, `:1609-1622` | `{ [aliasLower]: replyAlias }`. |
| `qmail_alias_scan_checkpoint_${address}` | localStorage | `Mail.tsx:252-303`, `:2051-2069` | `{lastProcessedTimestamp, lastProcessedIdentifier, updatedAt}`. |
| `tourStatus-qmail` | localStorage | `Mail.tsx:1009-1010`, `:1592-1597`, `:1980` | `"dismissed"`. |
| `qmail:left-sidebar` | localStorage | `left-sidebar/react.tsx:17-18,59-65` via raw `localStorage` adapter `Mail.tsx:2911-2937` | `{pinned, open, activeItemId}` (orphaned since `d5f6dfd`). |
| `:app-shell` (prefix `''` + `:` + `app-shell`) | localStorage | `useQMailAppShell.ts:117-119`, `adapters.ts:45-49`, `app-shell/react.tsx:55,67-73` | `{textSize, authOnStartup, themeMode}`. |
| `qapp-lib:ratings:APP:app-library-APP-rating-qmails:qmail` | localStorage | `adapters.ts:78-79,95-119`; pollName `useQMailAppShell.ts:143`; service default `app-shell/react.tsx:229` | `{ [address|name|'anonymous']: 1-5 }` — ratings are local only. |
| `qmail_auto_apply_qdn_state_${addressLower}` | localStorage | `qdnStatePreference.ts:1-41`; read `Navbar.tsx:76-83` (deleted), `Mail.tsx:2713`; written `Navbar.tsx:337` (deleted), `Mail.tsx:2758` | `true|false`. |
| `qmail_compose_drafts_${address}` | localStorage | `NewMessage.tsx:215-277`, `:560-573`, `:794-875` | `{ "from::to": {draftId, fromName, toName, subject, value, aliasValue, showAlias, showBCC, bccNames, updatedAt} }`. |
| `qmail_deleted_sent_${username}` | localStorage | `SentMail.tsx:72-107`, `:326-343`, `:354-385` | `string[]` of tombstoned identifiers. |
| `qmail_threads_viewedtimestamp_${username}` | localStorage | `Thread.tsx:131-162`; read `GroupMail.tsx:475-483` | `{ "qmail_threads_<groupId>_<threadId>": {timestamp} }`, capped to 500. |
| localForage db `q-blog-general`, item `general-consent` | IndexedDB | `ConsentModal.tsx:10-30` | `true` once the welcome dialog was shown. |
| localForage dbs `q-blog-favorites`, `q-blog-favorites-${name}` | IndexedDB | `mailSlice.ts:4-6,72-76,90-94,112-116`; `blogSlice.ts:4-6,…`; `GlobalWrapper.tsx:48-51` | Q-Blog favourites; created but unused by any mail feature. |
| `qmailplus-ui-theme` | localStorage | `src/hub-theme/boot.ts:33-51` and the `index.html` boot snippet (live since `507641e`) | chosen theme id as a JSON string, e.g. `"hub30"`. |
| `window.localStorage.clear()` | — | `src/test/setup.ts:94` | test-only reset. |

No `sessionStorage` use.

#### Other `src/pages/Mail` files and shared pieces

| File | Role |
|---|---|
| `MailTable.tsx` | Legacy `SimpleTable` (imported `Mail.tsx:46`, now `:37`, never rendered) + **`AvatarWrapper`** (`:160-177`, reads `global.userAvatarHash`, alias icon when `isAlias`; a `useSelector` + `useMemo`, no effect, no network). |
| `MailboxSearchBar.tsx` | Search input with match/scan status (`:13-108`). |
| `useMailboxSearch.ts` | Local full-text search: matches sender/recipient/subject/body; for undecrypted rows runs `fetchAndEvaluateMail` with 3 workers (`SEARCH_CONCURRENCY`, `:35`, `:249-336`) and caches per id. |
| `mailIdentifier.ts` | `isSentMailIdentifier`, `parseSentRecipientFromIdentifier` (regex `qortal_qmail_([^_]+)(?:_([^_]+))?_mail_`, `:6`), `getSentRecipientGroupKey/DisplayLabel`. |
| `ChangelogPage.tsx` | Static changelog entries v1.0.0 → v3.2.1 (`:10-131`); the Settings page now has `ChangelogDialog.tsx`. |
| `Mail-styles.ts` | All styled containers; `MailContainer` height `calc(100vh - 78px)` (`:21-27`), `MailBodyInner` width 50% default (`:38-43`), `MailBodyInnerScroll` `calc(100% - 110px)` (`:55-83`). |
| `NewThread.tsx` | Modal used only inside `Thread` for posting to an existing thread (25 MB attachment limit `:77`). |
| `Chat.tsx`, `ChatInput.tsx`, `FlexLayout.tsx`, `ShowChatMessage.tsx` | tsconfig-excluded dead code. |
| `src/components/common/*` used: `LazyLoad` (IntersectionObserver "load more"), `Spacer`, `TextEditor` + `quillHtml.ts` + `DisplayHtml`, `ChipInputComponent`, `MultiplePublish`, `ConfirmationModal`/`useConfirmModal`, `useModal`, `Notification`, `PageLoader`, `LoaderBar`, `BlockedNamesModal`; `src/components/FileElement.tsx` (attachment download + save via DownloadWrapper); `src/components/editor/ReadOnlySlate.tsx` (legacy Slate bodies); `src/components/modals/ReusableModal.tsx`, `ConsentModal.tsx`. `AudioPlayer.tsx` was dropped by `224fb37`. |

#### Polling / timers (none pause when the tab is hidden; grep for `visibilitychange|document.hidden|visibilityState|hasFocus|pagehide` over `src/` returns zero matches)
Groups 600 s (`GlobalWrapper.tsx:238-243`, now `:236-241`); inbox 30 s (`Mail.tsx:1383-1388`, now `:1365-1373`); alias inbox 30 s (`AliasMail.tsx:223-228`); sent 30 s (`SentMail.tsx:514-519`); thread messages 8 s (`Thread.tsx:251-256`); group members 180 s (`GroupMail.tsx:458-460`); per-download status 5 s (`DownloadWrapper.tsx:98-187`); `OpenMail` refetch 7.5 s (`OpenMail.tsx:146-157`); `FileElement` refetch 7.5 s (`FileElement.tsx:237-251`).

#### Tests and scripts
`package.json:6-11`: `build = tsc && vite build`, `test = vitest run`; **no `lint` script**. `vitest.config.ts` includes `src/**/*.test.{ts,tsx}` with jsdom; tests at audit time were `src/components/common/TextEditor/quillHtml.test.ts` and `src/components/editor/ReadOnlySlate.test.tsx` (both listed in tsconfig `exclude` but still picked up by vitest); `507641e` added `src/pages/Settings/SettingsPage.test.tsx` and `src/theme/qplus-theme.test.ts`, `d5f6dfd` added `src/layout/layout.test.tsx`. At audit time `npx tsc --noEmit` exited 0 and `npx vitest run` passed 17/17.

### Data contract (binding)

Provenance: every identifier builder, JSON shape, the `DOCUMENT_PRIVATE`/`qmail_state_v1` document, the sent-mail tombstone and the ratings poll name are already present in the upstream import commit `6cf4c17` (Qortal/q-mail@main ddf3aa9). The only data-affecting change since import is `toQuill1Html()` applied to the HTML body before publish (`src/pages/Mail/NewMessage.tsx:1092`, `src/pages/Mail/NewThread.tsx:242`), which converts Quill 2 list/code HTML into the Quill 1 shape the original app writes. So "what the original app requires" below equals what this code's readers require. Every claim in this section was independently verified against the worktree; the two that were refuted are corrected in place and marked **(corrected)**.

#### 1. QDN services touched

| Service | Constant | Read | Write | Where |
|---|---|---|---|---|
| `MAIL_PRIVATE` | `MAIL_SERVICE_TYPE` `src/constants/mail.ts:1` | yes | yes | direct mail, BCC copies, alias mail, thread messages, sent tombstones |
| `MAIL` | `THREAD_SERVICE_TYPE` `src/constants/mail.ts:2` | yes | yes | group thread header (unencrypted) |
| `ATTACHMENT_PRIVATE` | `MAIL_ATTACHMENT_SERVICE_TYPE` `src/constants/mail.ts:3-4` | yes | yes | encrypted attachments |
| `DOCUMENT_PRIVATE` | `MAIL_STATE_DOCUMENT_SERVICE` `src/pages/Mail/Mail.tsx:121` (now `:107`) | yes | yes | published mailbox state `qmail_state_v1` — the **fourth** mail service; it is declared in `Mail.tsx`, not in `constants/mail.ts`, so a developer listing services from the constants file alone misses it |
| `THUMBNAIL` | literal | yes | no | `qortal_avatar`, `qortal_group_avatar_<groupId>` |
| `BLOG_POST` | literal | code only | no | Q-Blog leftovers in `src/hooks/useFetchMail.tsx` and `src/utils/fetchPosts.ts`; never invoked at runtime (§14) |
| `POLL` / `APP` rating | none | no | no | rating adapter is localStorage-only (§13) |

Two live sites bypass the constant with the string literal `'MAIL_PRIVATE'` (`NewMessage.tsx:1160`, `NewThread.tsx:370`); same value.

Non-QDN Core REST endpoints used: `/arbitrary/resources/search` (everywhere), `/groups/member/<address>` (`src/wrappers/GlobalWrapper.tsx:92-94`, now `:90-92`), `/groups/members/<groupId>?limit=0` (`src/pages/Mail/NewMessage.tsx:995-997`, `src/pages/Mail/GroupMail.tsx:422-424`), `/names/address/<address>` (`src/utils/apiCalls.ts:2`).

qortalRequest actions used: `PUBLISH_QDN_RESOURCE`, `PUBLISH_MULTIPLE_QDN_RESOURCES`, `FETCH_QDN_RESOURCE`, `DECRYPT_DATA`, `ENCRYPT_DATA`, `GET_NAME_DATA`, `GET_ACCOUNT_DATA`, `SEARCH_NAMES`, `GET_QDN_RESOURCE_URL`, `GET_QDN_RESOURCE_STATUS`, `GET_QDN_RESOURCE_PROPERTIES`, `SAVE_FILE`, `GET_USER_ACCOUNT`, `GET_ACCOUNT_NAMES`, `GET_PRIMARY_NAME`, `GET_LIST_ITEMS`, `DELETE_LIST_ITEM`, `NOTIFICATION_MARK_SEEN` (notification id `q-mail-notification`, `src/wrappers/GlobalWrapper.tsx:56-58`). No `SEARCH_QDN_RESOURCES`, `LIST_QDN_RESOURCES`, `GET_POLL`, `VOTE_ON_POLL` or `CREATE_POLL` exists in reachable code (the only `SEARCH_QDN_RESOURCES` is commented out at `useFetchMail.tsx:461`).

#### 2. Identifier builders (exact strings)

`uid()` is `new ShortUniqueId()()` (`src/pages/Mail/NewMessage.tsx:20,65`; `src/pages/Mail/NewThread.tsx:7,65`).

| Purpose | Builder | Service | File:line |
|---|---|---|---|
| Direct mail to a name | `` `_mail_qortal_qmail_${recipientName.slice(0,20)}_${recipientAddress.slice(-6)}_mail_${sendId}` `` | MAIL_PRIVATE | `src/pages/Mail/NewMessage.tsx:1232-1235` |
| Direct mail to an alias | `` `_mail_qortal_qmail_${aliasValue}_mail_${sendId}` `` (raw `aliasValue`, not trimmed, not sliced to 20) | MAIL_PRIVATE | `src/pages/Mail/NewMessage.tsx:1237-1239` |
| BCC copy (same `sendId`) | `` `_mail_qortal_qmail_${element.name.slice(0,20)}_${element.address.slice(-6)}_mail_${sendId}` `` | MAIL_PRIVATE | `src/pages/Mail/NewMessage.tsx:1255-1258` |
| Attachment | `` `attachments_qmail_${uid()}_${uid()}` `` | ATTACHMENT_PRIVATE | `src/pages/Mail/NewMessage.tsx:951-953`, `src/pages/Mail/NewThread.tsx:266-268` |
| Group thread header | `` `qortal_qmail_thread_group${groupId}_${threadToken}` `` | MAIL | `src/pages/Mail/NewMessage.tsx:1110`, `src/pages/Mail/NewThread.tsx:318` |
| Thread message (new thread) | `` `qortal_qmail_thmsg_group${groupId}_${threadToken}_${uid()}` `` | MAIL_PRIVATE | `src/pages/Mail/NewMessage.tsx:1111` |
| Thread message (reply) | `` `qortal_qmail_thmsg_${threadIdentifier.substring(indexOf("group"))}_${uid()}` `` → same shape as above | MAIL_PRIVATE | `src/pages/Mail/NewThread.tsx:327-330, 380-383` |
| Mailbox state doc | literal `qmail_state_v1` | DOCUMENT_PRIVATE | `src/pages/Mail/Mail.tsx:122` (now `:108`) |
| Own avatar | literal `qortal_avatar` | THUMBNAIL | `src/hooks/useFetchMail.tsx:246-251`, `src/wrappers/GlobalWrapper.tsx:66-71`, `src/pages/Mail/Mail.tsx:1741-1746`, `src/pages/Mail/GroupMail.tsx:118-123`, `src/pages/Mail/AliasMail.tsx:75-80` |
| Group avatar | `` `qortal_group_avatar_${groupId}` `` | THUMBNAIL | `src/pages/Mail/Mail.tsx:566, 613` |
| Sent tombstone | re-uses the original message identifier | MAIL_PRIVATE | `src/pages/Mail/SentMail.tsx:597-606` |

Prefix constants and parser (`src/pages/Mail/mailIdentifier.ts`):
- `SENT_IDENTIFIER_REGEX = /qortal_qmail_([^_]+)(?:_([^_]+))?_mail_/` (line 6), `SENT_IDENTIFIER_PREFIX = "_mail_qortal_qmail_"` (line 7), `LEGACY_SENT_IDENTIFIER_PREFIX = "qortal_qmail_"` (line 8), `THREAD_IDENTIFIER_PREFIX = "qortal_qmail_thread_"` (line 9), `THREAD_MESSAGE_IDENTIFIER_PREFIX = "qortal_qmail_thmsg_"` (line 10).
- Regex group 1 = recipient name (first 20 chars) or alias, group 2 = last-6 address chars (absent for alias mail). Because segments are `[^_]+`, a name or alias containing `_` is mis-parsed (lines 32-47).
- `isSentMailIdentifier` (lines 12-30): must contain `_mail_`, start with `_mail_qortal_qmail_` or the legacy `qortal_qmail_`, and not start with the two thread prefixes.

**The recipient is embedded in plain text, not hashed**: first 20 characters of the recipient's registered name plus the last 6 characters of the name owner's address (`NewMessage.tsx:1232-1235`; `recipientName = target.label` at `:1173`, `recipientAddress` = `GET_NAME_DATA(...).owner` at `:1174-1181`). Alias mail embeds the alias string verbatim (`:1238`). Only `data64` is encrypted; the identifier is QDN metadata and readable by anyone.

#### 3. Direct mail: send

Flow in `publishQDNResource` (`src/pages/Mail/NewMessage.tsx:1033-1300`):
1. Resolve recipient: `GET_NAME_DATA {name}` → `.owner` (`:1174-1181`), then `GET_ACCOUNT_DATA {address}` → `.publicKey` (`:1186-1196`).
2. BCC chips already carry `{name, publicKey, address}` resolved the same way (`src/components/common/ChipInputComponent/ChipInputComponent.tsx:8-12, 26-44`); `bccPublicKeys = bccNames.map(item => item.publicKey)` (`:1198`).
3. Build attachments (§6), then `mailObject` (`:1201-1212`), append reply history (`:1214-1229`), `objectToBase64(mailObject)` (`:1231`). The object is serialised **before** the alias branch, so `aliasValue` never reaches the JSON.
4. One `PUBLISH_QDN_RESOURCE`-shaped resource per copy: `{action:"PUBLISH_QDN_RESOURCE", name: senderName, service: MAIL_PRIVATE, data64, identifier}` (`:1241-1247`, BCC `:1260-1266`). No `title`/`description`/`tags` metadata on normal mail.
5. Publish everything in one call handed to `MultiplePublish` (`src/components/common/MultiplePublish/MultiplePublish.tsx:44-46,110-115`, one `qortalRequest(pub)` guarded by `hasStarted`; a second call happens only on the user-clicked "Try again" with the failed subset, `:88-101`):
   ```js
   { action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
     resources: [...attachmentPublishes, ...mailPublishes],   // attachments first, then primary mail, then BCC copies
     encrypt: true,
     publicKeys: [recipientPublicKey, ...bccPublicKeys] }      // NewMessage.tsx:1272-1277
   ```
   `senderName` is the selected From name (any owned name, `:1037,1328-1329`). When an alias is used, BCC copies are skipped (`:1250`) but any `bccPublicKeys` are **still** included in `publicKeys` (`:1276`), because the Alias and Bcc toggles are independent (`:1547-1550`). The sender's own key is not added client-side (Core adds the publisher's key), same as upstream.

##### 3a. Direct-mail JSON (decrypted payload of a MAIL_PRIVATE resource)

Written at `src/pages/Mail/NewMessage.tsx:1201-1229`; validated on read by `checkStructureMailMessages` (`src/utils/checkStructure.ts:35-46`).

| Field | Type | Written as | Required by reader? | Reader use |
|---|---|---|---|---|
| `subject` | string | `subject` state (may be `""`) | no — **(corrected)** the commented-out checks at `checkStructure.ts:38-39` are for `title` and `description` (Q-Blog leftovers); there has never been a `subject` check, commented or live | list row (`src/pages/Mail/MailMessageRow.tsx:162`), header (`src/pages/Mail/ShowMessageV2.tsx:172,211`), search, local subject cache (`fetchMail.ts:100`), state doc |
| `createdAt` | number (ms epoch, `Date.now()`) | `:1200,1203` | **yes, truthy** (`checkStructure.ts:40`) | timestamps, sort |
| `version` | number `1` | `:1204` | **yes, truthy** (`checkStructure.ts:41`) | nothing else |
| `attachments` | `AttachmentReference[]` (§6) | `:1205` | **yes, `Array.isArray`** (even `[]`) (`checkStructure.ts:42`) | attachment list |
| `textContentV2` | string, HTML (Quill 1 shape) | `toQuill1Html(value)` `:1092,1206` | no | body render (§15) |
| `generalData` | object | `{ thread: [], threadV2: [...] }` `:1207-1210` | **yes, `typeof === "object"`** (`checkStructure.ts:43`; note `typeof null === "object"`, so `generalData: null` also passes) | `thread` legacy history, `threadV2` reply history |
| `generalData.thread` | array | always `[]` | no | legacy: `src/pages/Mail/ShowMessage.tsx:93-144` fetches each `{identifier,name,service}` via search + decrypt (`src/pages/Mail/MailThread.tsx:80-139`) — dead path |
| `generalData.threadV2` | `Array<{ reference:{identifier,name,service:"MAIL_PRIVATE"}, data:<full decrypted replied-to message object> }>` | `:1215-1228` (`[...replyTo.generalData.threadV2, {reference:{identifier: replyTo.id, name: replyTo.user, service: MAIL_SERVICE_TYPE}, data: replyTo}]`; `isReply = Boolean(replyTo?.id)` at `:1040`) | no | `src/pages/Mail/ShowMessageV2.tsx:328-337` sorts by `data.createdAt` and renders each `data` (`ShowMessageV2Replies.tsx`); also `src/pages/Mail/MailThreadWithoutCalling.tsx:85-87`; **read-state readers treat a non-empty `threadV2` as "read"** (`GroupedMailboxList.tsx:55-58`, `MailMessageRow.tsx:153-155`, `Mail.tsx:2524-2528`) |
| `recipient` | string (recipient's real name; BCC copies get the BCC name, `:1253`) | `:1211` | no | alias scan (`Mail.tsx:2300-2312`), sent delete recipient resolution (`SentMail.tsx:260-262`), compose suggestions (`Mail.tsx:1310-1312`) |

Two consequences of `data: replyTo` being the **in-memory** object (`{...searchRow, ...decryptedJson, user, title, createdAt, id, isValid}`, `src/utils/fetchMail.ts:73-82`), not the bare published JSON: (a) each hop embeds the whole previous message including its own `generalData.threadV2`, so payloads grow geometrically with thread length (Bugs #12); (b) a locally injected read-marker entry `{reference, data:{markedAsReadLocally:true, createdAt}}` (`Mail.tsx:2423-2435`) can be carried into a published reply's `threadV2` via `previousThread`, if the reply is built from the list copy. Readers only need `data.user/createdAt/subject/attachments/textContentV2` (`ShowMessageV2Replies.tsx`), so stripping `data.generalData` before embedding is additive-safe.

Legacy read-only fields the readers still honour but this app never writes: `textContent` (Slate JSON, §15), `htmlContent` (raw HTML sanitized with DOMPurify, `ShowMessageV2.tsx:63-65,80-82,316`), `to` (displayed `ShowMessageV2.tsx:156`; read by alias scan `Mail.tsx:2313-2319`). `to` on in-memory messages is injected locally: `openMessage` passes `to` into `mailInfo` (`Mail.tsx:1429-1434`, value from `MailMessageRow.tsx:233-238`: username for inbox, alias/resolved name for sent) and `fetchAndEvaluateMail` spreads `...content` (`src/utils/fetchMail.ts:75`).

The decrypted object stored in Redux is `{...searchRow, ...decryptedJson, user, title, createdAt, id: identifier, isValid: true}` (`src/utils/fetchMail.ts:73-82`), keyed by identifier (`src/state/features/mailSlice.ts:193-196`). Unknown extra JSON fields survive this spread.

**(corrected) Validation scope.** `checkStructureMailMessages` runs only on the direct-mail path via `fetchAndEvaluateMail` (`src/utils/fetchMail.ts:73`; callers `useFetchMail.tsx:88`, `OpenMail.tsx:55`, `MailThread.tsx:125`, `MailThreadWithoutCalling.tsx:15`, `useMailboxSearch.ts:283`). The group-thread reader `Thread.tsx:56-75` and `:207-230` decrypts and spreads the decoded JSON straight into the store with **no structure check at all**; the alias scan (`Mail.tsx:2284-2318`) also decodes bodies with no check (it only reads `recipient`/`to` with `typeof` guards).

##### 3b. Direct mail: how the receiver finds it
- Primary inbox: `` query = `qortal_qmail_${recipientName.slice(0,20)}_${recipientAddress.slice(-6)}_mail_` ``, `/arbitrary/resources/search?mode=ALL&service=MAIL_PRIVATE&query=<q>&limit=200&includemetadata=false&offset=N&reverse=true&excludeblocked=true`, paged until a short or empty page (`src/hooks/useFetchMail.tsx:277-325`; loop `:290-311`). No `name`, `namefilter`, `exactmatchnames`, `identifier` or `prefix` parameter: any publisher's resource whose identifier **contains** the substring is treated as inbox mail. The query deliberately omits the `_mail_` prefix, so both current (`_mail_qortal_qmail_...`) and legacy (`qortal_qmail_...`) identifiers match. Because `includemetadata=false`, the `metadata.title/description` fields `mapMailResources` copies (`:261-275`) are undefined for inbox rows.
- New-mail poll: same query, `limit=20&includemetadata=true`, every 30 s, sliced at the newest known id (`useFetchMail.tsx:97-140`, URL `:105`; interval `src/pages/Mail/Mail.tsx:1380-1398`, now `:1365-1373`).
- Extra owned names (combined inbox): `fetchInboxMessagesForOwnedName` runs two queries per name, `byAddressQuery` (as above) and `` byAliasQuery = `qortal_qmail_${name}_mail_` ``, `limit 200`, `includemetadata=true`, offset-paged, and keeps only identifiers that `startsWith("_mail_" + query)` (`Mail.tsx:795-900`, matcher `:817-836`). Legacy non-`_mail_` identifiers are therefore dropped for secondary names but kept for the primary name.
- Sidebar activity probes: `limit=1`/`limit=20` variants of the same queries (`Mail.tsx:639-777`).
- Open/decrypt: `openMessage` → `OpenMail` (`src/pages/Mail/OpenMail.tsx:82-127`) → `GET_QDN_RESOURCE_STATUS`; when `READY`, `fetchAndEvaluateMail({user, messageIdentifier, content, otherUser: name})` (`OpenMail.tsx:95-100`; `otherUser` is the publisher/sender, so the `GET_NAME_DATA`/`GET_ACCOUNT_DATA` pair resolves the sender's key despite `fetchMail.ts:37/43` naming the variables `recipientAddress/recipientPublicKey`).

##### 3c. Sent mail identification
Sent mail is found by publisher name, not by identifier alone (`src/pages/Mail/SentMail.tsx:45-59, 394-486`): for each owned name in `activeInstanceNames` (`:280-295`; from `Mail.tsx:3504-3516`), two configs: `{query:"_mail_qortal_qmail_", identifier:"_mail_"}` and legacy `{query:"qortal_qmail_"}`, each with `name=<ownName>&exactmatchnames=true&mode=ALL&limit=200&includemetadata=true&offset=N&reverse=true&excludeblocked=true` (`:411-428`), paged; rows kept only if `queryConfig.matchesIdentifier` (`:448`), `isSentMailIdentifier` (`:449`) and not a tombstone or locally deleted (`:450`). Sent rows are grouped by `getSentRecipientGroupKey` (`mailIdentifier.ts:49-69`) and labelled by `getSentRecipientDisplayLabel` (`:71-84`). The full recipient name is recovered from the 20-char prefix + 6-char address suffix via `SEARCH_NAMES {query: recipientName, prefix: true, limit: 10|200}` and matching `owner.endsWith(suffix)` (`src/pages/Mail/MailMessageRow.tsx:108-144`, `SentMail.tsx:193-251`).

#### 4. Encryption call shapes (binding)
- Publish: `PUBLISH_MULTIPLE_QDN_RESOURCES` with `encrypt: true` and an explicit `publicKeys` list (`NewMessage.tsx:1163-1168` group, `:1272-1277` direct; `NewThread.tsx:337-342, 390-395`; tombstone `SentMail.tsx:608-613`). The state document uses a single `PUBLISH_QDN_RESOURCE` with `encrypt: true, publicKeys: [ownPublicKey]` (`Mail.tsx:2670-2678`). `global.d.ts:44-45` declares `encrypt?: boolean; publicKeys?: string[]`.
- `data64` is produced by `objectToBase64`: `JSON.stringify` → `Blob('application/json')` → `FileReader.readAsDataURL` (`onloadend`) → `.replace('data:application/json;base64,', '')` (`src/utils/toBase64.ts:11-40`; string-literal first-occurrence replace). Attachments use `toBase64(file)` (data URL) and take `split(",")[1]` (`toBase64.ts:1-9`; `NewMessage.tsx:945-950`).
- Read: `FETCH_QDN_RESOURCE {name, service, identifier, encoding: "base64"}` (`src/utils/fetchMail.ts:23-29`) → `GET_NAME_DATA {name: otherUser}.owner` → `GET_ACCOUNT_DATA {address}.publicKey` (`:31-43`) → `DECRYPT_DATA {encryptedData: <base64>, publicKey}` (`:44-53`) → `base64ToUint8Array` (`toBase64.ts:98-108`, `atob` loop) → `uint8ArrayToObject` = `TextDecoder` + `JSON.parse` (`:110-119`) → `checkStructureMailMessages` (`:73`). On decrypt failure the row is stored as `{unableToDecrypt: true, id, user}` (`fetchMail.ts:58-70`).
- Variants that call `DECRYPT_DATA {encryptedData}` without `publicKey` (Hub decrypts with the current user's own key): thread messages (`src/pages/Mail/Thread.tsx:63-67, 214-218`), alias scan (`Mail.tsx:2291-2295`, now `:2272-2276`), attachments (`src/components/FileElement.tsx:135-138`), state doc (`Mail.tsx:2767-2771`), cached subjects (`MailMessageRow.tsx:37-41`).
- `ENCRYPT_DATA {data64}` (no keys, i.e. to self) is used only for the local subject cache (`fetchMail.ts:85-101`), and only when `username` is set, the subject is non-empty and `qmail_persistance_<username>` has no entry yet (`:95-101`).
- Search-time decryption tries `otherUser` candidates in order: parsed sent-recipient name, then `message.user` (`src/pages/Mail/useMailboxSearch.ts:116-135, 263-290`).

#### 5. (reserved)

#### 6. Attachments
Publish item (`src/pages/Mail/NewMessage.tsx:109-118, 959-968`): `{ name: publisherName, service: "ATTACHMENT_PRIVATE", filename: `${id}.${ext}` (reuses the first uid), originalFilename, identifier: "attachments_qmail_<id>_<id2>", data64: <raw file base64>, type: <mime|null>, size }`. `NewThread.tsx:273-281` is the same minus `size`. Limits: 40 MB (`NewMessage.tsx:66`), 25 MB in thread composer (`NewThread.tsx:77`); files without an extension are refused (`NewMessage.tsx:1039,1067-1070`). Attachments are published in the same `PUBLISH_MULTIPLE_QDN_RESOURCES` call as the mail, with the same `publicKeys` (`:1274-1276`; thread `:1165`).

Reference stored inside message JSON `attachments[]` — **two writers, two shapes**:

| Field | NewMessage (`:120-128, 971-979`) | NewThread (`:287-296`) | Reader use |
|---|---|---|---|
| `identifier` | string | string | fetch/decrypt (`FileElement.tsx:111-133`) — **required** |
| `name` | string (publisher) | string | fetch — **required** |
| `service` | `"ATTACHMENT_PRIVATE"` | same | fetch — **required**; also hides mail downloads in the task manager (`src/components/common/DownloadTaskManager.tsx:79-86`) |
| `filename` | `<id>.<ext>` | same | fallback label / save name |
| `originalFilename` | string | string | display + save name (`ShowMessageV2.tsx:276`, `FileElement.tsx:155-157`) |
| `type` | mime string or `null` | `attachment?.type` (may be `undefined`) | passed as `mimeTypeSaved` (`ShowMessageV2.tsx:260`), Blob type (`FileElement.tsx:120,143-149`) |
| `size` | number | **absent** | never read by any reader |

Readers only require `identifier`, `name`, `service` (`FileElement.tsx:111, 204, 220`); `filename`/`originalFilename`/`type` are display/MIME hints; `size` is write-only (`NewMessage` only).

Fetch chain: `FileElement` click → `downloadVideo` context → `GET_QDN_RESOURCE_PROPERTIES` + `GET_QDN_RESOURCE_URL`, then `GET_QDN_RESOURCE_STATUS` every 5 s until `READY` (`src/wrappers/DownloadWrapper.tsx:44-194`); on `READY` (second click): `GET_QDN_RESOURCE_PROPERTIES` for `filename`/`mimeType` (`:113-120`), `FETCH_QDN_RESOURCE` base64 (`:127-133`), `DECRYPT_DATA {encryptedData}` (`:135-138`), `new Blob([bytes],{type})` (`:141-149`), `SAVE_FILE {blob, filename: originalFilename || filename, mimeType}` (`src/components/FileElement.tsx:152-159`). The `GET_QDN_RESOURCE_URL` result is stored but never used as a `src`; bytes always come via `FETCH_QDN_RESOURCE` + `DECRYPT_DATA`.

**Q-Mail+ PDF preview (round 5):** a PDF attachment gets Q-Share+'s file card (icon, name, "PDF · size", Download → Save, Open PDF). Open PDF fetches and decrypts the attachment once (`FETCH_QDN_RESOURCE` + `DECRYPT_DATA`, session cache), checks the `%PDF-` header, and sends `SHOW_PDF_READER {blob}` with the decrypted bytes typed `application/pdf` (`src/utils/pdf/hubPdfReader.ts`). Hub hands the Blob to its own pdf.js viewer in memory: nothing is uploaded, written or published, and no QDN reference leaves the app. If Hub does not answer in 5 s (an older Hub, or no Hub), the bundled pdf.js viewer opens instead for the rest of the session. Files over 100 MB are saved, not opened. No data format changes.

#### 7. Group threads
Thread header (service `MAIL`, unencrypted, single `PUBLISH_QDN_RESOURCE` sent immediately with `await qortalRequest` outside the later multiple-publish batch): `{action:"PUBLISH_QDN_RESOURCE", name: senderName, service:"MAIL", data64, identifier: "qortal_qmail_thread_group<groupId>_<threadToken>", description: threadTitle.slice(0,200)}` (`NewMessage.tsx:1120-1128`; `NewThread.tsx:319-326,343`). No `encrypt`/`publicKeys` keys. JSON `{ title: string, groupId: string, createdAt: number, name: string }` (`NewMessage.tsx:1113-1118`; `NewThread.tsx:311-316`; `NewMessage` writes `groupId` as a string, `NewThread` as whatever the API returned, and every consumer interpolates it). Readers take the title from resource `metadata.description` first and only `FETCH_QDN_RESOURCE` the JSON (`.title`) when description is empty (`src/pages/Mail/GroupMail.tsx:166-201, 309-338`; `src/pages/Mail/ThreadsMailbox.tsx:37-59`; GroupMail uses truthiness, ThreadsMailbox trims; on fallback failure GroupMail drops the thread, ThreadsMailbox shows "Untitled thread" `:97`). `groupId`/`createdAt`/`name` in the JSON are ignored; the thread's group and owner come from the identifier and resource `name`. Titles longer than 200 chars show truncated via the metadata path.

Thread message (service `MAIL_PRIVATE`, encrypted to all group members): JSON `{ subject, createdAt, version: 1, attachments, textContentV2, name: senderName, threadOwner }` (`NewMessage.tsx:1130-1138`, `subject` = thread title, `threadOwner = senderName`; `NewThread.tsx:237-245`, `subject` = `""`, `threadOwner = currentThread.threadData.name || name`). No `generalData`, no `recipient`. `publicKeys` = every group member's key: NewMessage fetches `/groups/members/<id>?limit=0` → `GET_ACCOUNT_DATA` per member address in parallel (`NewMessage.tsx:990-1031`), silently dropping members whose lookup fails or has no key (`:1019-1028`) and throwing "No group members were found for encryption" if none (`:1103-1105`); NewThread uses the `members` map built by GroupMail (`GroupMail.tsx:420-452`), which only includes members that have a registered name (`:431-443`), so nameless members are excluded from replies but included in new threads started from the main composer.

Listing: threads by `service=MAIL&query=qortal_qmail_thread_group<groupId>` (`GroupMail.tsx:141-151` limit 20 paged; `ThreadsMailbox.tsx:67-76` limit 60; `Mail.tsx:538-546` limit 1). The query has no trailing `_` and is a substring match, so group `1` also matches groups `10`, `11`, … "Recently active" = `service=MAIL_PRIVATE&query=qortal_qmail_thmsg_group<groupId>&limit=100` plus one `name=` param per member (`GroupMail.tsx:245-256`), thread token = second-from-last `_` segment (`:268-270`), thread id rebuilt as `qortal_qmail_thread_group<groupId>_<token>` (`:280`). Messages in a thread: `query=qortal_qmail_thmsg_group<groupId>_<token>&limit=20` paged (`src/pages/Mail/Thread.tsx:87-94`), token = last `_` segment of the thread id (`:87-90`); each is `FETCH_QDN_RESOURCE` + `DECRYPT_DATA {encryptedData}` (no `publicKey`) and merged as `{...searchRow, ...(decrypted || {}), id: identifier}` (`Thread.tsx:54-78`; same in the poll `:207-228`); rendered from `message.name`, `message.created` (search row), `attachments`, `textContent`/`textContentV2`/`htmlContent` (`src/pages/Mail/ShowMessageWithoutModal.tsx:86-92, 193-201`). Thread poll every 8 s (`Thread.tsx:248-257`), members every 180 s (`GroupMail.tsx:454-466`), group list every 600 s (`GlobalWrapper.tsx:232-246`).

#### 8. Aliases
- Sending to an alias: identifier `_mail_qortal_qmail_<alias>_mail_<sendId>` (`NewMessage.tsx:1237-1239`); the JSON still carries `recipient: <real name>` (`:1211`) and the payload is still encrypted to the real recipient's public key (`:1276`); BCC copies are skipped (`:1250`). Replying from an alias inbox requires a sender alias, and it must differ from the inbox alias (`:1055-1066`).
- Reading an alias inbox (`src/pages/Mail/AliasMail.tsx:106-198`): two queries, `qortal_qmail_<alias.slice(0,20)>_<ownAddress.slice(-6)>_mail_` and `qortal_qmail_<alias>_mail_`, `limit=200&includemetadata=true` paged (offset restarts at 0 on every call, `:143`), filtered to identifiers starting with `_mail_<query>`; 30 s refresh (`:219-237`). Sidebar activity probe `Mail.tsx:754-777`.
- Alias discovery scan (`Mail.tsx:2078-2403`, now `:2059-2328`): pages the entire `service=MAIL_PRIVATE&query=qortal_qmail_` space with no `name` param (`:2147-2156`, now `:2128-2137`; `query=` is a substring match, so it also catches `_mail_qortal_qmail_…`), keeps identifiers whose regex match has no address segment (`:2181-2183`), skips owned names, then `FETCH_QDN_RESOURCE` + `DECRYPT_DATA` each sequentially and reads `recipient`/`to` (`:2284-2319`, now `:2265-2276` for the two requests). The checkpoint is a client-side filter only (`:2174-2178` now) and does not shorten the paging.
- Alias bookkeeping is local only: `qmail_watched_aliases_<address>` (`Mail.tsx:171-207`), `qmail_alias_reply_links_<address>` (`:209-250`), `qmail_alias_scan_checkpoint_<address>` (`:252-303`).

#### 9. Avatars **(corrected)**
`GET_QDN_RESOURCE_URL {name, service:"THUMBNAIL", identifier:"qortal_avatar"}`, result cached in Redux `userAvatarHash[name]` (`src/state/features/globalSlice.ts:110-115`; `AvatarWrapper` `src/pages/Mail/MailTable.tsx:160-177`). It is **not** called once per list row: `getAllMailMessages` pages the **whole** inbox (pageSize 200, `useFetchMail.tsx:282-310`) and then fires an un-awaited `getAvatar(content.user)` for **every message resource** (`useFetchMail.tsx:244-259, 315-319`), with no dedupe by sender and no check of the existing `userAvatarHash`, on every mount/name change (`Mail.tsx:1556-1565`). The inbox list renders one avatar per sender group (`GroupedMailboxList.tsx:408-413`) and `MailMessageRow` only reads the hash (`:361`), so the needed count is unique senders, not messages. The 30 s `checkNewMessages` poll (`useFetchMail.tsx:97-140`) fetches no avatars, so senders that arrive by poll have none until the next full reload. The same per-message pattern is duplicated in `AliasMail.tsx:73-88` + `:205-209` (re-fired every 30 s) and per-thread in `GroupMail.tsx:116-130` + `:341` (awaited inside `Promise.all`); the unused `useFetchMail.getMailMessages` has a third copy (`:349-353`). Only the owned-name loop in `Mail.tsx:1731-1764` checks the cache first (`:1737`). The reducer stores any truthy string, so the `"Resource does not exist"` sentinel (which `GlobalWrapper.tsx:72` and `Mail.tsx:617` filter) is stored unfiltered by `useFetchMail` and handed to `<Avatar src>` (`MailTable.tsx:175-176`). Group avatar: raw REST search `service=THUMBNAIL&identifier=qortal_group_avatar_<groupId>&limit=1&mode=ALL&reverse=true&excludeblocked=true` to learn the publisher name (`Mail.tsx:551-592`; the `identifier` param is a substring match, so `qortal_group_avatar_1` can match group 10's avatar), then `GET_QDN_RESOURCE_URL` with that name only when a publisher was found (`:594-624`, early return at `:606`).

#### 10. Published mail state (`DOCUMENT_PRIVATE` / `qmail_state_v1`)
Publish (`Mail.tsx:2629-2708`, now `:2610`): `PUBLISH_QDN_RESOURCE { name: user.name, service:"DOCUMENT_PRIVATE", identifier:"qmail_state_v1", data64, encrypt:true, publicKeys:[ownPublicKey] }` (`:2670-2678`; own key from `GET_ACCOUNT_DATA {address}` `:2656-2661`; if that returns no key, `publicKeys` degrades to `[]`, `:2677`; an explicit `ENCRYPT_DATA` step is commented out `:2663-2668`). Published only under the primary name but covers messages of every owned name.

Exact JSON (`QMailPublishedStateDocument`, `Mail.tsx:337-349`, built `:2646-2652`):
```json
{
  "version": 1,
  "updatedAt": <ms epoch>,
  "ownerAddress": "<user.address>",
  "names": ["<owned name>", ...],
  "messages": {
    "<mail identifier>": { "read": true, "subject": "<plaintext subject>", "updatedAt": <ms epoch> }
  }
}
```
Entry fields are all optional; `read` is only ever `true` or omitted, `subject` is omitted when empty (`normalizePublishedStateEntry` `:371-385`). Subjects are stored in plaintext inside the encrypted document (`:2530-2544`). Merge rule on republish: `read` OR, newer subject wins, max `updatedAt` (`:387-402`).

Load (`:2710-2819`, now `:2691`): `FETCH_QDN_RESOURCE base64` is fired first, unconditionally (`:2716-2722`); when auto-apply is off (`:2713, 2726`), a raw REST `search?service=DOCUMENT_PRIVATE&identifier=qmail_state_v1&name=<user.name>&exactmatchnames=true&limit=1` decides whether to prompt (`:2727-2750`) and the modal gates applying (`:2752`); then `DECRYPT_DATA {encryptedData}` with fallback to plain base64 JSON on any throw (`:2766-2775`); only `decoded.messages` is read (`:2778-2792`); `version`, `ownerAddress`, `names` are ignored; an entry is dropped only when it has **neither** a truthy `read` **nor** a non-empty trimmed `subject` (`:2790`; an entry with only `updatedAt` is dropped). If nothing survives the load is a no-op (`:2794`). Auto-apply preference: localStorage `qmail_auto_apply_qdn_state_<address>` (`src/utils/qdnStatePreference.ts:1-14`, reader `:16-27`). Runs once per authenticated identity (`:3340-3354`).

Local read state: a message counts as read when `generalData.threadV2` is a non-empty array (`Mail.tsx:2524-2528`, `src/pages/Mail/GroupedMailboxList.tsx:55-58`, `MailMessageRow.tsx:153-155`). Marking read locally injects a fake entry `{reference:{identifier,name,service:"MAIL_PRIVATE"}, data:{markedAsReadLocally:true, createdAt}}` into the list copy only (`Mail.tsx:2405-2441`), never into the decrypted hash-map object that replies are built from, so it is not republished (unless the reply happens to be built from a list entry, see §3a).

**Q-Mail+ additive keys (ignored by the original, §16):** `archived: { "<id>": { at } }` and, since feat-quality2, `settings: { uiTheme, textSize, watchedAliases: string[], aliasReplyLinks: { "<alias>": "<reply alias>" } }` (`src/utils/mailStateDocument.ts`). `settings` is written from the device's current values on every publish; on load the alias lists are unioned into the local ones (local wins on conflicts) and the theme/text size are only remembered for Settings → Sync → "Restore appearance from the published state", never applied by themselves. Unknown theme ids and text sizes are dropped on load; a document without `settings` parses exactly as before. Since feat-footer, `settings` may also carry `footer: { default: string, byName: { "<name>": string }, inReplies: boolean }` (written last, only when there is footer text); on load, and before a publish that never loaded the document, it is applied only when this device has never set a footer (no `qmail_footer_<address>` key), so a local footer is never replaced and a cleared one stays cleared. A document without `footer` parses as before.

#### 11. Sent-message "delete" (tombstone republish)
`SentMail.tsx:535-653`: recipient re-resolved from the identifier (or cached `recipient`/`to`), then a `PUBLISH_MULTIPLE_QDN_RESOURCES { resources:[tombstone], encrypt:true, publicKeys:[recipientPublicKey] }` (`:608-613`) where tombstone = `{ action:"PUBLISH_QDN_RESOURCE", name: senderName, service:"MAIL_PRIVATE", identifier: <same id>, data64, title:"__qmail_deleted__", description:"Q-Mail sent message deleted by sender", tags:["qmail-deleted"] }` (`:597-606`; constants `:35-36`) and the payload is `{ subject:"__qmail_deleted__", createdAt, version:1, attachments:[], textContentV2:"", generalData:{ deleted:true, deletedAt, thread:[], threadV2:[] }, recipient }` (`:575-589`). Sent lists hide rows whose `metadata.title === "__qmail_deleted__"` or tags include `qmail-deleted` (`:109-138`; `Mail.tsx:626-637`) plus local `qmail_deleted_sent_<username>` (`:72-107`). No reader inspects `generalData.deleted`; detection is metadata-only. The inbox side does not filter tombstones; the recipient (and the original app) sees a message with subject `__qmail_deleted__` and empty body. This is the only place metadata `title`/`tags` are set on a MAIL_PRIVATE resource.

#### 12. Local (non-QDN) storage keys that are part of the app's data model

| Key | Shape | File:line |
|---|---|---|
| `qmail_persistance_<username>` | `{[identifier]: {timestamp, subject: <ENCRYPT_DATA base64 or "">, attachments: boolean}}`, capped to 500 | `src/utils/fetchMail.ts:95-110`; `GlobalWrapper.tsx:199-230`; decrypt `MailMessageRow.tsx:24-59` |
| `qmail_compose_drafts_<address>` | `{[from::to]: StoredComposeDraft}` | `NewMessage.tsx:155-166, 215-285` |
| `qmail_watched_aliases_<address>`, `qmail_alias_reply_links_<address>`, `qmail_alias_scan_checkpoint_<address>` | see §8 | `Mail.tsx:171-303` |
| `qmail_auto_apply_qdn_state_<address>` | boolean | `qdnStatePreference.ts` |
| `qmail_footer_<address>` (Q-Mail+) | `{ default, byName: {"<name>": text}, inReplies }`, plain text with `\n` | `src/utils/mailFooter.ts` |
| `qmail_deleted_sent_<username>` | `string[]` identifiers | `SentMail.tsx:72-107` |
| `qmail_threads_viewedtimestamp_<username>` | `{["qmail_threads_<groupId>_<threadId>"]: {timestamp}}`, capped 500 | `Thread.tsx:131-162`; read `GroupMail.tsx:474-482` |
| `tourStatus-qmail` | `"dismissed"` | `Mail.tsx:1009-1010, 1592-1597, 1980` |
| localForage `q-blog-general` → `general-consent` | boolean | `src/components/modals/ConsentModal.tsx:10-30` |
| localForage `q-blog-favorites-<name>` | created, never written at runtime | `GlobalWrapper.tsx:48-51` |
| `qapp-lib:ratings:APP:app-library-APP-rating-qmails:qmail` | `{[identity]: 1..5}` | `src/qapp-lib/app-shell/adapters.ts:78-79, 91-119` |
| qapp-lib shell settings with prefix `""` (keys `:<name>`), sidebar storage | | `src/app-shell/useQMailAppShell.ts:117-119`; `adapters.ts:45-57`; `Mail.tsx:2911-2951` |

#### 13. Ratings poll
Configured as `rating: { enabled: true, pollName: "app-library-APP-rating-qmails" }` with service defaulting to `"APP"` (`src/app-shell/useQMailAppShell.ts:141-144`, string at `:143`; `src/qapp-lib/app-shell/react.tsx:229-230, 384-385`). `createQortalRatingAdapter` ignores its `qortalRequest` option (`adapters.ts:91-93`, param `_options`) and reads/writes votes only in localStorage (`:95-118`). No `POLL` resource, `GET_POLL` or `VOTE_ON_POLL` request exists in the reachable code; the changelog's "qmails ratings poll" line (`src/pages/Mail/ChangelogPage.tsx:66`) describes upstream intent, not current behaviour. If a real on-chain poll is wired later, the name to stay compatible with is `app-library-APP-rating-qmails`.

#### 14. BLOG* leftovers still reachable
- `src/hooks/useFetchMail.tsx` still defines `getBlogPosts`/`getNewPosts`/`getBlogFilteredPosts`/`getBlogPostsSubscriptions` searching `service=BLOG_POST&query=q-blog-` (`:146, 206, 368, 414`) and `getBlogPostsFavorites` searching `BLOG_POST` by `identifier=<id>&exactmatchnames=true&name=…` (`:476`); `src/utils/fetchPosts.ts:15` fetches `/arbitrary/BLOG_POST/<user>/<postId>`. They are returned from the hook (`:517-529`) but `Mail.tsx:1361` (now `:1346`) only destructures `getAllMailMessages` and `checkNewMessages`; `GroupMail.tsx:29` and `AliasMail.tsx:19` import the hook without calling it. Dead at runtime, but bundled.
- `src/state/features/blogSlice.ts` is registered in the store (`src/state/store.ts:15`); `state.blog.hashMapPosts` is selected but unused (`GroupMail.tsx:87-89`, `AliasMail.tsx:52-54`). Its `BlogPost` type is the row type for mail lists (`useFetchMail.tsx:261-275`; `mailSlice.ts:47-62`). `mailSlice` itself is a copy of blogSlice with `name: 'blog'` (`mailSlice.ts:131`) plus mail reducers.
- localForage instances `q-blog-favorites` / `q-blog-favorites-<name>` (`mailSlice.ts:4-6, 72-76`; `blogSlice.ts:4-6`; `GlobalWrapper.tsx:48-51`) and `q-blog-general` consent (`ConsentModal.tsx:10-12`).
- `src/utils/blogIdformats.ts` (`q-blog-` prefix helpers) imported by `GroupMail.tsx:25`, `AliasMail.tsx:15`, `src/components/common/DownloadTaskManager.tsx:20`; `DownloadTaskManager` (imported at `DownloadWrapper.tsx:10`, rendered nowhere: `:220` is commented out) still navigates to `/<user>/<blogId>/<postId>` (`:163-171`) and special-cases `AUDIO`/`VIDEO` services (`:157, 182-188`).
- No reachable code writes any BLOG* service. `BLOG_COMMENT`, `BLOG`, `VIDEO`, `AUDIO`, `FILE` publishing exists only in excluded files.

#### 15. Body formats and reader precedence
- Current format: `textContentV2` = HTML string produced by react-quill-new and normalised to Quill 1 markup (`<ul>`/`<ol>`, `<pre class="ql-syntax">`, no `data-list`/`ql-ui`) by `toQuill1Html` (`src/components/common/TextEditor/quillHtml.ts:1-63`; early return on Quill 1/plain HTML, `span.ql-ui` removal, code-block container → `<pre class="ql-syntax" spellcheck="false">`, `<ol><li data-list=…>` → `<ul>`/`<ol>`/`<ul data-checked>` with run-splitting, `ql-indent-N` preserved; idempotent; 17 unit tests pass); rendered via `DisplayHtml` = `DOMPurify.sanitize(toQuill1Html(html), {USE_PROFILES:{html:true}})` + `convertQortalLinks` (`src/components/common/TextEditor/DisplayHtml.tsx:19-27`; `utils.ts:1-12`).
- Legacy format 1: `textContent` = Slate node array (`paragraph`, `heading-2`, `heading-3`, `block-quote`, `code-block`, `code-line`, `link`; marks `bold`/`italic`/`underline`/`code`/`link`), rendered by `ReadOnlySlate` (`src/components/editor/ReadOnlySlate.tsx:1-96`). `extractTextFromSlate` (`src/utils/extractTextFromSlate.ts`) is the text extractor.
- Legacy format 2: `htmlContent` raw HTML, DOMPurify-sanitised (`ShowMessageV2.tsx:79-82, 316`).
- Reader precedence is **not exclusive**: `ShowMessageV2` renders `textContentV2` (`:315`), then `htmlContent` (`:316`), and `textContent` (`:344`) each if present; same in `ShowMessage.tsx:253-261`, `ShowMessageWithoutModal.tsx:193-201`, `MailThreadWithoutCalling.tsx:195-200`. Legacy `MailThread.tsx:265-270` renders only `textContent`. `ShowMessageV2Replies.tsx:251-259` renders `textContentV2` alone.
- Reply quote and previews pick one: `textContentV2` → `textContent` (array → Slate text; string → as is) → `htmlContent` (`NewMessage.tsx:755-775`). The forward path uses the opposite preference: `textContentV2` first, then overwritten by sanitized `htmlContent` if present (`ShowMessageV2.tsx:58-65`).
- Search reads `textContentV2` only (string, or array via `extractTextFromSlate`) and never `textContent` (`src/pages/Mail/useMailboxSearch.ts:57-66`), so legacy Slate bodies are not searchable.

#### 16. What is binding for compatibility vs where additive data can go

**Binding (do not change):**
1. Identifier builders in §2 verbatim, including `slice(0,20)`/`slice(-6)`, the leading `_mail_` on new direct mail, the `attachments_qmail_<uid>_<uid>` shape, `qortal_qmail_thread_group<gid>_<token>` / `qortal_qmail_thmsg_group<gid>_<token>_<uid>` (readers derive the token positionally from `_` splits: `GroupMail.tsx:268-270`, `Thread.tsx:87-90`), and `qmail_state_v1`.
2. Services per resource (§1, four of them including `DOCUMENT_PRIVATE`) and the `MAIL` thread header carrying the title in resource `description` (readers prefer it, `GroupMail.tsx:166`).
3. `PUBLISH_MULTIPLE_QDN_RESOURCES { resources, encrypt:true, publicKeys:[...] }` with the recipient's (and each BCC's / each group member's) public key; `DECRYPT_DATA {encryptedData, publicKey?}`; `data64` = base64 of UTF-8 JSON.
4. Mail JSON: `createdAt` (truthy), `version` (truthy), `attachments` (array), `generalData` (object, null tolerated) are validated (`checkStructure.ts:35-46`); readers rely on `subject`, `textContentV2` (HTML in Quill 1 shape), `generalData.threadV2[].data` being a full message object with `createdAt`, and `recipient`.
5. Attachment reference fields `identifier`, `name`, `service` (required by `FileElement`), plus `filename`, `originalFilename`, `type` (display); `size` is optional and `NewThread` omits it.
6. Thread header JSON `title` (only field read) and thread message JSON `name`, `attachments`, `textContentV2`, `createdAt`.
7. Tombstone markers `__qmail_deleted__` (title/subject) and tag `qmail-deleted`.
8. State document `messages[identifier] = {read?, subject?, updatedAt?}`.

**Additive room (survives the original readers):**
- Extra top-level keys in the mail JSON and thread-message JSON: the reader spreads the decrypted object (`fetchMail.ts:74-82`; `Thread.tsx:71-75`) and ignores unknown keys. Extra keys inside `generalData` (only `thread`/`threadV2` are read). Extra keys inside each attachment reference (spread into `fileInfo`, `ShowMessageV2.tsx:260`).
- Extra keys in the thread header JSON (only `title` is read).
- Extra top-level keys in the state document (only `messages` is read); note extra keys inside a per-message entry are dropped by `normalizePublishedStateEntry` on load (`Mail.tsx:371-385`), so per-message additions (archive, star, hide) need a new top-level map.
- New resource kinds must use identifiers that do not contain `qortal_qmail_` or start with `_mail_qortal_qmail_`, otherwise the alias scan (`Mail.tsx:2150`), the sent lists (`SentMail.tsx:54-58` + `isSentMailIdentifier`) and the inbox substring queries will pick them up. Prefix `attachments_qmail_` is likewise free-form after the prefix but should be kept.
- Resource metadata (`title`/`description`/`tags`) on MAIL_PRIVATE mail is currently empty except tombstones; readers copy `metadata.title`/`description` into the row (`useFetchMail.tsx:261-275`) and search them (`useMailboxSearch.ts:99-101`). Anything put there is public plaintext.

**Observed quirks worth carrying into the plan (not contract changes):** primary inbox has no publisher/identifier-prefix check (`useFetchMail.tsx:280-313`); secondary-name and alias inboxes drop legacy non-`_mail_` identifiers (`Mail.tsx:819-836`, `AliasMail.tsx:121-135`); the sent regex breaks on names/aliases containing `_` (`mailIdentifier.ts:6`); thread search is a substring match without trailing `_` (`GroupMail.tsx:141`); tombstones are not hidden in the recipient's inbox; `typeof null === "object"` lets `generalData: null` pass validation; thread messages are never validated; search ignores Slate `textContent`; avatars are fetched eagerly per message; replies embed the full previous object and can carry the local read marker.

#### 17. Additive data written by Q-Mail+ 1.0.0 (2026-10-04)

- **Direct mail JSON** gains `to: [recipient]` and `cc: [Cc names]` beside the binding `recipient`. Every To/Cc/Bcc name still gets its own copy with the binding identifier `_mail_qortal_qmail_<name.slice(0,20)>_<address.slice(-6)>_mail_<sameSendId>` and `recipient` = that name, all in one `PUBLISH_MULTIPLE_QDN_RESOURCES {resources, encrypt:true, publicKeys:[to, ...cc, ...bcc]}`. Bcc names never appear in any JSON. The original Q-Mail reads `recipient` and ignores `to`/`cc`, so every copy opens there. Pinned by tests in `src/utils/mailCompose.test.ts`.
- **Bodies** are published through `toPublishedMailHtml()` (`src/components/common/TextEditor/quillHtml.ts`): the Quill 1 shape with plain spaces. Quill 2's `getSemanticHTML()` had turned every space into `&nbsp;`; runs of 2+ spaces keep one `&nbsp;` as Quill 1 does, and `<pre>` keeps plain spaces.
- **Replies** embed the previous message without its own `generalData` history (since round 2).
- **`qmail_state_v1`** gains top-level `archived` and `settings` maps (§10); the `messages` map is unchanged. Since round 5, `settings.footer` = `{ default, byName, inReplies }`, written only when there is footer text. It is applied on load, and before a publish that never loaded the document, only when this device has no `qmail_footer_<address>` key; a local footer, even a cleared one, is never replaced (`d55e763`).
- **Footer** (feat-footer): Settings → Mail → Footer. The composer writes it into the body as Quill 1 paragraphs (one escaped `<p>` per line, `<p><br></p>` for a blank one): a new message is `<p><br></p>` + footer; a reply or forward (switch on) is `<p><br></p>` + footer + `<p><br></p>` + the "X wrote:" line or forward header + quote. It reaches the recipient only inside `textContentV2`, so the mail format is unchanged. Settings' "Footer for" picker lists the names A to Z, as a plain select up to 15 names and as the searchable NameSwitcher (an "All names (default)" row first, "Own footer" under names that have one) above that. Changing From swaps it for that name's footer only while it is exactly as inserted; drafts keep what the user has. Pinned by `mailFooter.test.ts`, `mailCompose.test.ts` and `NewMessage.footer.test.tsx`.
- **localStorage** (new keys or fields, all local): `qmail_read_state_<address>`, `qmail_archived_<address>`, `qmail-general-consent`, compose-draft keys `…::reply:<id>` and `…::replyall:<id>` with optional `ccNames`/`showCC`, and `qmail_alias_scan_checkpoint_<address>` gains `intervals` and `complete` (an old value reads as a finished scan) plus a per-address set of scanned identifiers (capped at 3000).
- **localStorage, round 5:** `qmail_footer_<address>` = `{ default, byName: {"<name>": text}, inReplies }` (plain text with `\n`; the key is kept when the footer is emptied, which is how a cleared footer stays cleared), and `qmail_pane_widths_<address>` = `{ rail?, list? }` in px (only widths the user dragged; `src/layout/usePaneWidths.ts`). Both are local only and new; the original app never reads them.
- **PDF preview** (round 5) adds no data: `SHOW_PDF_READER {blob}` gets the decrypted bytes locally (§6).

### Qortal call inventory

Scope: files reachable from `src/main.tsx`. Service constants: `MAIL_SERVICE_TYPE = MAIL_PRIVATE`, `THREAD_SERVICE_TYPE = MAIL`, `MAIL_ATTACHMENT_SERVICE_TYPE = ATTACHMENT_PRIVATE` (`src/constants/mail.ts:1-4`). Every claim was independently verified; the four that were refuted are corrected in place and marked **(corrected)**.

Two facts that shape everything below:
- **(corrected)** `GroupedMailboxList` is handed the entire fetched mailbox (the inbox and sent fetches exhaust QDN in 200-per-page loops, `Mail.tsx:825-871` now / `useFetchMail.tsx:290-311`, `SentMail.tsx:404-460`; `useMailboxSearch` passes it through unsliced, `useMailboxSearch.ts:149,170`) and has no slicing or virtualisation, **but it renders one collapsed header per sender/recipient group, not one row per message** (`GroupedMailboxList.tsx:78-127`, `:319-466`). `MailMessageRow`, which carries the per-row effects (`MailMessageRow.tsx:101`, `:145-149` SEARCH_NAMES, `:186-192` subject decrypt), is mounted only for messages inside a multi-message group the user has clicked open (`:320`, `:364-367`, `:467`, `:480-537`; `expandedGroups` starts `{}` at `:74-76`). Single-message groups never mount a row. Mount-time cost therefore scales with distinct correspondents (one header + an effect-free `AvatarWrapper`, `MailTable.tsx:160-176`) and the grouping `useMemo` over the full array; the unbounded case is expanding one large group, which renders every message in it at once.
- None of the app's `setInterval` loops check `document.hidden` / `visibilitychange` (grep over `src/` finds zero occurrences of `visibilitychange|document.hidden|visibilityState|hasFocus|pagehide`); every poll continues while the tab is hidden and none back off.

#### 1. Boot and authentication (GlobalWrapper + app shell)

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| B1 | `qortalRequest NOTIFICATION_MARK_SEEN` | `src/wrappers/GlobalWrapper.tsx:56-61` (now `:53-60`) | GlobalWrapper mount | once |
| B2 | `qortalRequest GET_USER_ACCOUNT` | `src/wrappers/GlobalWrapper.tsx:250-252` (now `:248-250`) | `askForAccountInformation`, run at startup by app-shell `maybeAuthOnStartup` (`src/app-shell/useQMailAppShell.ts:166-168`, default `authOnStartup: true` at `:145-147`; impl `src/qapp-lib/app-shell/react.tsx:320-326`) or on the Authenticate button (`SettingsPage.tsx:200`, `qmail:authenticate` event from `Mail.tsx:2839` now) | once per auth |
| B3 | `qortalRequest GET_ACCOUNT_NAMES` | `src/utils/qortalRequestFunctions.ts:5-8` (called `GlobalWrapper.tsx:254`, now `:252`) | right after B2 | once per auth |
| B4 | `qortalRequest GET_PRIMARY_NAME` | `src/utils/qortalRequestFunctions.ts:18-21` (called `GlobalWrapper.tsx:255`, now `:253`) | right after B3 | once per auth |
| B5 | `qortalRequest GET_QDN_RESOURCE_URL` (own avatar, THUMBNAIL/qortal_avatar) | `src/wrappers/GlobalWrapper.tsx:66-71` | effect on `user?.name` (`:46-53`) | once per name switch |
| B6 | `fetch('/groups/member/<address>')` (no query parameters; Core's endpoint takes only `adminOnly`/`ownerOnly`, no limit exists to add) | `src/wrappers/GlobalWrapper.tsx:92-94` (now `:90-93`) | effect on `user?.address` (`:262-275`, now `:260-273`) | once at auth **+ polled every 600 000 ms** (`checkGroupMembers`, `setInterval` at `:238-243`, now `:236-241`); not paused when hidden; each tick dispatches a fresh `privateGroups` object, which re-triggers I7 below |

App-shell rating (`refreshRating` on mount, `src/qapp-lib/app-shell/react.tsx:433`) uses the localStorage adapter `createQortalRatingAdapter` (`src/qapp-lib/app-shell/adapters.ts:91-119`) and makes **no** network call. `getLocalSubjects` (`GlobalWrapper.tsx:199-230`) is localStorage only.

#### 2. Inbox first load (Mail.tsx + useFetchMail)

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| I1 | `fetch /arbitrary/resources/search?mode=ALL&service=MAIL_PRIVATE&query=qortal_qmail_<name20>_<addr6>_mail_&limit=200&offset=N&includemetadata=false&reverse=true&excludeblocked=true` | `src/hooks/useFetchMail.tsx:280-311` (`getAllMailMessages`, `pageSize = 200` at `:285`) | Mail effect on `user?.name` (`src/pages/Mail/Mail.tsx:1556-1565` → `getMessages(true)` `:1362-1376`) | 1 page per 200 messages, loops until a short or empty page (`:299-310`); whole inbox index fetched eagerly, on first mount and on every name change |
| I2 | `qortalRequest GET_QDN_RESOURCE_URL` sender avatar | `src/hooks/useFetchMail.tsx:244-259` (`getAvatar`), loop at `:315-319` | after I1 | **N+1: once per inbox message** (per message, not per distinct sender; no dedupe, no `userAvatarHash` check, un-awaited burst) |
| I3 | `fetch .../search?query=<inbox query>&limit=20&includemetadata=true` (`checkNewMessages`) | `src/hooks/useFetchMail.tsx:100-111` (URL `:105`) | `setInterval` 30 000 ms in `src/pages/Mail/Mail.tsx:1380-1398` (now `:1365-1373`) | every 30 s, forever, not paused when hidden; runs for the primary name only; the interval is torn down and recreated whenever `mailMessages` changes (`useFetchMail.tsx:139`); first tick 30 s after mount; no avatar fetch |
| I4 | `hasInboxMailActivityForOwnedName`: search `qortal_qmail_<name20>_<addr6>_mail_` limit 20 (`Mail.tsx:709-717`), then only if no match search `qortal_qmail_<name>_mail_` limit 20 (`:737-745`); both `includemetadata=false` | `src/pages/Mail/Mail.tsx:693-752` | effect `populateOwnedNamesWithMail` (`:1682-1726`) on `ownedNameCandidates`/`user.address`/`user.name` | 1–2 searches **per owned name** |
| I5 | `hasSentMailActivityForOwnedName`: search `_mail_qortal_qmail_` + `identifier=_mail_` + `name=<n>&exactmatchnames=true` limit 20, then if no match `qortal_qmail_` with same name filter (`Mail.tsx:646-688`) | `src/pages/Mail/Mail.tsx:639-691` | same effect as I4 | 1–2 searches **per owned name** |
| **(corrected)** I4+I5 scheduling | | `Mail.tsx:1694-1707` | | names are processed **one after another** (`for … of ownedNameCandidates` with `await`), but for each name the inbox chain and the sent chain are started **together** with `Promise.all([...])` (`:1695-1698`), so they run concurrently: per name 2–4 requests, serial depth 2, 2 in flight at once (not 4 sequential). The effect fires after auth (when `addUser` lands with `names`, not on bare mount) and re-runs in full, with no cache or in-flight merge, on every change to `user?.name`, `user?.names` or `user?.address` (`:1726`), including every active-name switch (`setActiveName` dispatches `addUser({...user, name})`). A `canceled` flag stops the loop but does not abort in-flight fetches. |
| I6 | `qortalRequest GET_QDN_RESOURCE_URL` avatar for each owned name / watched alias with mail | `src/pages/Mail/Mail.tsx:1741-1746` | effect `fetchOwnedNameAvatars` (`:1728-1774`) | once per name not already in `userAvatarHash` (`:1737`); re-runs whenever `avatarUrlByNameLowercase` changes; names without an avatar are not recorded as misses, so they are re-requested on every restart (`:1749-1751`) |
| I7 | `hasGroupThreadActivity`: raw search `service=MAIL&query=qortal_qmail_thread_group<id>&limit=1&includemetadata=false` (substring `query=`, so group 1 also matches 10, 11, …) | `src/pages/Mail/Mail.tsx:527-549` | effect `filterGroupsWithThreads` (`:1817-1854`) on `memberGroupOptions` (every joined group with an id and non-empty name, `:1120-1139`) | **1 search per joined group**, all in parallel (`Promise.all` `:1828-1836`); **repeats every 10 minutes** because B6 re-dispatches a new `privateGroups` object (`globalSlice.ts:116-119`) that gives `memberGroupOptions` a new reference |
| I8 | `fetchGroupAvatarPublisherName`: raw search `service=THUMBNAIL&identifier=qortal_group_avatar_<id>&limit=1` (`Mail.tsx:563-579`) + `GET_QDN_RESOURCE_URL` only when a publisher name came back (`:605-614`) | `src/pages/Mail/Mail.tsx:551-624` | effect `populateGroupAvatars` (`:1885-1912`) over `missingGroupAvatarIds` (`:1873-1883`) | 1 search + 0–1 URL call **per group that has threads**, **sequential** (`for … await`, `:1892-1894`); results including `""` are cached in `groupAvatarUrlById` (`:1896-1904`) so avatars are not refetched on the 10-minute cycle |
| I9 | `fetchInboxMessagesForOwnedName`: two searches (`qortal_qmail_<name20>_<addr6>_mail_`, `qortal_qmail_<name>_mail_`) limit 200, offset paged, includemetadata=true | `src/pages/Mail/Mail.tsx:795-900` | effect `fetchCombinedAliasInboxMessages` (`:1914-1969`) whenever inbox view is active with no instance selected and `combinedAliasInboxNames` (= `ownedInboxNames` minus the primary, i.e. only non-primary names whose I4 probe found mail, `:1235-1239`) is non-empty | ≥2 searches **per such name** (both query configs always run, `:841`; more if any page is full), names in parallel; re-fires on every dependency change (`:1963-1969`: every switch back to the combined inbox view), no cache |
| I10 | `hasInboxMailActivityForSavedAlias`: search `qortal_qmail_<alias>_mail_` limit 20 | `src/pages/Mail/Mail.tsx:754-777` | effect on `watchedAliases` (`:1641-1680`) | 1 search **per watched alias**, parallel; re-runs on every alias add/remove |
| I11 | `qortalRequest FETCH_QDN_RESOURCE` DOCUMENT_PRIVATE `qmail_state_v1` (base64) | `src/pages/Mail/Mail.tsx:2716-2722` | `loadPublishedMailStateFromQdn` effect (`:3340-3354`), once per identity; fired **before** and regardless of I12 (catch swallowed `:2724`) | once |
| I12 | raw search `service=DOCUMENT_PRIVATE&identifier=qmail_state_v1&name=<n>&exactmatchnames=true&limit=1` | `src/pages/Mail/Mail.tsx:2727-2747` | only when the auto-apply preference is off (`:2713, 2726`) | once; then the confirm modal (`:2752`) gates applying |
| I13 | `qortalRequest DECRYPT_DATA` (state document) | `src/pages/Mail/Mail.tsx:2767-2771` | after I11 resolves and the modal was accepted (or auto-apply is on) | once |
| I14 **(corrected)** | `qortalRequest DECRYPT_DATA` of the locally saved encrypted subject (`decryptSubjectQueued`) | `src/pages/Mail/MailMessageRow.tsx:27-59`, `:41`; triggered `:186-192` | per **mounted** `MailMessageRow` whose id is in `hashMapSavedSubjects` (localStorage `qmail_persistance_<name>`), whose saved subject is non-empty (`:169-173`) and whose body is not already decrypted in `hashMapMailMessages` (`:160-161`, `:187`) | once per ciphertext per session, serialised through one module-level promise chain (`:25`, `:35`), cached by ciphertext (`:24`, `:29-31`, `:50`). In the main inbox, rows mount only inside an expanded multi-message sender group (`GroupedMailboxList.tsx:320-321, 474-516`), so the **initial inbox render issues zero subject decrypts**; the alias inbox (`AliasMail.tsx:296-305`) mounts a row per message. The cache is checked before enqueueing, so two rows with the same ciphertext in flight both call (no in-flight dedupe); failures are not cached (`:53-55`). |

**Estimated `/arbitrary/resources/search` count on first load (inbox view, ≤200 messages, published state present but not auto-applied):**
- *1 name, 0 aliases, 2 groups (both with threads):* I1 = 1, I4 = 1–2, I5 = 1–2, I7 = 2, I8 = 2, I12 = 1 → **8 searches (best) to 10 (worst)**, plus the `/groups/member` fetch (B6). Within the first 30 s I3 adds +1 and then +1 every 30 s. Other qortalRequests on load: B1–B5 (5), I2 = N avatar-URL calls (N = message count), I6 = 1, I8 = 2 URL calls, I11 = 1, I13 = 0–1, I14 = 0 until a group is expanded.
- *5 names (all with inbox+sent mail), 0 aliases, 2 groups:* I1 = 1 (primary only), I4+I5 = 5 × (2–4) = 10–20, I9 = 4 non-primary names × 2 queries × ≥1 page = ≥8, I7 = 2, I8 = 2, I12 = 1 → **24 (best) to 34+ (worst) searches**, plus B6 and +1 every 30 s. I9 re-issues (with limit 200 and metadata) the same prefixes I4 already searched with limit 20.

**Uncached repeats on first load:** the byAddress/byAlias inbox prefixes for a non-primary owned name are searched in I4 (limit 20, `includemetadata=false`) and again in I9 (limit 200, `includemetadata=true`); the primary name's inbox prefix is searched in I1 (limit 200), I4 (limit 20) and every 30 s in I3 (limit 20). The Sent prefixes for a name are searched in I5 and again in full by SentMail (S1) when the Sent view opens. There is no in-flight merging and no session cache for any search; each component keeps its own state (`Mail.tsx` `mailMessages` in Redux, `SentMail` local `mailMessages` `SentMail.tsx:298`, `AliasMail` local `mailMessages` `AliasMail.tsx:55`, `ThreadsMailbox` local `threads` `ThreadsMailbox.tsx:129`).

#### 3. Sent view (SentMail.tsx)

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| S1 | search `query=_mail_qortal_qmail_&identifier=_mail_&name=<n>&exactmatchnames=true&limit=200&offset=N&includemetadata=true`, then `query=qortal_qmail_&name=<n>...` limit 200 paged (`SENT_QUERY_CONFIGS` `:45-59`) | `src/pages/Mail/SentMail.tsx:394-486` (`fetchSentIndexes`), loop `:407-461`, `pageSize = 200` at `:404` | effect on instance names (`:497-507`) | ≥2 searches **per instance name** (all owned names with sent mail when no instance is selected, `Mail.tsx:3504-3516`), pages of 200 until short page |
| S2 | same as S1 (`checkNewMessages` → `fetchSentIndexes({silent:true})`) | `src/pages/Mail/SentMail.tsx:488-495`, `setInterval` `:510-526` | **every 30 000 ms** while Sent view mounted; full re-fetch of every page for every name, not a delta; not paused when hidden; `silent` only skips the spinner | ≥2 × names searches per tick |
| S3 **(corrected)** | `qortalRequest SEARCH_NAMES` `{query: recipientName, prefix:true, limit:10, reverse:false}` to resolve recipient from an address-style identifier (alias-style rows return early, `:114-117`) | `src/pages/Mail/MailMessageRow.tsx:120-126` (`getSentToName`, effect `:145-149`) | per **mounted** row when `isFromSent` (`GroupedMailboxList.tsx:516-519`, the only `isFromSent` caller) | **Zero on Sent load.** Rows mount only inside a recipient group with >1 messages that the user has expanded (`GroupedMailboxList.tsx:320`, `:467`); single-message recipients never mount a row (the header opens the message, `:350-363`). Expanding a group of N messages to one recipient fires **N identical, uncached, undeduped** `SEARCH_NAMES` calls (same name prefix), and again on every collapse/re-expand (rows remount). The compact row never displays the resolved name; the result is only passed as the alias to `openMessage` (`:237`), while the group header already shows the recipient via `getSentRecipientDisplayLabel` (`GroupedMailboxList.tsx:90, 435-437`) with no network. |
| S4 | Delete sent: `SEARCH_NAMES limit 200` (`SentMail.tsx:211-217`) or `GET_NAME_DATA` (`:176-179`) + `GET_ACCOUNT_DATA` (`:162-165`), then `PUBLISH_MULTIPLE_QDN_RESOURCES` tombstone with `encrypt:true` (`:608-613`) | `src/pages/Mail/SentMail.tsx:535-653` | on delete click after confirm | per delete |

#### 4. Alias inbox (AliasMail.tsx)

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| A1 | two searches `qortal_qmail_<alias20>_<addr6>_mail_` and `qortal_qmail_<alias>_mail_` limit 200 offset paged includemetadata=true | `src/pages/Mail/AliasMail.tsx:106-198` (`fetchAliasMailboxMessages`), loop `:142-184`, `pageSize = 200` `:140` | effect on `value`/`user.address` (`:270-275`) | ≥2 searches per open of an alias inbox (two query loops, each ≥1 request) |
| A2 | `GET_QDN_RESOURCE_URL` sender avatar | `src/pages/Mail/AliasMail.tsx:73-88`, loop `:205-209` | after A1 | **N+1: per message**, no dedupe |
| A3 | same as A1 (`refreshMailboxMessages`) | `src/pages/Mail/AliasMail.tsx:219-237` `setInterval` 30 000 ms (`:222-227`) | every 30 s while an alias inbox is open, full re-fetch (+A2 per message again); not paused when hidden | ≥2 searches per tick |
| A4 | `LazyLoad onLoadMore={getMessages}` and "Load Older Messages" button call the same full refresh | `src/pages/Mail/AliasMail.tsx:307`, `:319-321` (`getMessages` `:213-215` just awaits `refreshMailboxMessages`) | on scroll-to-bottom / click; LazyLoad's sentinel is in view when the list is empty, so the first paint typically triggers the refresh twice (mount effect `:270-275` + LazyLoad) | full re-fetch; there is no real paging of the alias inbox (offset is always restarted at 0 `:143`) |

#### 5. Threads view (ThreadsMailbox.tsx, GroupMail.tsx, Thread.tsx)

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| T1 | raw search `service=MAIL&query=qortal_qmail_thread_group<id>&limit=60&offset=0&includemetadata=true` | `src/pages/Mail/ThreadsMailbox.tsx:67-84` | effect on `normalizedGroups` (`:146-192`), i.e. on every mount of the Threads tab | 1 per group with threads, parallel (`Promise.all` `:157`); no paging beyond 60; no cache |
| T2 | `qortalRequest FETCH_QDN_RESOURCE` (MAIL thread object) to read the title when `metadata.description` is missing/blank | `src/pages/Mail/ThreadsMailbox.tsx:47-52` (`fetchThreadTitle`) | per thread from T1 | **N+1: per thread lacking a description**, parallel (`:89-115`) |
| T3 | `fetch('/groups/members/<id>?limit=0')` | `src/pages/Mail/GroupMail.tsx:422-424` (`getGroupMembers`) | effect on `groupId` (`:454-466`) | once on group open **+ every 180 000 ms** (`setInterval` `:457-459`); **`limit=0` = unbounded member list**; not paused when hidden; keeps running while a thread is open (GroupMail stays mounted, `:490-497`); no re-entrancy guard |
| T4 | per member: `fetch('/names/address/<addr>')` (`src/utils/apiCalls.ts:2`) + `qortalRequest GET_ACCOUNT_DATA` (`GroupMail.tsx:432-435`) | `src/pages/Mail/GroupMail.tsx:429-445` | inside T3 loop, both awaited sequentially per member | **N+1: 2 calls per group member**, repeated every 3 min with T3; GET_ACCOUNT_DATA is issued even when the name lookup returns `''` |
| T5 | "Recently active": search `service=MAIL_PRIVATE&query=qortal_qmail_thmsg_group<id>&limit=100&offset=0` with one `name=` param per member (`:246-256`) | `src/pages/Mail/GroupMail.tsx:239-359` (`getMailMessages`) | effect `:392-410` when members resolved | once per group open / filter change |
| T6 | per recent thread (≤10, `:283`): search `identifier=<threadId>&limit=1&includemetadata=true` with per-member `name=` params (`:288-306`), plus `FETCH_QDN_RESOURCE` if no description (`:322-330`), plus `GET_QDN_RESOURCE_URL` avatar (`:116-131`, called `:341`) | `src/pages/Mail/GroupMail.tsx:285-348` | after T5 | **N+1: 1 search + 0–1 fetch + 1 avatar per thread**, parallel |
| T7 | "Newest"/"Oldest": search `qortal_qmail_thread_group<id>&limit=20&offset=<allThreads.length>` (`:142-151`), then `FETCH_QDN_RESOURCE` per thread lacking description (`:180-188`, raced against 5 s `delay`) | `src/pages/Mail/GroupMail.tsx:133-238` (`getAllThreads`) | on filter change; `LazyLoad` at `:719-721` pages by 20 | 1 search per page + N+1 fetches |
| T8 | Thread open: search `qortal_qmail_thmsg_group<gid>_<tid>&limit=20&offset=<messages.length>` | `src/pages/Mail/Thread.tsx:80-124` (`getMailMessages`), effect `:163-169` (reset=true), `LazyLoad` `:349-351` | on thread open and scroll | 1 per page of 20 |
| T9 | per thread message not yet in the local array: `FETCH_QDN_RESOURCE` base64 (`:56-62`) + `DECRYPT_DATA` (`:63-67`) | `src/pages/Mail/Thread.tsx:54-78` (`getIndividualMsg`, called `:112`) | after T8 | **N+1, eager: every message in the page is fetched and decrypted immediately**, in parallel (un-awaited); dedupes only against local state, never against the Redux `hashMapMailMessages` cache (`:51-53` is consulted only at render), so re-opening a thread re-fetches and re-decrypts everything |
| T10 | Thread poll: search same query `limit=20&offset=0` (`:186`) then per new message `FETCH_QDN_RESOURCE` + `DECRYPT_DATA` (`:207-218`) | `src/pages/Mail/Thread.tsx:177-246`, `setInterval` **8 000 ms** `:248-266` | every 8 s while a thread is open; not paused when hidden; the search fires before the empty-thread early return (`:187` vs `:195`), so even an empty thread hits the node every 8 s; `setMessages([...messages])` every tick (`:240`) recreates the interval each time | 1 search per tick + fetch/decrypt per new message |

#### 6. Compose and publish (NewMessage.tsx, NewThread.tsx, ChipInputComponent, MultiplePublish)

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| C1 | `qortalRequest SEARCH_NAMES` `prefix:true, limit:30` | `src/pages/Mail/NewMessage.tsx:422-428` | debounced 250 ms (`:419`, `:451`) on every "To" change ≥2 chars (`:410-457`) | per keystroke burst; not cached |
| C2 | `fetch('/groups/members/<id>?limit=0')` | `src/pages/Mail/NewMessage.tsx:995-997` (`fetchGroupPublicKeys`) | on Send to a group (`:1102`), click-time only | once per group send; **`limit=0` unbounded** |
| C3 | `qortalRequest GET_ACCOUNT_DATA` per member address | `src/pages/Mail/NewMessage.tsx:1012-1026` | inside C2 | **N+1: per deduped member**, all in parallel via `Promise.all`, no concurrency cap, failures swallowed to `""` |
| C4 | `qortalRequest PUBLISH_QDN_RESOURCE` (thread object, service MAIL, unencrypted) | `src/pages/Mail/NewMessage.tsx:1120-1128` | group send, before the message publish is confirmed | once |
| C5 | `qortalRequest GET_NAME_DATA` recipient (`:1174-1177`) + `GET_ACCOUNT_DATA` (`:1186-1189`) | `src/pages/Mail/NewMessage.tsx:1173-1196` | direct send | 2 per send, no name→key cache |
| C6 | `PUBLISH_MULTIPLE_QDN_RESOURCES` with `encrypt:true` (mail + BCC copies + attachments; `:1163-1168` group, `:1272-1277` direct) executed via `qortalRequest(pub)` in `src/components/common/MultiplePublish/MultiplePublish.tsx:44-46` | `MultiplePublish.tsx:110-115` | after C4/C5 | once per send (+ "Try again" retries with the failed subset `:88-101`) |
| C7 | BCC chip: `GET_NAME_DATA` (`:26-29`) + `GET_ACCOUNT_DATA` (`:33-36`) | `src/components/common/ChipInputComponent/ChipInputComponent.tsx:22-56` | on Enter per BCC name | 2 per chip |
| C8 | Legacy thread composer: `PUBLISH_QDN_RESOURCE` thread (`NewThread.tsx:319-326`, `:343`) then `PUBLISH_MULTIPLE_QDN_RESOURCES` via MultiplePublish (`:337-345`, `:390-397`) | `src/pages/Mail/NewThread.tsx:308-397` | "Post Message" inside an open thread (`Thread.tsx:280-286`) | per post |

#### 7. Opening / decrypting a message (OpenMail, fetchMail.ts, DownloadWrapper, FileElement) **(corrected)**

| # | Call | File:line | When | How often |
|---|------|-----------|------|-----------|
| O0 | none | `src/pages/Mail/Mail.tsx:1400-1454` (now `:1385-1413`) | `openMessage` first checks `hashMapMailMessages[identifier]`; on a hit (`isValid && !unableToDecrypt`) it opens the message with **zero** qortalRequest calls | re-opens in the same session, and messages already decrypted by search (`useMailboxSearch.ts:268-285` dispatches `addToHashMapMail`), cost nothing |
| O1 | `qortalRequest GET_QDN_RESOURCE_STATUS` | `src/pages/Mail/OpenMail.tsx:87-92` | `OpenMail` mount effect (`:183-185`), i.e. only on a cache miss | once per cold open; when not READY, `DownloadWrapper.tsx:98-106` keeps polling it (O3) |
| O2 | `fetchAndEvaluateMail`: `FETCH_QDN_RESOURCE` base64 (`src/utils/fetchMail.ts:23-29`) → `GET_NAME_DATA otherUser` (`:31-34`) → `GET_ACCOUNT_DATA owner` (`:38-41`) → **`DECRYPT_DATA`** with that publicKey (`:44-52`) → `ENCRYPT_DATA` of the subject (`:85-91`) | `src/utils/fetchMail.ts:11-128`, called from `OpenMail.tsx:53-66` | when status is READY | **4 unconditional calls + ENCRYPT_DATA only when `username` is set, the subject is non-empty and `qmail_persistance_<username>` has no entry for the id (`:95-101`)**, i.e. 4–5 calls, 5 only on the first open of that message in that browser. `GET_NAME_DATA` + `GET_ACCOUNT_DATA` are re-issued for every message with no name→key cache anywhere in `src` (also hit per message by `useMailboxSearch.ts:268-278` and `MailThread.tsx:125`). `useFetchMail.getMailMessage` (`:87-95`) calls it with `postId` and no `otherUser`, which would return early at `fetchMail.ts:21`, but it has no callers. |
| O3 | If not READY: `downloadVideo` → `GET_QDN_RESOURCE_PROPERTIES` (`DownloadWrapper.tsx:46-51`) + `GET_QDN_RESOURCE_URL` (`:58-63`) + **`GET_QDN_RESOURCE_STATUS` polled every 5 000 ms** (`setInterval` `:98-187`) | `src/wrappers/DownloadWrapper.tsx:77-194` | per download (one interval per `performDownload`, guarded only by `downloads[identifier]` `:84`) | `clearInterval` only on `READY` (`:167`) or `NOT_PUBLISHED` (`:116`); keeps polling forever on `MISSING_DATA` (`:177-186`); after 24 identical ticks issues `GET_QDN_RESOURCE_PROPERTIES` again and holds `isCalling` for 25 s (`:129-152`); the status call has no try/catch so one rejection leaves `isCalling` stuck true (Bugs #4); no unmount cleanup |
| O4 | `GET_QDN_RESOURCE_PROPERTIES` re-fetch loop | `src/pages/Mail/OpenMail.tsx:146-157` `setInterval` 7 500 ms (started once per mount at `:174-180` when status becomes `DOWNLOADED`); same in `src/components/FileElement.tsx:237-251` (started `:270-276`) | once status becomes `DOWNLOADED` | every 7.5 s until the tick observes `READY`; the handle is a local `const` with no effect cleanup, so it is never cleared on unmount or on any other terminal status; not paused when hidden |
| O5 | Attachment click: `GET_QDN_RESOURCE_PROPERTIES` (`:113-118`) → `FETCH_QDN_RESOURCE` base64 (`:127-133`) → **`DECRYPT_DATA {encryptedData}`** (`:135-138`) → `SAVE_FILE` (`:152-159`) | `src/components/FileElement.tsx:97-215` | on click when READY, else O3 | per attachment click |

Decryption policy summary: **message bodies are decrypted lazily** (on cold open, O2, or when a thread page loads, T9/T10) and **saved subjects are decrypted lazily per mounted row** (I14, only inside expanded groups in the main inbox; every row in an alias inbox), while **thread messages are decrypted eagerly for the whole page** (T9). The mailbox full-text search (`src/pages/Mail/useMailboxSearch.ts:249-296`) runs `fetchAndEvaluateMail` (O2's 4–5 calls, `:268-277`) for **every message not yet decrypted** in the loaded list, 3 at a time (`SEARCH_CONCURRENCY = 3` `:35`, workers `:299-331`), i.e. a search with any term decrypts the entire inbox/sent box (up to 2 attempts per sent message, one per decrypt candidate, `:116-135`); the query is not debounced (`MailboxSearchBar.tsx:61-65` → `setInboxSearchQuery`), a new run bumps `runIdRef` (`:168`) but cannot abort in-flight requests; results are kept in an in-memory ref cache (`:147`) and the Redux hash (`:280`); messages that fail are cached as complete for the hook's lifetime (`:292-295`).

#### 8. Other on-demand calls

| # | Call | File:line | When |
|---|------|-----------|------|
| X1 | Publish Q-Mail state: `GET_ACCOUNT_DATA` (`:2656-2659`) + `PUBLISH_QDN_RESOURCE` DOCUMENT_PRIVATE `qmail_state_v1` `encrypt:true` (`:2670-2678`) | `src/pages/Mail/Mail.tsx:2629-2708` | sidebar "Publish Q-Mail State" click (`:3151-3155`), no confirmation |
| X2 | Alias scan: raw search **`service=MAIL_PRIVATE&query=qortal_qmail_&mode=ALL&limit=200&offset=N&reverse=true&excludeblocked=true&includemetadata=false`**, no `name` param, over the whole network, paged until a short/empty page (`:2134-2220`; now `:2109-2201`, params `:2128-2137`), then per candidate `FETCH_QDN_RESOURCE` (`:2284-2290`, now `:2265-2271`) + `DECRYPT_DATA` (`:2291-2295`, now `:2272-2276`) **sequentially** in a `for` loop (now `:2247`) | `src/pages/Mail/Mail.tsx:2078-2403` (now `:2059-2328`) | "Full scan" button on Aliases page (`src/pages/Mail/AliasesPage.tsx:205` → `Mail.tsx` now `:3570`) only, never on mount or interval — unbounded page count (the checkpoint filters client-side and does not shorten paging) and N fetch+decrypt |
| X3 | `GET_LIST_ITEMS blockedNames` (`:32-35`) on open, `DELETE_LIST_ITEM` (`:48-52`) on click | `src/components/common/BlockedNamesModal/BlockedNamesModal.tsx` | formerly the Navbar modal (`Navbar.tsx:370`, deleted); must be re-homed in Settings |
| X4 | Legacy `MailThread`: search `query=<msg id>&limit=20&offset=0&name=<n>&exactmatchnames=true` per thread item (`:88-111`) + `fetchAndEvaluateMail` (`:125-130`) | `src/pages/Mail/MailThread.tsx:80-139` | only inside `ShowMessage` (`src/pages/Mail/ShowMessage.tsx:139-145`); `ShowMessage` is rendered by `AliasMail.tsx:288` with `isOpen` that is never set true (setters commented `:249`, `:262`; `ShowMessage.tsx:50-52` `openModal` never called), gated additionally by `!alias` which `AliasMail` always passes (`:293`), and is imported but not rendered by `Mail.tsx`/`GroupMail.tsx`, so this path is **dead at runtime** |
| X5 | Blog functions in `useFetchMail` (`getNewPosts` `:142-199`, `getBlogPosts` `:201-242`, filtered/subscription/favorites `:361-516`) and `src/utils/fetchPosts.ts:15-16` | reachable by import only; never called from Mail code | dead |

#### 9. Explicit lists

**`limit: 0` / unbounded**
- `fetch('/groups/members/<id>?limit=0')` — `src/pages/Mail/GroupMail.tsx:423` (live; on group open + every 180 s).
- `fetch('/groups/members/<id>?limit=0')` — `src/pages/Mail/NewMessage.tsx:996` (live; on group send).
- `fetch('/groups/member/<address>')` — `src/wrappers/GlobalWrapper.tsx:92-94` (now `:90-93`; the endpoint has no limit parameter; on auth + every 10 min).
- `fetch('/names/address/<addr>')` — `src/utils/apiCalls.ts:2` (no limit; per group member).
- Commented-out `limit=0` at `src/wrappers/GlobalWrapper.tsx:131` (verifier: the `?limit=0` text is at `:129`, inside the dead `getGroups` block `:111-194`) and one `limit=0` search in the excluded Q-Blog file `src/pages/CreatePost/components/Navbar/NavbarBuilder.tsx:64` (not reachable). So "4 limit:0 searches" = 2 live + 2 dead occurrences; every reachable `/arbitrary/resources/search` (22 call sites) and every `SEARCH_NAMES` carries an explicit non-zero limit (full list: `Mail.tsx:528,553,649,699,727,752` ("1"/"20"), `:836`/`:2132` (200), `:2714` ("1"); `GroupMail.tsx:146,250,292`; `AliasMail.tsx:151`; `SentMail.tsx:419`; `ThreadsMailbox.tsx:71`; `MailThread.tsx:93`; `Thread.tsx:94,186`; `useFetchMail.tsx:105,146,206,291,338,368,414,476`; `SEARCH_NAMES` limits 10/30/200 at `MailMessageRow.tsx:124`, `NewMessage.tsx:426`, `SentMail.tsx:215`).
- Effectively unbounded by paging: alias scan X2 (`limit=200` paged over the whole `qortal_qmail_` substring space), and all the 200-per-page "fetch everything" loops I1, I9, A1, S1.

**Every `setInterval` / poll**

| Period | Where | What | Hidden-tab pause |
|---|---|---|---|
| 30 000 ms | `src/pages/Mail/Mail.tsx:1383-1388` (now `:1365-1373`) | inbox delta search limit 20 (I3) | no |
| 30 000 ms | `src/pages/Mail/SentMail.tsx:514-519` | full sent re-fetch, ≥2 searches × names × pages (S2) | no |
| 30 000 ms | `src/pages/Mail/AliasMail.tsx:222-227` | full alias inbox re-fetch + avatar per message (A3) | no |
| 8 000 ms | `src/pages/Mail/Thread.tsx:251-256` | thread delta search + fetch/decrypt new (T10) | no |
| 180 000 ms | `src/pages/Mail/GroupMail.tsx:457-459` | group members `limit=0` + 2 calls per member (T3/T4) | no |
| 600 000 ms | `src/wrappers/GlobalWrapper.tsx:238-243` (now `:236-241`) | `/groups/member/<address>` (B6), which also re-triggers I7 | no |
| 5 000 ms | `src/wrappers/DownloadWrapper.tsx:98-187` | `GET_QDN_RESOURCE_STATUS` per download (O3) | no; not cleared on MISSING_DATA; no unmount cleanup |
| 7 500 ms | `src/pages/Mail/OpenMail.tsx:148-155` and `src/components/FileElement.tsx:239-247` | `GET_QDN_RESOURCE_PROPERTIES` refetch (O4) | no; cleared only on READY; no unmount cleanup |

**N+1 patterns (call inside a loop over messages/names/groups/members)**
- I2 `GET_QDN_RESOURCE_URL` per inbox message (`useFetchMail.tsx:315-319`); A2 same per alias message (`AliasMail.tsx:205-209`); T6 per recent thread (`GroupMail.tsx:341`).
- I14 `DECRYPT_DATA` per mounted row with a saved subject (`MailMessageRow.tsx:41`, `:186-192`) — only inside expanded groups / alias inbox.
- S3 `SEARCH_NAMES` per mounted sent row (`MailMessageRow.tsx:120-126`) — N identical calls per expanded recipient group.
- I4/I5 up to 4 searches per owned name (two concurrent chains, `Mail.tsx:1694-1707`); I9 ≥2 searches per non-primary owned name with mail (`Mail.tsx:1934-1940`); I10 1 search per watched alias (`Mail.tsx:1653-1656`); I6 avatar per owned name (`Mail.tsx:1735-1762`).
- I7 1 search per group (`Mail.tsx:1829-1830`), repeated every 10 min; I8 1 search + 0–1 URL per group with threads (`Mail.tsx:1892-1894`); T1 1 search per group (`ThreadsMailbox.tsx:158`).
- T2/T7 `FETCH_QDN_RESOURCE` per thread without description (`ThreadsMailbox.tsx:47-52`, `GroupMail.tsx:180-188`); T6 search + fetch + avatar per recent thread (`GroupMail.tsx:285-348`).
- T4 `/names/address` + `GET_ACCOUNT_DATA` per group member (`GroupMail.tsx:429-445`), every 3 min; C3 `GET_ACCOUNT_DATA` per member on send (`NewMessage.tsx:1012-1026`).
- T9/T10 `FETCH_QDN_RESOURCE` + `DECRYPT_DATA` per thread message (`Thread.tsx:104-114`, `:205-239`).
- Search: 4–5 qortalRequests per undecrypted message (`useMailboxSearch.ts:266-290` → `fetchMail.ts:23-108`); alias scan fetch+decrypt per candidate (`Mail.tsx:2266-2347`).

**Paging today (offset/limit values)**
- Inbox index: `limit=200`, `offset += responseData.length` until a page < 200 or empty (`useFetchMail.tsx:285-310`); the whole index is loaded up front. `getMailMessages` (`useFetchMail.tsx:327-360`, limit 20 offset `mailMessages.length`) exists but is not called by Mail.tsx.
- Inbox poll: `limit=20`, no offset (`useFetchMail.tsx:105`).
- Combined owned-name inboxes / alias inbox / sent: `limit=200` offset-paged to exhaustion (`Mail.tsx:839-885`, `AliasMail.tsx:140-183`, `SentMail.tsx:404-461`).
- Existence probes: `limit=20` (`Mail.tsx:663`, `:713`, `:741`, `:766`), `limit=1` (`Mail.tsx:542`, `:567`, `:2733`).
- Threads list: `limit=60` `offset=0` only (`ThreadsMailbox.tsx:71-73`); GroupMail Newest/Oldest `limit=20` `offset=allThreads.length` via `LazyLoad` (`GroupMail.tsx:146-148`, `:719-721`); Recently active `limit=100` `offset=0` then `.slice(0,10)` (`GroupMail.tsx:250-252`, `:283`); per-thread lookup `limit=1` (`GroupMail.tsx:292`).
- Thread messages: `limit=20` `offset=messages.length` via `LazyLoad` (`Thread.tsx:91-94`, `:349-351`); poll `limit=20 offset=0` (`Thread.tsx:186`).
- Name search: `SEARCH_NAMES` limits 30 (compose, `NewMessage.tsx:426`), 10 (sent row, `MailMessageRow.tsx:124`), 200 (delete resolve, `SentMail.tsx:215`).
- Alias scan: `limit=200` offset-paged to exhaustion over `qortal_qmail_` (`Mail.tsx:2128-2220`, now `:2109-2201`).

### Bundle

Method: the app's `vite.config.ts` was not touched; Vite's JS API was run from a scratchpad script (`configFile: false`, `rollup-plugin-visualizer` installed only under the scratchpad, `sourcemap: true`, `outDir` in the scratchpad: `stats.html`, `stats.json`, `smap.txt`, `graph.txt`, `dist/`, `dist3/`). The first build reproduced the app's `dist/` byte-for-byte at `43d9236`: `index-Z6DO3MBP.js` 1,575,716 B (1,575.7 kB, 481.8 kB gzip), `index-CAzCZkg5.css` 182,616 B, `Roboto-Regular-BHeBnKzs.ttf` 168,260 B, `Roboto-Medium-CFKDKRMh.ttf` 168,644 B. Per-module sizes come from decoding the production source map (1,513 kB of the 1,539 kB file attributed; 25 kB rolldown glue); gzip per package is gzip of that package's segments in isolation (slight over-estimate). Savings for lazy boundaries come from a reachability analysis on the module graph ("what becomes unreachable from `src/main.tsx` if this import edge is cut"); tree-shaken MUI barrel imports are listed separately.

Tree movement during the audit: numbers in §1-§4 are for `43d9236`; §6 rebuilds `507641e` (JS 1,603.4 kB / 490.0 kB gzip, CSS 186.3 kB, fonts now both Inter woff2 and Roboto ttf). `224fb37` then removed the audio player (item 1 of the plan, done) and `d5f6dfd` deleted the Navbar and 343 lines of CSS; neither was re-measured.

No `React.lazy` / dynamic `import()` exists anywhere in live code and `vite.config.ts` has no `manualChunks`/`codeSplitting`, so everything reachable from `src/main.tsx` is one chunk (grep over `src/` for `lazy(`/`import(` finds only type-level `import(...)` in `src/qapp-lib-compat.d.ts:266-280`).

#### 1. Top contributors to the main chunk (minified kB, exact from source map; gzip isolated estimate), at `43d9236`

| # | Package / module | min kB | gz kB | files | Where it is pulled in |
|---|---|---|---|---|---|
| 1 | `@mui/material` | 256.9 | 72.5 | 223 | everywhere; largest single files: `useAutocomplete` 12.9 + `Autocomplete` 11.1 (only `src/pages/Mail/NewMessage.tsx:10,1411`), `createThemeWithVars` 12.0, `Tabs` 8.7 (`Mail.tsx:38-39,1012`, now `:29`, `:998` — never rendered), `SelectInput` 8.3, `Button` 8.1, `Tooltip` 7.6, `Chip` 7.5, `Rating` 7.0 + `Switch` 5.5 (`src/qapp-lib/app-shell/react.tsx:9-11`) |
| 2 | `react-dom` | 207.6 | 63.7 | 4 | `react-dom-client.production.js` 203.6 — unavoidable |
| 3 | `philliplm-react-modern-audio-player` | 127.0 | 32.9 | 1 | `src/components/common/AudioPlayer.tsx:4` — **removed by `224fb37`** |
| 4 | `quill` (+ `parchment` 20.1, `lodash-es` 19.2, `quill-delta` 9.2, `lodash.isequal` 10.0, `lodash.clonedeep` 8.9, `fast-diff` 7.7, `eventemitter3` 2.7, `react-quill-new` 6.1 → **206 kB** closure) | 122.3 | 35.4 | 62 | `src/components/common/TextEditor/TextEditor.tsx:2` (compose only) |
| 5 | `src/pages/Mail/Mail.tsx` | 65.2 | 17.6 | 1 | 4,723-line page component (3,691 now) |
| 6 | `moment` | 60.1 | 19.4 | 1 | `src/utils/time.ts:1`, `src/utils/helpers.ts:1` |
| 7 | `react-joyride` (+ `@floating-ui/*` 20.6, `is-lite` 2.9, `@fastify/deepmerge` 2.0, `@gilbarbara/*` 3.1, `scroll`, `scrollparent` → **75.5 kB** closure) | 44.5 | 14.3 | 1 | `src/pages/Mail/Mail.tsx:12`, rendered `Mail.tsx:4024-4031` (now `:3653`) |
| 8 | `mime` (v4, full db) | 38.2 | 10.8 | 4 | `NewMessage.tsx:27,906`, `NewThread.tsx:16,122` |
| 9 | `@mui/system` | 36.3 | 12.8 | 44 | MUI dependency |
| 10 | `localforage` | 29.0 | 8.8 | 1 | `mailSlice.ts:2,4`, `blogSlice.ts:2,4`, `ConsentModal.tsx:8,10`, `GlobalWrapper.tsx:14,50` (now `:13`) |
| 11 | `src/pages/Mail/NewMessage.tsx` | 23.9 | 8.6 | 1 | compose screen |
| 12 | `@popperjs/core` | 19.9 | 7.2 | 54 | MUI `Tooltip`/`Autocomplete`/`Popper` |
| 13 | `dompurify` | 19.2 | 7.9 | 1 | `ShowMessageV2.tsx:4`, `ShowMessageV2Replies.tsx:11`, `ShowMessageWithoutModal.tsx:11`, `ShowMessage.tsx:11`, `TextEditor/DisplayHtml.tsx:2,22` |
| 14 | `styled-components` (+ `@emotion/stylis` 8.3, `shallowequal`, `@emotion/unitless`) | 17.6 | 6.8 | 1 | only a dependency of the audio player — gone with it |
| 15 | `react-toastify` | 15.7 | 6.1 | 2 | `src/components/common/Notification/Notification.tsx:2,4`; `App.tsx:45` |

Next: `react-dropzone` 14.7 (+`file-selector` 5.3, `tslib` 1.9, `attr-accept` → 22.3 kB; `NewMessage.tsx:23,890`, `NewThread.tsx:10,108`), `@mui/utils` 12.1, `@reduxjs/toolkit` 9.5 + `immer` 9.4 + `redux` 2.8 + `react-redux` 2.6, `react-router` 9.3 + `@remix-run/router` 8.8, `@emotion/*` ≈ 25, `react` 8.2, `GroupMail.tsx` 8.4, `Mail-styles.ts` 7.3, `NewThread.tsx` 6.9, `left-sidebar/react.tsx` 6.9 (no longer rendered after `d5f6dfd`; still imported for its type), `AliasesPage.tsx` 6.8, `ChangelogPage.tsx` 6.7, `GroupedMailboxList.tsx` 6.6, `app-shell/react.tsx` 6.5, `useFetchMail.tsx` 6.2, `SentMail.tsx` 6.2, `short-unique-id` 4.6, `react-copy-to-clipboard` 3.9 (+`copy-to-clipboard` 1.7, `toggle-selection` 0.4; `GlobalContextMenu.tsx:3,48`), `react-intersection-observer` 2.9, `@mui/icons-material` only 2.1.

Totals at `43d9236`: app code (`src/**`) 295.2 kB, node_modules 1,254.5 kB (of 1,549.5 kB attributed at /1000).

#### 2. What is only used on rare screens, or never
- **Audio player was dead weight (155 kB JS + 110 kB CSS, ≈ 43 kB + 12 kB gzip)** — `AudioPlayer` rendered in `GlobalWrapper.tsx:354-355` only when `state.global.audios` was non-empty, which nothing set (`setAudio` reducer `globalSlice.ts:79-82` had no live dispatcher; `setShowingAudioPlayer` only from the unrendered `DownloadTaskManager.tsx:159`). Its `dist/index.es.js:1` imported 108.5 kB of Adobe Spectrum CSS (2,287 `spectrum` occurrences in the bundle CSS). **Removed in `224fb37`** (package, import and mount); the `audios`/`setAudio`/`removeAudio` state in `globalSlice.ts:31-32,48-49,72-90` is still there.
- **Quill editor (206 kB closure + ~45 kB CSS) is compose-only.** Only `TextEditor.tsx` imports `react-quill-new` (`:2`); `TextEditor` is rendered by `NewMessage.tsx:1883` and `NewThread.tsx:620`. `DisplayHtml.tsx` (message *display*) imports only the three Quill stylesheets (`:3-5`) plus `dompurify`.
- **Tour (75.5 kB closure) runs once per browser.** `Joyride` renders at `Mail.tsx:4024-4031` (desktop inbox branch only at audit time; now `:3653` in the shell overlays for every layout) with `run` set by `Mail.tsx:1592-1597` only when `localStorage['tourStatus-qmail']` (`:1009`) is empty; dismissed at `:1980`. Steps at `:902-1007`.
- **moment (60 kB) formats one string.** Of `src/utils/time.ts`, only `formatFullTimestamp` (`:43-52`, `moment(n).format("YYYY-MM-DD HH:mm:ss")`) has live callers (15 files); `formatTimestamp` (`:3-17`), `formatDate` (`:19-23`) and `formatEmailDate` (`:27-41`) have none. `src/utils/helpers.ts:1` imports moment but only uses it inside a comment (`:13`).
- **mime (38 kB, the full v4 database) is a fallback that rarely fires.** `NewMessage.tsx:906` and `NewThread.tsx:122` call `mime.getExtension(file.type)` on drop, but the publish path prefers the filename's own extension (`NewMessage.tsx:954`) and uses the mime-derived one only when the name has none (`:955-957`). `mime` exposes `./lite`.
- **localforage (29 kB) backs one boolean and Q-Blog leftovers.** `ConsentModal.tsx:10-12,25-29` stores `general-consent` in IndexedDB; `mailSlice.ts:4` and `blogSlice.ts:4` create `q-blog-favorites` instances at module scope (side effects, so not tree-shaken) for thunks only dispatched from the excluded `src/pages/BlogList/PostPreview.tsx:149,248,262`; `GlobalWrapper.tsx:50` creates an instance into `favoritesLocalRef` that is never read. `blogSlice` is still wired into the store (`src/state/store.ts:6,14`).
- **react-toastify (16 kB JS + 12 kB CSS)** is the app-wide notifier (`Notification.tsx:2,4,54,72`, mounted `App.tsx:45`) — MUI `Snackbar`/`Alert` already ship the same capability.
- **dompurify (19 kB)** is needed the first time a message is opened, not for the inbox list.
- **react-dropzone (22 kB closure)** compose-only (`NewMessage.tsx:23,890-931`, `NewThread.tsx:10,108`).
- **Rarely-used app screens** (own code only): `ChangelogPage.tsx` 6.7 kB, `AliasesPage.tsx` 6.8 + `AliasMail.tsx` 3.2, threads section `GroupMail.tsx` 8.4 + `ThreadsMailbox.tsx` 4.3 + `Thread.tsx` 3.9 + `NewThread.tsx` 6.9 + `ShowMessageWithoutModal.tsx` 3.1, `SentMail.tsx` 6.2, `ShowMessageV2.tsx` 5.0 + `ShowMessageV2Replies.tsx` 3.9, `OpenMail.tsx` 3.4, legacy `ShowMessage.tsx` 2.7 + `MailThread.tsx` 3.1 + `MailThreadWithoutCalling.tsx` 2.2 (imported at `Mail.tsx:41`, now `:32`, never rendered there; still instantiated by `AliasMail.tsx:288` and imported by `GroupMail.tsx:30`). After `507641e`, `SettingsPage.tsx` (5.5 kB + `ChangelogDialog` 0.5 + `ThemePicker` 1.4) renders only on `/settings` (`src/App.tsx:11`).
- **MUI pieces that ride along for nothing:** `Tabs`/`Tab` (8.7 kB + Tab/TabScrollButton) imported at `Mail.tsx:38-39` (now `:29`) only to build `GroupTabs = styled(Tabs)(...)` at `:1012-1014` (now `:998`), never rendered (`styled()` is not pure-annotated so the bundler keeps it). `SimpleTable` imported at `Mail.tsx:46` (now `:37`) and never used. `Rating` + `Switch` (12.5 kB) come from the old app-shell menu (`src/qapp-lib/app-shell/react.tsx:9-11`), superseded by `SettingsPage`; check whether `AppMenu` is still mounted anywhere.

#### 3. The Roboto ttf files
- `src/styles/fonts/` holds 17 ttf files (3.0 MB): Cairo, Cambon-Light, Catamaran, Oxygen, Raleway and 12 Roboto cuts. Only two are referenced: `src/styles/lexendIllinoisTypography.ts:1-2` import `Roboto-Regular.ttf` and `Roboto-Medium.ttf`, and `buildLexendIllinoisTypographyCss` emits two `@font-face` rules (weights 400 and 500, `font-display: swap`, `:36-53`) plus `:root { --qapp-font-sans: 'Roboto', system-ui, … }` (`:20`, `:56`). `main.tsx:23-29` calls `ensureLexendIllinoisTypographyStyle`, which injects that CSS as a `<style id="qmail-lexend-illinois">` at runtime (`:75-97`). Vite emits the two ttf as hashed assets (168.3 kB and 168.6 kB, raw TrueType, not woff2). The other 15 files are not emitted, they just bloat the repo.
- `src/qapp-lib/typography.ts:1-45` is a second, near-duplicate `ensureLexendIllinoisTypographyStyle` (Roboto stack at `:17`, no `@font-face`); only its `applyQAppTextSize` is used (`main.tsx:8,30`, `GlobalWrapper.tsx:23`).
- The family is consumed through `--qapp-font-sans`: `src/index.css:6`, `src/styles/theme.ts:8-10` (MUI `typography.fontFamily`), 13 places in `src/pages/Mail/Mail-styles.ts` (e.g. `:522,530,542`), `texteditor.css:7`. Roboto Medium is the heaviest weight shipped, yet live code asks for 600/650/700/800/900 in ~50 places (`fontWeight: 700` ×16, `600` ×13, `800` ×5, `900` ×4, `650` ×7), so bold is synthesised.
- After `507641e`: `src/hub-theme/fonts.css:2-32` adds Inter 400/500/600/700 as woff2 (100–109 kB each, `src/hub-theme/fonts/`), imported at `main.tsx:4`; `src/index.css:160-161` sets `--qapp-font-sans: var(--qp-font)` for every theme except `data-ui-theme='hub20'`, and `--qp-font` is the Inter stack (`src/hub-theme/tokens.ts:85,98,131,294`). So Roboto is only *used* in the Hub 2.0 theme, but the injected `@font-face` and both ttf files still ship: 763 kB of fonts (4 × Inter woff2 = 426 kB, 2 × Roboto ttf = 337 kB) next to a 1.6 MB script.

#### 4. The 183 kB CSS (at `43d9236`)

| Section | Bytes in bundle | gzip | Source | Why it is there |
|---|---|---|---|---|
| Adobe Spectrum + `.rm-audio-player` styles | 0–109,697 → **109.7 kB (60%)** | 11.7 kB | `philliplm-react-modern-audio-player/dist/index.css` | pulled by `AudioPlayer.tsx:4` — **gone with `224fb37`** |
| react-toastify | 109,697–121,864 → 12.2 kB | 2.1 kB | `ReactToastify.css` | `Notification.tsx:4` |
| Quill snow + core + bubble | 121,864–166,705 → 44.8 kB | 5.6 kB | `quill.snow.css` 24,382 min, `quill.core.css` 10,129 min, `quill.bubble.css` 24,993 min | `TextEditor.tsx:3` (snow), `DisplayHtml.tsx:3-5` (snow, core, bubble). Bubble (218 selectors) is never used — the editor is `theme="snow"` (`TextEditor.tsx:132`); core is already contained in snow |
| `src/index.css` + `texteditor.css` | 166,705–182,541 → 15.8 kB | 3.1 kB | `index.css` 20,958 raw at `43d9236` (24,672 after `507641e`; 428 lines now after `d5f6dfd`), `texteditor.css` 3,850 raw | app styles (the injected Roboto/typography CSS is a runtime `<style>`) |

Dead Q-Blog CSS (`FlexLayout.css`, `BlogEditor.css`, `react-grid-layout`) is not in the bundle.

#### 5. Code-splitting plan (estimated savings on the 1,576 kB / 482 kB gz chunk)
1. ~~Delete the audio player~~ **done in `224fb37`** (−155 kB JS, −110 kB CSS). Still to do: drop the `audios`/`setAudio`/`removeAudio`/`setShowingAudioPlayer` state in `globalSlice.ts:31-32,48-49,72-90` and the `styled-components` transitive dep if it lingers in the lockfile.
2. **Lazy compose: `React.lazy(() => import('./NewMessage'))` and the same for `NewThread`** (import sites `Mail.tsx:37` → render `:3704`/`:4163`, now `:3461`; `Thread.tsx:24` → `:280`; also `GroupMail.tsx:26` and `AliasMail.tsx:16` import `NewMessage`). Carries `TextEditor` + Quill closure 208.5 kB, `mime` 38.2, `react-dropzone` 22.3, `NewMessage.tsx` 23.9 + `ChipInputComponent` 1.4, `NewThread.tsx` 7.3, plus MUI `Autocomplete`/`useAutocomplete` ≈ 24 kB: **≈ −325 kB JS (≈ −95 kB gz)**, and the Quill CSS (44.8 kB) moves into the compose chunk once `DisplayHtml.tsx:3-5` stops importing snow/bubble (it needs only the `.ql-editor` display rules from `quill.core.css`, ~10 kB, or a hand-written subset). Keep a `Suspense` fallback in the compose pane.
3. **Lazy tour**: wrap `Joyride` in a small `React.lazy` component mounted only while `run` is true (`Mail.tsx:1592-1597`, `:4024-4031`, now `:3653`): **−75.5 kB (−25 kB gz)** for everyone who has already seen the tour. (Or drop Joyride, UX #24.)
4. **Drop `moment`**: rewrite `formatFullTimestamp` (`time.ts:43-52`) with `Intl.DateTimeFormat`, delete the three unused helpers and the import in `helpers.ts:1`: **−60 kB (−19.5 kB gz)**.
5. **Drop `mime`**: rely on the filename extension already used at `NewMessage.tsx:954` (and `NewThread.tsx`), or switch to `mime/lite`: **−38 kB (−11 kB gz)**.
6. **Drop `localforage`**: `ConsentModal.tsx:10-29` → `localStorage`; delete the favourites thunks in `mailSlice.ts:56-130` and `blogSlice.ts` and `GlobalWrapper.tsx:46-52`: **−29 kB (−8 kB gz)**. Also lets `blogSlice` leave the store (`store.ts:6,14`).
7. **Replace `react-toastify` with MUI `Snackbar`+`Alert`** in `Notification.tsx`: **−16 kB JS (−5.6 gz) and −12 kB CSS (−2.1 gz)**; also fixes the render-phase dispatch (Bugs #22).
8. **Lazy message view**: `ShowMessageV2` (+`ShowMessageV2Replies`, `dompurify`, `DisplayHtml`) behind `React.lazy` at `Mail.tsx:64` (render `:3922`/`:4130`, now `:3417`): **≈ −28 kB (−9.4 kB gz)**; preload once the inbox list has rendered.
9. **Lazy rare screens** (each a one-line `React.lazy` at the `Mail.tsx` import, rendered inside `Suspense`): threads section `GroupMail`+`ThreadsMailbox` (−28.4 kB, −7.3 gz, includes `Thread`, `NewThread`, `ShowMessageWithoutModal`), aliases `AliasesPage`+`AliasMail` (−18.1 kB, −3.5 gz, drags the legacy `ShowMessage`/`MailThread*`), `ChangelogPage` (−6.7 kB, −2.4 gz), `SentMail` (−6.2 kB, −1.6 gz), `OpenMail` (−3.4 kB), and `SettingsPage` at `App.tsx:11` (≈ −7 kB own + its MUI-only components).
10. **Small removals**: delete `GroupTabs` (`Mail.tsx:1012-1014`, now `:998`) and the `Tabs`/`Tab`/`SimpleTable`/`ShowMessage` imports (`:38-39,41,46`, now `:29,32,37`) → MUI `Tabs` family ≈ −12 kB; `react-copy-to-clipboard` → `navigator.clipboard.writeText` in `GlobalContextMenu.tsx:48-50` → −6 kB; drop `qapp-lib/app-shell/react.tsx`'s `AppMenu` (Rating/Switch/Select, 12.5 kB) now that Settings exists; convert or drop the Roboto ttf (§3): −337 kB of assets, or ≈ −220 kB if kept as subset woff2 for Hub 2.0 only; delete the 15 unreferenced ttf files from the repo.

Expected result if 1–10 are done: initial JS ≈ **780–850 kB minified / ≈ 245–270 kB gzip** (from 1,576 / 482), initial CSS ≈ **16–28 kB** (from 183), fonts 426 kB Inter only. The floor is react-dom 208 + react 8 + MUI/emotion used on first paint ≈ 230 + redux stack 28 + router 19 + `Mail.tsx` 65 + shell ≈ 20.

A vendor `manualChunks` split (react / mui) would not help on QDN — every version is a fresh zip, so there is no cross-version cache to preserve; the wins come from not loading code before it is needed or deleting code that can never run.

#### 6. Delta after `507641e` (rebuilt into `scratchpad/dist3`)
`index-rN9uls9P.js` 1,603.4 kB (490.0 kB gz, +27.7 kB), `index-CuPwsaDq.css` 186.3 kB (22.1 kB gz), assets: `Inter-{Regular,Medium,SemiBold,Bold}-*.woff2` 100.3/108.2/108.8/109.1 kB and the same two Roboto ttf. New app modules: `src/hub-theme/tokens.ts` 6.2 kB, `src/pages/Settings/SettingsPage.tsx` 5.5, `src/hub-theme/mui-theme.ts` 5.2, `ThemePicker.tsx` 1.4, `HubThemeProvider.tsx` 0.8, `boot.ts` 0.7, `ChangelogDialog.tsx` 0.5; `@mui/material` rose to 266.4 kB (+9.5). App code total 311.6 kB. `224fb37` and `d5f6dfd` (new `src/layout/*`, deleted Navbar) have not been re-measured; expect roughly −155 kB JS / −110 kB CSS from the audio player and a small net change from the shell.

### UX problems (ranked)

Judged against `docs/DESIGN.md` (Layout `:20-28`; Mobile `:30-67`; Components and states `:79-95`). Ranked by **user impact × effort** (impact first; among equal impact, the cheaper fix first). The "Status" column records what the three post-audit commits already changed, so the feature work does not redo it. Citations to `Navbar.tsx`, `left-sidebar/react.tsx` and the `Mail.tsx` mobile tree describe the baseline the findings were measured against; those files/branches are gone since `d5f6dfd`, but every component-level finding (NewMessage, ShowMessageV2, GroupedMailboxList, MailMessageRow, AliasesPage, AliasMail, SentMail, GroupMail, Thread, ThreadsMailbox, OpenMail, FileElement, Mail-styles) is untouched and still applies.

#### How the layout worked at audit time (baseline)
- **Shell.** `App.tsx:50-53` had two routes that both render `<Mail>`. A sticky 78 px top bar (`Navbar-styles.ts:20-26`, `Navbar.tsx:140`) and a fixed body of `calc(100vh - 78px)` with `overflow: hidden` (`Mail-styles.ts:21-27`); only inner `MailBodyInnerScroll` panes scrolled (`Mail-styles.ts:55-83`).
- **Desktop (≥ 951 px).** `isMobile = useMediaQuery("(max-width:950px)")` (`Mail.tsx:1070`). `LeftSidebar` (`Mail.tsx:3655-3667`, `src/qapp-lib/left-sidebar/react.tsx:301-551`) pinned/unpinned with hover preview via the logo button (`Navbar.tsx:149-153`, `Mail.tsx:3432-3464`, `left-sidebar/react.tsx:270-299`). Main column switched on `activeMailboxItem` (`Mail.tsx:3674-4048`); an opened message replaced the list in the same column (`Mail.tsx:3904-3937`).
- **Mobile (≤ 950 px).** Separate tree keyed on `mobileMode` (`Mail.tsx:4052-4694`). Drawer via the logo button with "Mailboxes / Tap to open" text (`Navbar.tsx:149-216`); a two-button "Inbox | Sent" strip in inbox/sent modes (`Mail.tsx:4326-4379`, `4467-4520`), three buttons in threads (`4561-4643`), none in aliases/compose; strip 40 px tall (`4339-4341`), scroll pane `calc(100% - 75px)` (`4385, 4526, 4649`); message as an absolute overlay `zIndex 5` (`4102-4145`), changelog `zIndex 6` (`4070-4101`). Back: only the "X" in the message header (`ShowMessageV2.tsx:185-199` → `Mail.tsx:4137-4140`), "Discard" in compose (`NewMessage.tsx:1931-1944`, which also deletes the draft `:591-600`), the (i) button for changelog (`Navbar.tsx:232-251`, `Mail.tsx:3356-3366`), "Return to Threads" (`Thread.tsx:313-319` → group list, not the combined list; `Mail.tsx:4677-4683`, `GroupMail.tsx:412-414`), drawer only for group/alias inbox. Nothing used the router, so the Android/GO hardware back button never went "back".
- **Now (`d5f6dfd`).** `MailShell` with `Rail` (desktop column / drawer), `BottomNav` Inbox/Sent/Threads/Aliases/Menu + `ComposeFab` on phones, `PaneHeader` with a Back action on sub-panes, `useLayoutMode` 600/900, `useAppViewport` for the iframe/keyboard height. The hardware back button still does nothing (no router use for views).

| # | Pri | Problem | Evidence | Fix | Status after `d5f6dfd` |
|---|---|---|---|---|---|
| 1 | P0 | **Read state is faked by injecting a `threadV2` entry**, so every real reply arrives already read, "unread" is unreliable, and Mark as Unread wipes the thread history in the list copy. | `applyReadStateToMessages` writes `generalData.threadV2 = [{ data: { markedAsReadLocally: true } }]` (`Mail.tsx:2405-2441`); `isMessageMarkedRead` / `isMarkedRead` test `threadV2.length > 0` (`GroupedMailboxList.tsx:55-58`, `MailMessageRow.tsx:153-155`); replies carry a real `threadV2` (`NewMessage.tsx:1214-1229`); `markMessagesAsUnread` empties it (`Mail.tsx:2468-2489`). | Keep a separate local `readIds` set (localStorage + the published state document) and never mutate `generalData`. | Open. Same root cause as Bugs #5. |
| 2 | P0 | **First load shows an empty state, spinners and a warning banner at the same time.** | `GroupedMailboxList` returns "No messages to display." whenever `messages` is empty (`GroupedMailboxList.tsx:243-259`), rendered *before* the `isLoading`/`isLoadingCombinedAliasInbox` spinners (`Mail.tsx:3981-4013`, mobile `4407-4440`; now `:3379-3380`); sticky amber "Fetching mail and state..." banner with `CircularProgress` + `LinearProgress` (`Mail.tsx:3519-3651`); `PageLoader` (full-screen overlay `PageLoader.tsx:18-30`) and `LoaderBar` (fixed 250 px box `LoaderBar.tsx:15-28`) can stack on top. DESIGN wants skeletons and cached data first (`docs/DESIGN.md:82-85`). | Pass `isLoading` to `GroupedMailboxList` and render `ListSkeleton` rows; show `EmptyState` only after loading finished with zero results, with a next action ("No mail yet · Compose"); delete the banner and spinners. | Partly: `states.tsx` exists (`ListSkeleton :30`, `EmptyState :54`, `ErrorState :71`) and `Mail.tsx` uses `EmptyState` (now `:3433`) and `LoadingBanner` (now `:3637`), but `GroupedMailboxList`/`SentMail`/`AliasMail`/`ThreadsMailbox`/`GroupMail` do not use them and the spinners remain. |
| 3 | P0 | **Send, Reply, Forward, Post Message and Return are `<div>`s, not buttons**: no `role`, `tabIndex`, Enter/Space handling or focus ring; keyboard and screen-reader users cannot send mail. | `NewMessageSendButton`, `ShowMessageButton`, `ShowMessageReturnButton` are `styled(Box)` with `onClick` (`Mail-styles.ts:492-520, 556-601`; used at `NewMessage.tsx:1945-1971`, `NewThread.tsx:651-674`, `ShowMessageV2.tsx:86-105`, `Thread.tsx:306-319`). | Replace with MUI `Button`/`ButtonBase` with visible text; keep the icon. | Open. |
| 4 | P0 | **"Publish Q-Mail State" is a sidebar item that publishes to QDN immediately with no confirmation or fee notice.** | `onSelectSidebarItem` calls `publishMailStateToQdn()` directly (`Mail.tsx:3151-3155`, `2629-2708`); DESIGN: "confirm anything that publishes, spends QORT" (`docs/DESIGN.md:89`). | Move to Settings › Sync with a confirm dialog that says what is published and that a fee applies. | Open (now a cloud icon in `Rail.tsx:330-332`, still one click). |
| 5 | P0 | **Tapping a message inside an expanded group both opens it and toggles its checkbox.** | wrapper `Box onClick={() => handleToggleMessage(messageId)}` (`GroupedMailboxList.tsx:485-502`) and inner `MailMessageRowContainer onClick={openMessage}` without `stopPropagation` (`MailMessageRow.tsx:231-239`). | Stop propagation in the row, or make only the checkbox toggle selection. | Open. |
| 6 | P0 | **Composer Send is pinned to the bottom of a `100vh` box, so on Android/GO the keyboard covers it.** | composer `height: 100%` (`NewMessage.tsx:1978-1988, 2003-2011`) inside `MailContainer` (`calc(100vh - 78px)`, `Mail-styles.ts:25`); footer `position: sticky; bottom: 0` (`NewMessage.tsx:1907-1918`) pins to a box that does not shrink; on phones `NewMessageSendButton` becomes `width: 100%; min-height: 48px` (`Mail-styles.ts:513-519`) and wraps under "Discard" (`NewMessage.tsx:1921-1971`); thread "Post" lives in a centred 95vh modal (`NewThread.tsx:628-675`). | Size from `--qmail-app-height`; move Send into the pane header on phones so it is never under the keyboard. | Partly: `useAppViewport.ts:12-54` now tracks `visualViewport` and writes `--qmail-app-height`, but `Mail-styles.ts:25` (`calc(100vh - 78px)`), `PageLoader.tsx:23` and the `NewMessage`/`NewThread` 95vh modals still use `vh`; Send is still in the footer. |
| 7 | P1 | **No bottom navigation, 78 px header that never hides, mailbox switching split across drawer + toggle strip + header, two hamburgers, 10.9 px "Tap to open" text.** | `Navbar.tsx:149-216`, `:208-215` + `:264-272`, `:197-206`; `Mail.tsx:4326-4379`, `4561-4643`; DESIGN `:25, 40-44`. | Bottom nav ≤5 items + FAB; ~56 px hiding header; one hamburger. | **Done** by `d5f6dfd`: `BottomNav.tsx:54` (Inbox/Sent/Threads/Aliases/Menu, 60 px `:6`), `ComposeFab.tsx:25`, `PaneHeader.tsx:50`, `Mail.tsx` now `:3608-3634`. Verify header hide-on-scroll. |
| 8 | P1 | **Breakpoint mismatch with DESIGN**: mobile tree at ≤ 950 px so tablets and 900 px Hub panes got the phone layout. | `Mail.tsx:1070`, `Navbar.tsx:65`, `NewMessage.tsx:338`, `Mail.tsx:2943`; DESIGN `:24-26`. | Use `theme.breakpoints` (`sm` 600, `md` 900). | **Done for the shell** (`useLayoutMode.ts:13-14`); **open** inside `NewMessage.tsx:338`, `NewThread.tsx:100`, `GroupMail.tsx:80`, `MailMessageRow.tsx:87`, `ShowMessageV2.tsx:40` and `Mail-styles.ts:204,218,438,469,513`, which still flip at 950 px. |
| 9 | P1 | **Every dialog is a small centred modal or popover; none is full-screen or a bottom sheet** (`docs/DESIGN.md:45-48`). | `ConfirmationModal` (`ConfirmationModal.tsx:30-35`) used for alias warning (`NewMessage.tsx:342-346`), delete-sent (`SentMail.tsx:311-316`), "Load published QDN state?" (`Mail.tsx:1147-1170`); `OpenMail` (`OpenMail.tsx:188-193`); `ConsentModal` (`ConsentModal.tsx:38-43`); `BlockedNamesModal` `width: 40%` (`BlockedNamesModal-styles.ts:18`) → 144 px at 360 px; `MultiplePublish` 75 % wide, `minHeight: 50vh` (`MultiplePublish.tsx:124-127, 180-196`); `NewThread` composer 95 % × 95vh `ReusableModal` (`NewThread.tsx:462-473`, `ReusableModal.tsx:37-51`); app menu 280 px `Popover` (`Navbar.tsx:273-292`, gone); sort `Menu` (`GroupMail.tsx:557-601`). | A shared `ResponsiveDialog` (full-screen < 600 px) and `Drawer anchor="bottom"` for menus. | Open. |
| 10 | P1 | **Tap targets under 44 px.** | toggle strip 40 px (`Mail.tsx:4339-4341`, gone); Reply/Forward `padding: 6px 12px` (~32 px, `ShowMessageV2.tsx:86-105`); every `size="small"` button on Aliases (~30 px, `AliasesPage.tsx:442-513`); reply Preview/Full/Hide (`NewMessage.tsx:1773-1824`); attachment remove bare 16 px `CloseIcon` (`NewMessage.tsx:1693-1705`, `NewThread.tsx:584-596`); "(N more)" expander text row (`ShowMessageV2.tsx:279-306`); Quill toolbar 28 × 24 px (`TextEditor.tsx:53-67`); search clear `size="small"` (`MailboxSearchBar.tsx:81-92`). | `minHeight/minWidth: 44` on touch controls; collapse the Quill toolbar to Bold/Italic/List/Quote/Link on phones. | Open except the strip. |
| 11 | P1 | **Sideways scroll risks.** | (a) `DisplayHtml` renders into `.ql-editor-display` (`DisplayHtml.tsx:31-41`), outside `.ql-snow .ql-editor`, so Quill's `img { max-width: 100% }` does not apply (`texteditor.css:48-50` only sets `cursor`); (b) `GroupContainer` `overflow: auto` (`Mail-styles.ts:774-777`), `ThreadInfoColumn` fixed 170 px (`:709-717`), `ThreadSingleTitle` `white-space: nowrap` in an unconstrained flex child (`:747-757`, `GroupMail.tsx:636-645, 680-689`); (c) `AliasesPage` `TextField minWidth: 240px` (`AliasesPage.tsx:143-149`) and card controls `minWidth: 260px` (`:407-416`). | `.ql-editor-display img, video { max-width: 100%; height: auto }`; `min-width: 0` + `overflow: hidden` on flex text children; drop fixed `minWidth`s. | Open. |
| 12 | P1 | **Fixed widths.** | `ThreadContainer width: 1254px` (`Mail-styles.ts:662-667`), `ThreadInfoColumn 170px` (`:709-717`), `TypeInAliasTextfield 340px` (`:378-380`), `MailMessageRowProfile flex: 0 0 320px` (`:194-209`), `MessageExtraDate minWidth md:168px` (`MailMessageRow.tsx:250-253`), thread date `minWidth: 160px` (`ThreadsMailbox.tsx:349`), `LoaderBar width: 250px` (`LoaderBar.tsx:23`), `ModalContent width: 40%` (`BlockedNamesModal-styles.ts:18`); sidebar `170px` rules (`index.css:431-441, 454-460`, gone), `Popover minWidth 280px` (`Navbar.tsx:285`, gone). | Fluid widths with `min-width: 0`. | Open except the deleted ones. |
| 13 | P1 | **Full `YYYY-MM-DD HH:mm:ss` timestamps in every row** leave ~120 px for the subject at 360 px. | `formatFullTimestamp` (`time.ts:43-52`) in `MailMessageRow.tsx:201-203, 257, 368`, `GroupedMailboxList.tsx:323, 448-451`, `ThreadsMailbox.tsx:351`; unused relative `formatEmailDate` (`time.ts:27-41`). | Relative date in rows, full stamp in the open message. | Open. |
| 14 | P1 | **Text under 14 px** (DESIGN `:39`). | sidebar secondary 0.74 rem (`left-sidebar/react.tsx:509`, gone), avatar initial 0.72 rem (`index.css:627`, gone), banner 0.68/0.72 rem (`Mail.tsx:3589-3592`, gone), "Tap to open" 0.68 rem (`Navbar.tsx:197-206`, gone); still live: thread "last message" 0.75 rem (`Mail-styles.ts:761, 770`), Aliases 0.78/0.8 rem (`AliasesPage.tsx:239, 288, 384, 391`), search status 0.8 rem (`MailboxSearchBar.tsx:98`), autocomplete meta 0.75 rem (`NewMessage.tsx:1530`), "Type to search" 0.78 rem (`NewMessage.tsx:1567`), reply meta 0.8 rem (`NewMessage.tsx:1829, 1838`), menu labels 0.85/0.8 rem (`index.css:379, 389`). | 14 px floor via theme typography. | Partly. |
| 15 | P1 | **Vertical space wasted on phones.** | `Spacer height="60px"` twice in `GroupMail` (`GroupMail.tsx:509, 603`) and `Thread` (`Thread.tsx:289, 322`), `AliasesPage padding 28px` (`AliasesPage.tsx:84`), 78 px header + 70 px strip (gone). | 8-16 px rhythm. | Partly (header/strip gone). |
| 16 | P1 | **No `prefers-reduced-motion` and global `disableRipple`** so touch presses give no feedback, while `MoreImg` scales on hover (`Mail-styles.ts:639-642`). | `theme.ts:73-76`; DESIGN `:66, 90`. | Enable ripple; add a reduced-motion rule in the kit. | Verify in `hub-theme/mui-theme.ts`. |
| 17 | P2 | **Screens with no error state at all** (DESIGN `:88`). | Inbox load swallows errors (`Mail.tsx:1370-1371`, `useFetchMail.tsx:320`), Sent (`SentMail.tsx:478-479`), Alias inbox (`AliasMail.tsx:210, 265`), Threads mailbox (`ThreadsMailbox.tsx:118-120`), Group threads (`GroupMail.tsx:229-231, 353`), Thread (`Thread.tsx:116-117`), Blocked names closes the modal on error (`BlockedNamesModal.tsx:37-39`). | A `status: 'idle'|'loading'|'error'|'ready'` per list feeding `ErrorState` with Retry. | `ErrorState` exists (`states.tsx:71`), unused. |
| 18 | P2 | **Group thread list has no loading indicator during its slowest phase and no empty state.** | `getGroupMembers` walks every member serially (`GroupMail.tsx:420-452`), thread loading waits on `members` (`:397`), `LoaderBar` only after that (`:139, 244`); "All Threads (Recently active)" heading over nothing (`:604-709`). | Skeleton rows immediately; "No threads yet · New Thread"; fetch members in the background. | Open. |
| 19 | P2 | **Alias inbox has no loading, empty or error state, and scroll-to-bottom re-downloads the whole mailbox.** | bare `fullMailMessages.map` (`AliasMail.tsx:295-308`); `LazyLoad onLoadMore={getMessages}` (`:307`) → `refreshMailboxMessages` refetches every page (`:106-198, 200-211`); "Load Older Messages" (`:319-321`) does the same; hidden `NewMessage` (modal mode) and `ShowMessage` never used (`:279-294`). | Reuse `GroupedMailboxList` + `MailboxSearchBar`; page by offset; delete the dead components. | Open. |
| 20 | P2 | **"Load published QDN state?" dialog interrupts every session** unless "Always fetch and apply" is ticked, and the tick does not persist (Bugs #2). | `Mail.tsx:2710-2760`; banner "QDN state and inbox history are still syncing" (`:3635-3637`). | Apply silently with a one-line toast; toggle in Settings › Sync. | Open; the old Navbar toggle (`Navbar.tsx:317-345`) is gone, so the preference needs a new home. |
| 21 | P2 | **Search decrypts the whole mailbox as soon as a term is typed.** | `useMailboxSearch.ts:35, 111-141`; only hint "Scanned x/y" (`MailboxSearchBar.tsx:102-103`). | Search subject/sender index first; "Search message bodies" as an explicit second step. | Open. |
| 22 | P2 | **Reply copy contradicts what is sent.** | "not included in the sent message" (`NewMessage.tsx:1842-1844`) vs the full `replyTo` embedded in `generalData.threadV2` (`:1214-1229`); `quotedReplyHtml` computed and discarded (`:784-792`). | State the truth, or actually quote and stop embedding. | Open. |
| 23 | P2 | **"Alias" means three different things** with no explanation. | watched alias inbox (`AliasesPage`), composer "Add Alias" = deliver to recipient's alias inbox (`NewMessage.tsx:1547-1549`; identifier `:1237-1239`), reply alias required from an alias inbox (`:1055-1059`); confirm text (`:343-346`), tour text (`Mail.tsx:957-967`). | Rename to "Send to alias" / "Reply-to alias" with helper text; explainer on the Aliases page. | Open. |
| 24 | P2 | **Sidebar items that act or toggle instead of navigating.** | "Q-Mail Threads" expands and navigates with a `+`/`-` badge (`Mail.tsx:469-473, 3225-3237`); "Publish Q-Mail State" publishes (`:3151-3155`); "Alias Compose" appears/disappears (`:433-439`). | Nav is nav; actions in the page header or Settings. | Open (`Rail.tsx:299-301` still reads the `+`/`-` badge as the expanded flag). |
| 25 | P2 | **Onboarding tour is broken after step 1** and duplicates the consent disclaimer. | steps 2-4 target `[data-qapp-lib-sidebar-item=…]` (`Mail.tsx:930, 947, 974`) that no component emits (old `left-sidebar/react.tsx:388-544`, new `Rail.tsx`); mounted only on desktop inbox at audit time (`Mail.tsx:4024-4032`; now in overlays `:3653`); disclaimer twice (`Mail.tsx:906-923`, `ConsentModal.tsx:45-52`). | Drop Joyride (−75 kB); one consent dialog; "How aliases work" on the Aliases page. | Open. |
| 26 | P2 | **Undefined CSS variables**: `--qmail-thread-subtle-text`, `--qmail-shell-bg`, `--qmail-action-primary-hover-bg`, `--qmail-sidebar-active-border`. | used in `ThreadsMailbox.tsx:219, 238`, `AliasesPage.tsx:108, 228, 238, 267, 287, 323`, `GroupedMailboxList.tsx:252, 311, 442, 457, 557, 590`, `MailboxSearchBar.tsx:49-50, 57, 76, 88, 97`, `Mail.tsx:2850, 3533, 3563, 3626`; never declared in `index.css` (still true after `d5f6dfd`, grep: none). | Replace with kit tokens (`var(--qp-*)`). | Open. |
| 27 | P2 | **Jargon and raw-system copy.** | "ACCESS TO DECRYPT" 900-weight caps (`MailMessageRow.tsx:274-282, 385-393`); "Mail download status", "Missing Data: make sure the sender has their Core turned on.", "Refetching in 2 minutes", possible `NaN%` (`OpenMail.tsx:194, 255-285`); "This republishes the same message identifier…" (`SentMail.tsx:313-316`); scan copy (`AliasesPage.tsx:232-234`); "Sidebar subitems only show aliases that currently have messages." (`AliasesPage.tsx:112`, false: the sidebar lists all watched aliases `Mail.tsx:450-459`); "Some files were not published…" (`MultiplePublish.tsx:168`); "Cancel / Proceed" everywhere (`ConfirmationModal.tsx:44-54`); emoji toasts (`Notification.tsx:13, 26`) forced `theme: 'light'` (`:47, 64`); "ect..." typo (`NewMessage.tsx:1069`, `NewThread.tsx:224`); 40 MB vs 25 MB limits (`NewMessage.tsx:66` vs `NewThread.tsx:77`). | Plain sentence-case strings ("Locked · open to decrypt", "Downloading from peers… 40 %"). | `states.tsx:93` `fetchingLabel`/`FetchingFromPeers` exist, unused. |
| 28 | P2 | **Changelog is a full-page takeover with no close control.** | `ChangelogPage.tsx:133-209`; toggled only by the (i) button (`Navbar.tsx:232-251`); DESIGN `:77`. | Changelog dialog from Settings › About. | **Done**: `src/pages/Settings/ChangelogDialog.tsx`; `ChangelogPage.tsx` can go. |
| 29 | P2 | Unauthenticated Aliases page says "Authenticate to view Inbox". | `Mail.tsx:3897`, `4312` pass `"Inbox"`. | Pass "Aliases". | Open. |
| 30 | P2 | **Polling never pauses when hidden** (drains phones). | `Mail.tsx:1383-1388`, `SentMail.tsx:514-519`, `AliasMail.tsx:222-227`, `Thread.tsx:251-256`, `GroupMail.tsx:457-459`. | One scheduler with visibility pause + backoff. | Open (Bugs #14). |
| 31 | P2 | **Dead sidebar CSS and inline-`sx` rail with hidden focus ring.** | `index.css:431-674`; `left-sidebar/react.tsx:341-368, 395-461`, `outline: 2px solid transparent`. | Delete; theme via kit. | **Done** (CSS deleted, `Rail.tsx` replaces it); re-check focus-visible in `Rail.tsx`. |
| 32 | P3 | **Icon buttons / controls without labels.** | search clear (`MailboxSearchBar.tsx:81-92`), remove-alias (`AliasesPage.tsx:500-513`), `NewThread` close div+img (`NewThread.tsx:491-493`, `Mail-styles.ts:799-815`), dropzone unlabeled `img` (`NewMessage.tsx:1663-1671`, `NewThread.tsx:548-556`), `MailIconImg`/`NewMessageAttachmentImg` no `alt` (`Mail.tsx:4353, 4375`, `NewMessage.tsx:1670`). Good examples: `ShowMessageV2.tsx:186`, `MailMessageRow.tsx:299, 410`. | `aria-label` everywhere. | Open. |
| 33 | P3 | **Clickable non-buttons** (not focusable). | group headers (`GroupedMailboxList.tsx:350-368`), rows (`MailMessageRow.tsx:219-239, 328-359`), thread cards (`ThreadsMailbox.tsx:270-274`, `GroupMail.tsx:612-615, 667-671`), "Add Alias"/"Bcc" `Typography` (`NewMessage.tsx:1547-1550`), reply expander (`ShowMessageV2Replies.tsx:94-107`), "(N more)" (`ShowMessageV2.tsx:286-305`). | `ButtonBase`/`role="button"` + key handlers. | Open. |
| 34 | P3 | **Focus rings removed / no focus trap.** | `'&:focus': { outline: 'none' }` (`NewMessage.tsx:1601-1603, 1639-1641`, `ChipInputComponent.tsx:112-114`, `NewThread.tsx:532-534`, `BlockedNamesModal-styles.ts:19-21`); no global `:focus-visible`; `ReusableModal` `disableAutoFocus disableEnforceFocus disableRestoreFocus` (`ReusableModal.tsx:26-28`). | Kit `:focus-visible`; MUI `Dialog`. | Open. |
| 35 | P3 | **Contrast.** | placeholders 0.58/0.56 alpha (`index.css:43, 73`), muted 0.72 (`index.css:28, 61`), `PageLoader` `rgba(255,255,255,0.25)` over dark (`PageLoader.tsx:28`), unstyled Joyride tooltips, info toasts forced light. | Kit tokens. | Partly (kit present). |
| 36 | P3 | **Semantics.** | `TabPanel` `aria-labelledby` = its own id (`Mail.tsx:4710-4715`, now `:3677-3691`, unused); mobile strips had no `role="tablist"` (`Mail.tsx:4334-4378`, gone). | Delete `TabPanel`. | Partly. |
| 37 | P3 | **Hover-only**: only the desktop sidebar preview was hover-driven (`Navbar.tsx:152-153`, `Mail.tsx:3436-3441`). | | | Gone. |

#### Loading / empty / error states per screen (baseline)

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Inbox list (`Mail.tsx:3970-4035`, mobile `4397-4453`; now `:3360-3400`) | Banner (`3525-3651`; now `LoadingBanner :3637`) + two `CircularProgress` after the list (`3991-4013`; now `:3379-3380`); `PageLoader` overlay possible (`GlobalWrapper.tsx:306`) | "No messages to display." (`GroupedMailboxList.tsx:243-259`), also shown *during* load, no action | None (`Mail.tsx:1370`, `useFetchMail.tsx:320`) |
| Sent (`SentMail.tsx:655-685`) | Spinner after list (`671-682`) | Same generic empty, shown during load | None (`478-479`) |
| Alias inbox (`AliasMail.tsx:277-328`) | None | None (blank) | None (`210, 265`) |
| Aliases page (`AliasesPage.tsx`) | "Checking alias activity..." inline (`317-329`); scan progress bar (`245-297`) | "No saved aliases." (`331-340`), no action | None |
| Threads mailbox (`ThreadsMailbox.tsx`) | Centred spinner (`194-208`) | "No groups with threads available." / "No threads to display." (`210-246`), no action | None (`118-120`) |
| Group threads (`GroupMail.tsx`) | Global `LoaderBar` only after members resolve (`139, 244, 397`) | None | `console.log` only (`230`) |
| Thread (`Thread.tsx`) | `LoaderBar` "Loading messages" (`84`), skeleton rows while decrypting (`332-345`) | None | None (`116`) |
| Open message (`OpenMail.tsx`) | Dialog with spinner + status text (`219-289`) | n/a | "Unable to decrypt message" / "Message has an invalid format" (`196-217`), no retry; spins forever on a thrown fetch (Bugs #3) |
| Compose (`NewMessage.tsx`) | Directory search spinner (`1564`), `MultiplePublish` modal (`2033-2075`) | n/a | Toasts (`1072-1080, 1292-1297`); publish failures list with "Try again" (`MultiplePublish.tsx:163-173`) |
| Blocked names (`BlockedNamesModal.tsx`) | None | None | Closes the modal (`37-39`) |
| App menu / rating (`app-shell/react.tsx:448-582`; now `SettingsPage.tsx`) | "Authenticating" (`476-477`) | "No ratings yet" (`558`) | Error caption (`572-579`) |
| Unauthenticated | n/a | "Authenticate to view {Inbox/Sent/Threads}" prompt with button (`Mail.tsx:2821-2880`) | n/a |

#### What fights the Hub 3.0 look (baseline; the kit is now wired, so re-check each item)
- Theme kit copied to `src/hub-theme/` but unwired at audit time; `App.tsx:6-8, 44` used `lightTheme/darkTheme` with hard-coded hex (`theme.ts:89-108, 136-156`); only light/dark (`App.tsx:16`). **Now** `HubThemeProvider` (`App.tsx:4`) and `SettingsPage` (`App.tsx:11`).
- Lexend/Illinois typography (`index.css:6, 189`, `main.tsx:22-28`) and the Roboto `@font-face` still injected; own `--qmail-*` palette with brand `#39afff` (`index.css:13`); radial-gradient body background (`index.css:164-171`).
- Radii: 4 px MUI default (`theme.ts:50-52`), 56/5/10/56 px pill rows (`Mail-styles.ts:186`), 35/4/4/35 px thread cards (`Mail-styles.ts:686, 700`), 12 px cards, 999 px avatars — DESIGN wants 8 px (`docs/DESIGN.md:3, 28`).
- Hard-coded colours outside theme files: `MultiplePublish.tsx:206-225` (`#292d3e`, `#f6f8fa`, `#575757`, `#d3d9e1`, `#474646`, `#b7bcc4`), `FileElement.tsx:20` (`skyblue`), `PageLoader.tsx:28`, amber `rgba(255,171,64,…)` fallbacks in `Mail.tsx:3531-3646` (gone) and `left-sidebar/react.tsx:431-458` (unrendered), `theme.ts` palettes, `MuiIcon` colours (`theme.ts:126-132, 172-178`). Ground rule 3 fails until these go.
- `direction: rtl` hack to move scrollbars left (`Mail.tsx:3679, 3908, 3944, 4084, 4116, 4524`, gone) and custom webkit scrollbar styling (`Mail-styles.ts:61-82, 292-313`, `index.css:244-334`).
- Overloaded Quill toolbar (14 groups incl. font, colour, RTL, sub/superscript, `TextEditor.tsx:53-67`) in a mail composer.
- `GlobalContextMenu` hijacks the browser context menu for a single "Copy" item (`GlobalContextMenu.tsx:14-52`; still mounted `main.tsx:51`).

DESIGN.md checklist (`docs/DESIGN.md:97-106`) at audit time: HubThemeProvider / four themes **no** (now yes); boot snippet **no** (now in `index.html`); no hard-coded colours **fails**; Settings page + changelog from version **no** (now yes); mobile first-class **fails** (shell now done, components open); every screen has loading/empty/error **fails**; Inter from the kit **no** (now yes, Roboto still shipped).

### Bugs (ranked)

Scope: every file the import graph reaches from `src/main.tsx` (86 files at audit time). `src/pages/Mail/Mail.tsx` (4,723 lines) and `src/pages/Mail/NewMessage.tsx` (2,078 lines) were read in full. Verification runs at audit time: `npx tsc --noEmit` exits 0; `npx vitest run` passes 17/17. Provenance checks use the upstream import commit `6cf4c17`. Ranked by user impact × effort. Where the bugs report's line numbers for `fetchMail.ts`, `OpenMail.tsx`, `DownloadWrapper.tsx`, `adapters.ts`, `useQMailAppShell.ts`, `ChangelogPage.tsx`, `useMailboxSearch.ts` and `helpers.ts` did not match the files (they appear to have been taken from a concatenated listing), the original citation is kept and the re-verified line is given as **(verified: …)**.

Negative results worth stating: no `findDOMNode`, string refs, or function-component `defaultProps` in reachable code or in the runtime deps that render (`react-joyride` 3.2.0 uses `onEvent`, which `Mail.tsx:4027` (now `:3656`) passes; `react-quill-new`, `react-copy-to-clipboard`, `react-dropzone` contain no `findDOMNode`). No `MenuItem` outside `Menu`/`Select`, no `Tab` outside `Tabs` (the `Tabs`/`Tab` imports and `GroupTabs` are unused), no `disableEscapeKeyDown`, no `TextField InputProps`. The `_mail_qortal_qmail_` identifier prefix (`NewMessage.tsx:1232-1239`) is upstream, so identifier compatibility is intact.

#### High impact

**1. Selecting a secondary owned-name inbox instance always shows "No messages to display."** (high impact, low effort)
- `src/pages/Mail/Mail.tsx:1330-1343` (now `:1315`) — `inboxMessagesForList` returns `combinedInboxMessages` when no instance is selected, `mailMessages` when the selected instance is the primary name, and **`null` for any other owned name**.
- `Mail.tsx:1344-1357` — `shouldRunInboxSearch` becomes false and `useMailboxSearch` is fed `messages: []`, so `inboxSearchResults` is `[]`.
- `Mail.tsx:1914-1922` — the effect that fetches the secondary names' messages bails out when `selectedInboxInstanceName` is set, so nothing is fetched for that name either.
- `Mail.tsx:3980-3990` (desktop) and `4407-4417` (mobile), now `:3370-3378`, render `GroupedMailboxList` with `inboxSearchResults`; `GroupedMailboxList.tsx:243-260` renders the empty state.
- Repro: own two names that both have inbox mail (both appear under "Inbox", built at `Mail.tsx:441-448`). Click the second name. Empty list, no spinner, no error.
- Fix: return `combinedAliasInboxMessages[selectedInboxInstanceName] ?? []` for the non-primary case (keyed by name at `1944-1951`) and let the effect at `1914` fetch just the selected name when the map has no entry for it.

**2. "Always fetch and apply QDN state" checkbox in the load prompt never persists** (high, low)
- `Mail.tsx:2710-2819` (now `:2691`) — `loadPublishedMailStateFromQdn` is a `useCallback` whose closure captures `rememberQdnStatePreferenceOnLoad` (dep at `2815`). It is invoked once per identity by the effect at `3340-3348`, guarded by `hasPromptedForPublishedMailStateRef`.
- `Mail.tsx:2752` awaits the modal; the user ticks the checkbox (`1160-1165` → `setRememberQdnStatePreferenceOnLoad(true)`) and clicks Proceed. `2757` then tests the **stale captured value (false)**, so `writeAutoApplyQdnState` at `2758` never runs. The effect refuses to re-run (`3346`).
- Repro: account with a published `qmail_state_v1` and no `qmail_auto_apply_qdn_state_<addr>` key; reload → prompt → tick → Proceed → reload: prompted again; `localStorage` has no key.
- Fix: mirror the checkbox into a `useRef` and read the ref at `2757`, or have `showLoadPublishedStateModal` resolve with the checkbox value. `ChangelogPage.tsx:545` **(verified: `:23`, `:28`)** advertises this feature. With the Navbar gone, the only other writer (`Navbar.tsx:337`) no longer exists, so today there is **no working way** to set the preference from the UI.

**3. Message open dialog spins forever when the fetch/decrypt path throws** (high, low)
- `src/utils/fetchMail.ts:268-270` **(verified: outer `catch` at `:121-123`)** — logs and falls through, so `fetchAndEvaluateMail` resolves `undefined` whenever `FETCH_QDN_RESOURCE`, `GET_NAME_DATA` or `GET_ACCOUNT_DATA` throws (declined permission, name gone, node error).
- `src/pages/Mail/OpenMail.tsx:425-426` **(verified: `:56`)** — `res.unableToDecrypt` throws `TypeError` on `undefined`; the `catch` at `433-435` **(verified: `:63`)** is empty, so `handleClose` is never called and neither `unableToDecrypt` nor `isValid` flips.
- `OpenMail.tsx:589-603` **(verified: `:219`, `:234`)** — with `resourceStatus.status` still empty, the dialog shows the "Downloading Message" spinner until the user closes it. `Mail.tsx:1435-1450` then receives the close event as `res` and silently does nothing.
- Fix: return `{ ...obj, isValid: false }` from the catch in `fetchMail.ts`, and guard `if (!res) { setIsValid(false); return }` in `OpenMail`; render `ErrorState` with Retry.

**4. Download poller dies silently on the first thrown request, leaving spinners forever** (high, low)
- `src/wrappers/DownloadWrapper.tsx:429-437` **(verified: `:100-106`)** — inside `setInterval`, `isCalling = true` is set and `qortalRequest({action:'GET_QDN_RESOURCE_STATUS'})` is awaited with **no try/catch**. One rejection leaves `isCalling` true, so every subsequent tick returns at `430` **(verified: `:99`)** and the interval never clears. No status is ever dispatched, so OpenMail (`OpenMail.tsx:589-603`, verified `:219-234`) and attachment rows (`FileElement.tsx:600-609`) stay on their spinners.
- Also `DownloadWrapper.tsx:508-517` **(verified: `:177-186`)** — on `MISSING_DATA` the 5-second poll is never cleared, so an unreachable sender's message keeps one `GET_QDN_RESOURCE_STATUS` per 5 s per attempted message for the entire session; and `performDownload` has no unmount cleanup.
- Fix: wrap the tick in try/finally that resets `isCalling`, clear the interval on error or after N `MISSING_DATA` results and dispatch a terminal status; keep interval ids in a ref cleared on unmount.

#### Medium impact

**5. Any reply arrives already "read", and Mark as Unread wipes the thread history from the list copy** (high impact, medium effort; same root cause as UX #1)
- `GroupedMailboxList.tsx:55-58`, `MailMessageRow.tsx:153-155,205`, `Mail.tsx:2412-2417` and `2524-2528` all define "read" as `generalData.threadV2.length > 0`.
- A reply carries the sender's full `threadV2` (`NewMessage.tsx:1214-1229`), so a brand-new incoming reply is unbolded on arrival, and `localMailStateById` (`Mail.tsx:2537-2544`) publishes it to QDN as `read: true`.
- `Mail.tsx:2468-2489` — `applyUnreadStateToMessages` sets `threadV2 = []` on the list entry, destroying the genuine reply chain in the list copy (display still uses the hashMap copy, so the damage is to the read model).
- Inherited from upstream. Fix: track read state in a dedicated structure (a `Set` of read ids persisted with the existing `qmail_state_v1` document under a new top-level map, since per-entry extras are dropped by `normalizePublishedStateEntry`), or only count entries whose `data.markedAsReadLocally === true` (the marker written at `Mail.tsx:2430-2433`).

**6. Interval leaks in the download/status refetchers** (medium, low)
- `OpenMail.tsx:516-527` **(verified: `:146-157`)** and `src/components/FileElement.tsx:538-552` **(verified: `:237-251`)** — `refetchInInterval` creates a `setInterval` stored in a local, never cleared on unmount. Once a resource reports `DOWNLOADED` (triggered at `OpenMail.tsx:544-550` verified `:174-180` / `FileElement.tsx:571-577` verified `:270-276`), a 7.5 s timer calling `GET_QDN_RESOURCE_PROPERTIES` runs for the rest of the session even after the dialog/attachment is gone (the `status` ref freezes, so `READY` is never observed by that timer).
- Fix: keep the interval id in a `useRef` and clear it in an effect cleanup; also clear once `READY` is dispatched.

**7. Avatar request storms (no dedupe, repeated every poll, misses never remembered)** (medium, medium)
- `src/hooks/useFetchMail.tsx:315-319` — `getAvatar(content.user)` for **every message** after a full inbox load (500 messages from 10 senders = 500 `GET_QDN_RESOURCE_URL` calls), un-awaited, no `userAvatarHash` check.
- `src/pages/Mail/AliasMail.tsx:205-209` inside `refreshMailboxMessages`, which the 30 s poll at `222-227` calls, so every alias-inbox message triggers an avatar request every 30 seconds.
- `Mail.tsx:1728-1774` — the sidebar avatar effect depends on `avatarUrlByNameLowercase`; each `setUserAvatarHash` dispatch restarts the loop, and names without an avatar (`1749-1751`) are never recorded as misses.
- `GroupMail.tsx:341` awaits an avatar per thread inside `Promise.all` (duplicates per owner).
- `globalSlice.ts:110-115` stores the `"Resource does not exist"` sentinel as a URL.
- Fix: one request per name per session, remember misses, lazy-load in the row via IntersectionObserver. Violates ground rule 4.

**8. Alias inbox "Load Older Messages" / LazyLoad re-scan the whole mailbox** (medium, low)
- `AliasMail.tsx:106-198` fetches every 200-row page for both queries; `200-215` `getMessages` is just that full refresh.
- `AliasMail.tsx:307` `<LazyLoad onLoadMore={getMessages}>` fires whenever the sentinel scrolls into view (`LazyLoad.tsx:17-25`), and `319-321` shows a "Load Older Messages" button that does the same full refetch. Neither pages.
- `AliasMail.tsx:279-294` also mounts an unused `<NewMessage hideButton>` and `<ShowMessage>`.
- Fix: drop the LazyLoad/button (everything is already loaded) or implement real offset paging; remove the dead components.

**9. Combined inbox refetches every secondary name's full history on every visit** (medium, low)
- `Mail.tsx:1914-1969` — deps include `isInboxViewActive` and `selectedInboxInstanceName`; switching Sent → Inbox, or Threads → Inbox, re-runs `fetchInboxMessagesForOwnedName` (`795-900`, full paged scans of two substring queries per name) with no cache and no incremental check.
- Fix: cache per name in state/ref for the session and refresh through the 30 s `checkNewMessages` path (`useFetchMail.tsx:97-140`) instead.

**10. Onboarding tour targets attributes no sidebar renders** (medium, trivial)
- `Mail.tsx:930,947,974` (now `:888-993`) — Joyride steps target `[data-qapp-lib-sidebar-item='inbox'|'compose'|'aliases']`.
- Old `src/qapp-lib/left-sidebar/react.tsx:388-394` rendered plain `ButtonBase`s with no `data-qapp-lib-sidebar-item`, no `data-qapp-lib-sidebar-active` and no `qapp-lib-left-sidebar-item-button` class; the new `src/layout/Rail.tsx` does not emit them either. The old `src/index.css:677-760` sub-item rules keyed off those attributes (deleted in `d5f6dfd`); the avatar wrapper `<span class="qmail-sidebar-subitem-avatar-icon">` from `Mail.tsx:3007-3018` got no size from CSS.
- Repro: remove `tourStatus-qmail` from localStorage, reload while authenticated; after the welcome step the tour cannot locate steps 2-4.
- Fix: emit `data-qapp-lib-sidebar-item={item.id}` in `Rail.tsx`, or drop Joyride (UX #25, Bundle #3).

**11. "Rate this app" never touches Qortal** (medium, medium)
- `src/qapp-lib/app-shell/adapters.ts:773-801` **(verified: `:91-119`)** — `createQortalRatingAdapter(_options)` ignores the injected `qortalRequest` and reads/writes votes in `localStorage` (`qapp-lib:ratings:APP:<poll>:qmail`).
- Shown with `pollName: 'app-library-APP-rating-qmails'` (`useQMailAppShell.ts:517-520`, **verified: `:141-144`**) from `SettingsPage.tsx:280-289` (formerly `Navbar.tsx:299-315`); `ChangelogPage.tsx:588` **(verified: `:66`)** claims poll-backed ratings.
- Fix: implement `getSummary`/`submitVote` with the poll APIs, or hide the `rating` section until it is real.

**12. Reply payloads grow geometrically with thread length** (medium, low; inherited)
- `NewMessage.tsx:1214-1229` — a reply's `threadV2` is `[...replyTo.generalData.threadV2, { reference, data: replyTo }]`, and `replyTo` still contains its own `generalData.threadV2`. Each hop embeds the whole previous message including its embedded history, so the first message is duplicated 2^(n-1) times by hop n. It can also carry the local `markedAsReadLocally` marker.
- Fix (additive-safe; the original app only reads `data.user/createdAt/subject/attachments/textContentV2` in `ShowMessageV2Replies.tsx`): strip `data.generalData.threadV2` (and `data.generalData.thread`) before embedding.

**13. Thread polling drops the newest message when it is not within the top 20** (medium, trivial; inherited)
- `src/pages/Mail/Thread.tsx:194-203` (verified `:199-203`) — `sliceLength` is computed (`responseData.length` when `findMessage === -1`) but the code uses `responseData.slice(0, findMessage)`, i.e. `slice(0, -1)` when not found, which discards the newest item and re-processes the rest.
- Fix: `responseData.slice(0, sliceLength)`.

**14. Pollers never pause when the tab is hidden and never back off** (medium, medium; ground rule 4)
- `Mail.tsx:1383-1388` (30 s inbox), `AliasMail.tsx:222-227` (30 s), `SentMail.tsx:514-519` (30 s, two full paged scans per name via `394-486`), `Thread.tsx:251-256` (**8 s**, re-created on every `messages` change), `GroupMail.tsx:457-459` (180 s, `420-452` does `getNameInfo` + `GET_ACCOUNT_DATA` sequentially for every group member each time), `GlobalWrapper.tsx:238-243` (600 s, which also re-triggers the per-group thread probes).
- Fix: gate ticks on `document.visibilityState`, back off on unchanged results, cache group members.

#### Low impact

**15. Missing/undefined React keys in lists.** `GroupMail.tsx:612` and `667` (`SingleThreadParent` per thread; verified `:607`), `Thread.tsx:332` (skeleton branch), `NewThread.tsx:567`, `ShowMessage.tsx:209`, `ShowMessageV2Replies.tsx:528`, `MailThread.tsx:435,500`, `MailThreadWithoutCalling.tsx:694` render mapped elements with no `key`; `MailTable.tsx:477` uses the index. React logs warnings and can mis-reconcile expanded/selected state when lists reorder.

**16. `escapeHtml` is a no-op and the forward header is unescaped.** `NewMessage.tsx:206-213` replaces `&`→`&`, `<`→`<`, `>`→`>`, `"`→`"` (entities were decoded at some point); only used by `quotedReplyHtml` at `784-792`, which is itself dead (`escapedBody` unused, result never referenced). `src/utils/helpers.ts:305-312` **(verified: `:26-33`)** builds the forward header by interpolating sender name and subject straight into HTML (`ShowMessageV2.tsx:70-76`); a subject containing `<` is mangled by Quill (DOMPurify at `DisplayHtml.tsx:160` **(verified: `:19-27`)** prevents script execution on display). Fix: delete the dead code or restore proper entities; escape in `updateMessageDetails`.

**17. "to:" line in the message view is always blank** (inherited). `ShowMessageV2.tsx:156` renders `message?.to`, but mail JSON carries `recipient` (`NewMessage.tsx:1211`, tombstone `SentMail.tsx:588`); `to` is only injected locally for sent/alias opens. Fix: `message?.recipient || message?.to`.

**18. Encrypted base64 blob shown as the subject when subject decryption fails.** `MailMessageRow.tsx:174-180` — on `DECRYPT_DATA` failure the fallback uses `subjectValue` (the ciphertext written at `fetchMail.ts:96-108`) as the display subject. Fix: fall back to `""` so the row shows the locked state.

**19. Identifier parser assumes recipient names contain no `_` and are at most 20 chars.** `src/pages/Mail/mailIdentifier.ts:6` `/qortal_qmail_([^_]+)(?:_([^_]+))?_mail_/` — a name with an underscore splits into a bogus name/address pair. Downstream: Sent grouping label (`GroupedMailboxList.tsx:88-90`), recipient lookup (`MailMessageRow.tsx:112-135`), delete-sent resolution (`SentMail.tsx:193-251` → "Unable to resolve recipient"), alias scan skip (`Mail.tsx:2181-2183`). Names longer than 20 chars are stored truncated (`NewMessage.tsx:1232-1235`) and `getSentRecipientDisplayLabel` (`mailIdentifier.ts:71-84`) shows the truncated form in Sent group headers. Impact depends on Qortal name rules; plausible rather than confirmed.

**20. New-mail poll gives up when the newest message is not in the top 20** (inherited). `useFetchMail.tsx:113-120` — if `mailMessages[0]` is not in the 20-row poll result (more than 20 new messages since last tick, or the first message hasn't loaded yet), it returns without adding anything; new mail only appears after a reload. Also when the inbox is empty it returns at `:114`.

**21. Thread resource is published before the message publish is confirmed** (inherited). `NewMessage.tsx:1128` and `NewThread.tsx:343` publish the `MAIL` thread resource with a direct `qortalRequest`, then open `MultiplePublish` for the message. Declining or failing the second publish leaves an orphan thread with no messages on QDN.

**22. React 19 / MUI 9 warnings (non-fatal).**
- `NewMessage.tsx:1509` spreads `props` (which contains `key` in MUI 9) then sets `key` → "A props object containing a key prop is being spread into JSX".
- `src/components/common/Notification/Notification.tsx:13-50` calls `toast.*` and `dispatch(removeNotification())` during render (`:23`) → "Cannot update a component while rendering a different component".
- `Mail.tsx:3519-3520` (now `:3225`) counts `isLoadingQdnState` in the bootstrap banner, so "Fetching mail and state…" shows while the QDN-state prompt waits for the user (cosmetic).

**23. Search decrypt cost (design note).** `useMailboxSearch.ts:702-726` **(verified: `:299-331`)** decrypts every not-yet-decrypted message on any query (up to 4 requests each: `FETCH_QDN_RESOURCE`, `GET_NAME_DATA`, `GET_ACCOUNT_DATA`, `DECRYPT_DATA`, `fetchMail.ts:170-199` **(verified: `:23-52`)**), 3 in flight, un-debounced. Works as advertised but should be gated (search after 2+ chars, cap per run) on large inboxes.

**24. Stale 950 px breakpoints inside components** (new after `d5f6dfd`). `NewMessage.tsx:338`, `NewThread.tsx:100`, `GroupMail.tsx:80`, `MailMessageRow.tsx:87`, `ShowMessageV2.tsx:40` and `Mail-styles.ts:204,218,438,469,513` still switch at 950 px while the shell switches at 600/900, so a 700 px window gets the medium shell with phone-styled rows and composer.

#### `quillHtml.ts` and its two publish points (verified correct)
`src/components/common/TextEditor/quillHtml.ts:96-147` **(report's lines; the file is 1-63 per the data-contract report — both describe the same converter)** is correct for the cases that matter: early return on Quill 1/plain HTML, `span.ql-ui` removal, code-block container → single `<pre class="ql-syntax" spellcheck="false">` with trailing newline, `<ol><li data-list=…>` → `<ul>`/`<ol>`/`<ul data-checked>` with run-splitting, `ql-indent-N` classes preserved. Static `querySelectorAll` plus `replaceWith` is safe because nested lists travel with their `<li>`. Idempotent; 17 unit tests pass. Publish points: `NewMessage.tsx:1092` converts once and uses the result for both thread messages (`1135`) and mail (`1206`); `NewThread.tsx:242` converts at object build time. `DisplayHtml.tsx` also applies it on render, so Quill-2 HTML from other apps renders correctly. Only nit: the marker regex also fires on body text literally containing `data-list=`, which just round-trips the HTML through DOMParser (harmless).

### Existing features vs. the redesign's slices

Reachable code from `src/main.tsx`: `App.tsx` → `Mail` page (routes `/`, `/to/:name`, `*`) plus `SettingsPage` on `/settings`. Everything under `src/pages/Mail/` except `Chat*.tsx`/`FlexLayout.tsx` is live. Effectively dead: `ShowMessage.tsx` (modal, only mounted by `AliasMail.tsx:288-294` with `isOpen` never true), `MailThread.tsx` (only used by that modal, `ShowMessage.tsx:139-144`), `MailTable.tsx`'s `SimpleTable` (only `AvatarWrapper` `:160-177` is live), `qapp-lib/left-sidebar/*` (since `d5f6dfd`), `ChangelogPage.tsx` (superseded by `ChangelogDialog.tsx`), `app-shell/react.tsx`'s `AppMenu` (superseded by `SettingsPage`).

#### (1) Search across mail — **exists, partially**
- Hook `src/pages/Mail/useMailboxSearch.ts`, UI `src/pages/Mail/MailboxSearchBar.tsx`. Inputs `messages, query, mailboxType: "inbox"|"sent", username, hashMapMailMessages, enabled` (`:11-20`); query lower-cased, split on whitespace, every term must match (`:41-55`).
- Searches other-party text (inbox: sender; sent: recipient label/name/address-suffix + sender) + decrypted `subject` + body (`textContentV2` string, or Slate array via `extractTextFromSlate`) + QDN metadata `title`/`description` (`:57-114`).
- Decrypts on demand: every message not in `hashMapMailMessages` is queued for 3 workers (`SEARCH_CONCURRENCY = 3`, `:35`; loop `:298-336`) using `fetchAndEvaluateMail` (`:263-290`); candidates: sent → parsed recipient then sender, inbox → sender (`:116-135`); results dispatched into Redux (`:279-281`) so a search warms the open cache; streams progressively (`applyState` `:190-204`), status `{active, complete, scanned, total, matches}` (`:27-33`) shown as "N matches • Scanned x/y" (`MailboxSearchBar.tsx:94-105`). Cache: in-memory `Map` ref per hook instance (`:147`).
- Per *view*, not global: inbox search over `inboxMessagesForList` (`Mail.tsx:1330-1343`); sent search inside `SentMail.tsx:345-352`, `username = activeInstanceNames[0]`. Bar at `Mail.tsx:3974-3979`/`4401-4406` (now `:3365-3370`) and `SentMail.tsx:657-662`.
- Not searchable: alias inboxes (`AliasMail.tsx:277-328`), group threads (`ThreadsMailbox.tsx`, `GroupMail.tsx`, `Thread.tsx`).
- Missing: cross-mailbox search; persistent index (only encrypted subjects survive reload, `fetchMail.ts:95-109`); sender/date/has-attachment filters; match highlighting; a way to search without decrypting the whole list; Slate `textContent` bodies.

#### (2) Unread/read state and badges — **exists, local + optional published doc; no counts anywhere**
- Representation: "read" = list item's `generalData.threadV2` non-empty. `applyReadStateToMessages` writes the synthetic entry (`Mail.tsx:2405-2441`); `applyUnreadStateToMessages` empties the array (`:2468-2489`). Readers `GroupedMailboxList.tsx:55-58`, `MailMessageRow.tsx:153-155`.
- Bold rule: `shouldBoldUnread = !isFromSent && isEncrypted && !isMarkedRead` (`MailMessageRow.tsx:205`), `isEncrypted` false once decrypted in `hashMapMailMessages` (`:160-164`). Group header bold when any child unread (`GroupedMailboxList.tsx:329-331, 421-437`).
- Auto mark-as-read on open for inbox and alias views (`Mail.tsx:1408-1409`, `:1418-1426`, `:1440-1448`) via `markMessagesAsReadRef` (`:2565-2597`).
- Bulk: checkbox per message/group (`GroupedMailboxList.tsx:147-201`), "Select all" (`:264-318`, inbox only `Mail.tsx:3983`), sticky "Mark as Unread (n)" / "Mark as Read (n)" (`:546-598` → `Mail.tsx:2565-2627`).
- Persistence: local marks live only in Redux `mailMessages` / `combinedAliasInboxMessages`, both rebuilt on load (`clearMessages` `Mail.tsx:1559`; `upsertMessages` `useFetchMail.tsx:313`), so unpublished read state is lost on reload. No localStorage copy.
- Published doc `qmail_state_v1` (Data contract §10): built `:2646-2652`, `localMailStateById` (`:2516-2554`), `hasPendingStateChanges` (`:2556-2563`), `!` badge (`:487-494`, icon `:3069-3082`, click `:3151-3155`); load `:2716-2724`, prompt `:1147-1170`, `:2752-2759`, decrypt `:2766-2775`, applied once (`:3285-3338`).
- Alias inbox rows come from `AliasMail`'s own state (`AliasMail.tsx:60-69`); `markMessagesAsRead` only updates Redux `mailMessages` and the combined map (`Mail.tsx:2575-2582`), so alias-inbox reads are not in the published state unless the message was a reply.
- Counts show nowhere: no unread number on sidebar items (`buildSidebarItems` uses `badgeText` only for `+/-` and `!`, `Mail.tsx:472,492`; `Rail.tsx:228,314` would render any `badgeText`), no `document.title` count, no Hub badge (only `NOTIFICATION_MARK_SEEN` on start). Group headers show "N messages • date" (`GroupedMailboxList.tsx:448-451`).
- Missing: unread counters, a local persistent read store, a read model independent of `threadV2`, read state for alias inboxes and threads (threads have their own "viewed timestamp" store, `Thread.tsx:131-162`, `GroupMail.tsx:474-482,608-609`).

#### (3) Reply, reply all, forward with quoting
- **Reply exists.** `ShowMessageV2.tsx:53-55` → `openReplyComposerFromMessage` (`Mail.tsx:1456-1479`) → `NewMessage` effect (`NewMessage.tsx:724-745`): To = `replyTo.user`, Subject verbatim (no `Re:`). On send, `threadV2 = [...replyTo.generalData.threadV2, {reference, data: replyTo}]` (`:1214-1229`). Send button reads "Reply" (`:1306-1310`). BCC and alias allowed while replying (`:1541-1552`).
- **Quoting: computed but not used.** `replyBodyText` (`:755-775`), `replyQuoteIntro` (`:777-782`), `quotedReplyHtml` (`:784-792`) exist; nothing inserts the quote; the composer says the preview "is not included" (`:1842-1844`). `escapeHtml` does not escape (`:206-213`). Preview / Full / Hide (`:1773-1824`, `:1845-1867`).
- **Reply all: does not exist**, and cannot be built from the payload: single `recipient` (`:1211`), BCC copies each get their own (`:1253`); no To/CC list stored. Sent-view Reply would address yourself (`ShowMessageV2` reused for sent, `Mail.tsx:3922-3933`; reply targets `message.user`).
- **Forward exists, weak.** `ShowMessageV2.handleForwardedMessage` (`:57-77`) builds the header via `updateMessageDetails` (`src/utils/helpers.ts:23-34`) + `textContentV2`/`htmlContent` → `openForwardComposerFromMessage` (`Mail.tsx:1481-1501`) → editor value (`NewMessage.tsx:747-753`). Not carried: subject (no `Fwd:`), attachments, `threadV2`, recipient.
- Missing: `Re:`/`Fwd:`, real inline quote, attachment forwarding, reply-all (needs additive `to`/`cc` fields), reply from Sent to the original recipient.

#### (4) Conversation / thread view for direct mail
- `generalData.thread` (legacy v1): array of `{identifier, service, name}` (`MailThread.tsx:55-59`), one search per reference + `fetchAndEvaluateMail` (`:80-139`), accordions (`:152-275`); only rendered by the dead `ShowMessage.tsx:134-144`. New sends write `thread: []` (`NewMessage.tsx:1208`).
- `generalData.threadV2` (current): `{reference, data}` (`NewMessage.tsx:1218-1228`), shown in `ShowMessageV2.tsx:328-337` sorted by `data.createdAt`, each a collapsed `ShowMessageV2Replies` card (`:52-54, 94-158, 159-262`). `MailThreadWithoutCalling.tsx` is the accordion variant for the dead modal (`ShowMessage.tsx:146-151`).
- The list is not thread-aware: `GroupedMailboxList` groups by sender (inbox) or parsed recipient (sent) (`:81-116`), so sent and received halves of one conversation live in different views.
- Missing: a conversation list across inbox+sent, threading by reference id instead of embedded copies (additive `inReplyTo`/`threadId` fields), collapse/expand-all, jump to reply.

#### (5) Sent view — **exists** (`src/pages/Mail/SentMail.tsx`)
- Names: `sentInstanceNamesForCurrentView` (`Mail.tsx:3504-3516`, now `:3209`) = all `ownedSentNames` or the selected instance; `ownedSentNames` from `hasSentMailActivityForOwnedName` (`Mail.tsx:639-691`).
- Fetch: per name, two paged searches with `name=<name>&exactmatchnames=true` (`SentMail.tsx:45-59`, `:394-486`), filtered by `isSentMailIdentifier` and tombstones (`:445-451`), deduped and sorted (`:463-477`), full re-fetch every 30 s (`:509-526`).
- Display: `GroupedMailboxList mailboxType="sent"` grouped by `getSentRecipientGroupKey` (`mailIdentifier.ts:49-69`), label "To: <name>" (`GroupedMailboxList.tsx:435-437`), alias avatar for alias groups (`:324-325, 408-413`). Expanded rows resolve the real recipient with `SEARCH_NAMES` (`MailMessageRow.tsx:108-149`), N identical uncached calls per expanded group.
- Opening: `Mail.openMessage` with `to` (`Mail.tsx:1400-1454`) → `OpenMail` with `otherUser = sender` (`OpenMail.tsx:95-100`).
- Delete: confirm → resolve recipient (`SentMail.tsx:170-267`) → tombstone republish (`:575-613`), remembered locally (`:72-107, 354-385`); hidden on fetch (`:109-138`). Costs a publish fee (`:311-316`).
- Missing: linking a sent message to the reply it got; cached recipient names (should come from the decrypted `recipient`); search only sees recipient labels until decrypted.

#### (6) Drafts — **exists, local, per (from, to) pair, direct mail only** (`NewMessage.tsx`)
- Key `qmail_compose_drafts_<address>` (`:215-217`) → object keyed by `activeDraftKey = "<from lower>::<to lower>"` (`:535-542`), only for name targets (`:537`). Value `StoredComposeDraft {draftId, fromName, toName, subject, value, aliasValue, showAlias, showBCC, bccNames, updatedAt}` (`:155-166`). Attachments not saved.
- Saved on a 350 ms debounce (`:821-875`); removed when empty (`:838-841`), on Discard (`:591-610` via `clearStoredDraft` `:560-573`), after a successful send (`:2066`). Restored when `activeDraftKey` changes (`:794-819`); forward/prefill reset the ref (`:660, :750`). A reply to X and a new mail to X share one key.
- No drafts list/mailbox, no indicator, no draft for thread posts (`NewThread.tsx`).

#### (7) Recent recipients / name autocomplete — **exists**
- To field `Autocomplete freeSolo` (`NewMessage.tsx:1411-1539`) over `targetOptions` (`:459-488`): "Recent" = `composePriorityRecipientNames` (`Mail.tsx:1299-1329`) = every `user`/`recipient`/`to` seen, sorted **alphabetically** (`:1326-1328`), so "Recent" is really "all known correspondents, A–Z"; "Joined" groups (`NewMessage.tsx:393-404` from `Mail.tsx:1120-1139`); "Directory" `SEARCH_NAMES {prefix:true, limit:30}` after 250 ms for ≥2 chars (`:410-457`). Option shape `ComposeTargetOption {id, label, normalizedLabel, targetType, source, groupId?}` (`:100-107`), tagged "Name · Recent/Directory" or "Group · Joined" (`:1498-1538`).
- Validation only at send: `GET_NAME_DATA` → owner (`:1174-1184`, "Recipient name cannot be found"), `GET_ACCOUNT_DATA` → publicKey (`:1186-1196`). BCC chips validate on Enter (`ChipInputComponent.tsx:22-56`). `/to/:name` prefills (`:636-654`; `Mail.tsx:1567-1590`).
- Missing: true recency/frequency, avatars in options, inline valid/invalid state, cached name→address→publicKey lookups, multiple To recipients.

#### (8) Attachment previews — **nothing opens in-app; everything is download-then-save**
- Viewer: `ShowMessageV2.tsx:228-312` (first visible, "(N more)" toggle) each via `FileElement mode="mail"`; same in `ShowMessageV2Replies.tsx:161-249`, `ShowMessageWithoutModal.tsx:102-187`. `size` is in the reference but never displayed.
- `src/components/FileElement.tsx`: click → `handlePlay` (`:97-215`); not READY → `downloadVideo` (`:204-214`); READY → second click: `GET_QDN_RESOURCE_PROPERTIES` (`:113-118`), `FETCH_QDN_RESOURCE` (`:127-133`), `DECRYPT_DATA` (`:135-138`), `Blob`, `SAVE_FILE` (`:141-159`). Labels "Click to save" (`:319`), "% loaded" (`:299-308`), toast "Download completed. Click to save file" (`:264-269`).
- Pipeline `src/wrappers/DownloadWrapper.tsx:77-194` (status every 5 s, stall detector `:119-152`, stops on READY/NOT_PUBLISHED `:107-117, 166-176`); `fetchVideoUrl` (`:55-75`) stores a URL that is never used as a `src`; `FileElement` adds its own 7.5 s re-poll (`:237-251, 270-276`). `DownloadTaskManager` commented out (`DownloadWrapper.tsx:220`) and would exclude `ATTACHMENT_PRIVATE` anyway (`DownloadTaskManager.tsx:79-85`).
- Compose: `react-dropzone` (`NewMessage.tsx:890-931`), extension required (`:1039, 1067-1070`), 40 MB (`:66`); thread posts 25 MB (`NewThread.tsx:77`).
- Missing: image/audio/video/PDF/text preview from a decrypted blob URL, a decrypted-blob cache per identifier, size/type display, mime icons, "download all", inline images in the editor, per-attachment progress that survives navigating away.

#### (9) Multi-name inbox — **exists**
- Names: `user.name` (via `GET_PRIMARY_NAME`) + `user.names` (`GET_ACCOUNT_NAMES`) — `GlobalWrapper.tsx:248-260`, `src/utils/qortalRequestFunctions.ts:3-26`; merged as `ownedNameCandidates` (`Mail.tsx:1176-1196`).
- Sidebar sub-items only for names with activity: `populateOwnedNamesWithMail` (`Mail.tsx:1682-1726`; probes `:693-752`, `:639-691`, concurrent per name). Items under Inbox/Sent (`:441-467`), primary first (`sortOwnedNamesForDisplay` `:313-335`).
- Per-name avatars (`:1728-1774`) → `renderSidebarIcon` with initial fallback (`:2978-3020`; now `Rail.tsx` `avatarUrlByName` prop).
- Combined inbox: `combinedInboxMessages` (`:1270-1298`) = Redux `mailMessages` + `combinedAliasInboxMessages` per other owned name via `fetchInboxMessagesForOwnedName` (`:795-900`), refetched every time the combined inbox becomes active (`:1914-1969`).
- Name switcher: none rendered (the old Navbar received `setActiveName`/`accountNames` and never used them; the handler now lives in `AppShellContext.tsx:19-27`). Switching is done through the sidebar instance items (`onSelectSidebarItem` `Mail.tsx:3157-3206`) and the compose From select (`NewMessage.tsx:348-358, 1353-1397`).
- Bugs/gaps: secondary name under Inbox shows an empty list (Bugs #1); polling covers only the primary name (Bugs #20); the alias-style query (`qortal_qmail_<name>_mail_`) is used for other names (`:811`) but not for the primary in `getAllMailMessages` (`useFetchMail.tsx:280-283`).
- Missing: a compact name switcher in the header/Settings, per-name unread counts, caching of per-name indexes, polling for all names.

#### (10) Archive / hide — **does not exist for received mail**
Only related mechanisms: Sent delete tombstone (`SentMail.tsx:535-653`); Blocked Names modal (formerly `Navbar.tsx:346-371`, `src/components/common/BlockedNamesModal/`; needs a new home), with `excludeblocked=true` on every search (e.g. `useFetchMail.tsx:291`). No local archive/hide/star/label/snooze. The published state doc needs a new top-level map (not per-entry fields) for `archived`/`starred` flags (Data contract §16).

#### (11) New-mail polling
- `Mail.checkNewMessagesFunc` (`Mail.tsx:1380-1398`, now `:1365-1373`): 30 s, guarded by `isCalling`; `useFetchMail.checkNewMessages` (`:97-140`): one search `limit=20` for the primary name, unshifts anything newer than `mailMessages[0]` (`:113-135`); silently does nothing if the newest known is not among the 20 (`:118-120`) or the inbox is empty (`:114`). No visibility handling, no backoff, no jitter.
- Other pollers: `SentMail` full re-index every 30 s (`:509-526`); `AliasMail` full re-fetch every 30 s (`:217-237`); `Thread` 8 s with fetch+decrypt per new post (`:177-266`); `GroupMail` members every 180 s (`:454-466`, `:420-452`); groups every 600 s (`GlobalWrapper.tsx:232-246`); `DownloadWrapper` 5 s per download (`:98-187`); `FileElement`/`OpenMail` 7.5 s (`:237-251`, `:146-157`).
- Not polled: secondary owned names, alias inboxes that aren't open, the Threads overview.
- Missing: visibility pause + backoff (ground rule 4), a single scheduler, polling for all names/aliases, an in-app "new mail" notice/badge.

#### (12) Keyboard shortcuts — **none beyond three local handlers**
Escape closed the old transient sidebar (`Mail.tsx:3466-3477` → `left-sidebar/react.tsx:225-230`, gone); Enter adds an alias (`AliasesPage.tsx:133-140`) or a BCC chip (`ChipInputComponent.tsx:95`). No Ctrl/Cmd+Enter to send, `/` for search, j/k, r, f, a, Esc-to-close-message, or shortcut help.

#### (13) Joyride tour — **exists, broken**
`react-joyride ^3.2.0` (`package.json:28`). Steps (`Mail.tsx:902-1007`): welcome + disclaimer (`.step-1`, which `Mail.tsx` now puts on the list pane `:3394`), "Changing instances" on `[data-qapp-lib-sidebar-item='inbox']`, "Composing" on `…='compose'`, "What is an alias?" on `…='aliases'` — targets nothing renders. Runs when `tourStatus-qmail` is absent (`:1009-1010`, `:1592-1597`); written `"dismissed"` on FINISHED/SKIPPED/SKIP (`:1971-1982`). At audit time mounted only on desktop inbox (`:4024-4031`); now in the shell overlays for every layout (`:3653`). Copy still says "up to 40MB per attachment" (`:957-958`).

#### (14) Aliases — **exists, fairly complete, all local**
- Storage: watched aliases, reply links, scan checkpoint per address (`Mail.tsx:171-303`); loaded/saved by effects (`:1599-1639`). Not in `qmail_state_v1`, so not synced across devices.
- `AliasesPage.tsx`: add (`:128-171`), list with "Has messages / No messages detected yet" (`:342-406`), "Open Inbox" disabled unless active (`:442-461`), link/clear reply alias (`:418-499`), remove (`:500-513`), scan controls (`:174-298`). Probe per alias (`Mail.tsx:754-777`, `:1641-1680`). Sidebar lists *all* watched aliases (`:450-459`), contradicting `AliasesPage.tsx:112`.
- `AliasMail.tsx`: fetch (`:106-198`), plain `MailMessageRow` list (`:295-308`), `LazyLoad`/"Load Older Messages" both full refetch (`:213-215, 307, 319-321`), 30 s refetch (`:217-237`). No search, grouping, selection, mark-read.
- Scan `runAliasScan` (`Mail.tsx:2078-2403`, now `:2059`): pages every `MAIL_PRIVATE` resource matching `qortal_qmail_` (`:2147-2167`), keeps alias-format identifiers after the checkpoint (`:2172-2209`), `FETCH_QDN_RESOURCE` + `DECRYPT_DATA` each (`:2284-2295`) to read `recipient`/`to` (`:2300-2319`); cancellable, checkpointed (`:2337-2340`). Very expensive on QDN.
- Alias compose: "Alias Compose" item when an alias inbox is selected (`:433-439`) forcing `requireSenderAlias` (`:3125-3149`; `NewMessage.tsx:552-558`, `:1055-1066`); replies inherit the linked reply alias (`Mail.tsx:1456-1470`); alias sends skip BCC (`NewMessage.tsx:1250`) and show the confirm (`:342-346`, `:1082-1085`).
- Missing: alias inbox parity with the main inbox, unread counts, cross-device sync of the alias list, a cheaper scan (date window / own sent identifiers).

#### (15) Group threads — **exists**
- Groups: `/groups/member/<address>` → `privateGroups` (`GlobalWrapper.tsx:88-112`) → `memberGroupOptions` (`Mail.tsx:1120-1139`), filtered by `hasGroupThreadActivity` (`:527-549`, one search per group, repeated every 10 min), group avatars (`:551-624`, `:1873-1912`). Sidebar "Q-Mail Threads" collapsible (`:469-486`, `:3208-3237`).
- Overview `ThreadsMailbox.tsx`: one search `limit 60` per group (`:61-121`), title from `metadata.description` else a `FETCH_QDN_RESOURCE` per thread (`:37-59`), merged and sorted (`:146-192`), cards (`:248-356`). No paging beyond 60 per group.
- Per group `GroupMail.tsx`: "Recently active" (`:239-283`, `:285-348`); "Newest/Oldest" paged 20 with `LazyLoad` (`:133-238`, `:719-722`); members every 180 s (`:420-466`); "viewed" lightening from `qmail_threads_viewedtimestamp_<name>` (`:474-482`, `:608-609`). New thread → `handleRequestComposeThread` (`Mail.tsx:1503-1546`) → `NewMessage` group target (`NewMessage.tsx:1096-1171`, `fetchGroupPublicKeys` `:990-1031`).
- Thread `Thread.tsx`: posts paged 20 (`:80-124`), each fetched+decrypted into `hashMapMailMessages` (`:54-78`), rendered by `ShowMessageWithoutModal.tsx`, skeleton while decrypting (`:323-346`), 8 s poll (`:177-266`), "Post Message" opens `NewThread` via event (`:306-312`; `NewThread.tsx:182-194`), 25 MB attachments (`NewThread.tsx:77, 376-396`). The `openNewThreadModal` event has no emitter in reachable code.
- Missing: unread per thread/group, reply-to-post quoting, thread search, overview paging, member list UI, last-post preview, member/public-key caching.

#### CHANGELOG.md cross-reference (`apps/Q-Mail+/CHANGELOG.md`)
- 3.2.1 (`:3-5`): `/to/:name` opens composer — `Mail.tsx:1567-1590`.
- 3.2.0 (`:7-15`): loading banner (`Mail.tsx:3519-3651`), "Always fetch" checkbox in prompt (`:1147-1170`, broken, Bugs #2) and menu (`Navbar.tsx:317-345`, deleted), auto mark-read on open (`:1408-1448`), Select all (`GroupedMailboxList.tsx:264-318`), background state fetch (`:2716-2724`).
- 3.1.1 (`:17-24`): grouped selection, Redux-backed mark read/unread, Publish/Load state with `!` badge — all cited in (2).
- 3.1.0 (`:26-32`): mobile tweaks, auth-on-startup default (`useQMailAppShell.ts:143-147`), collapsed Threads section, Alias Compose, reply-alias linking, reply preview modes, per-recipient drafts, BCC while replying.
- 3.0.0 (`:34-42`): app shell + sidebar (`src/qapp-lib/`), grouped lists, full-page compose, "improved Reply/Forward behavior that starts replies with quoted context" (the quote is computed but not sent — see (3)), full-text mailbox search, alias tools + resumable scan, Sent delete, ratings (local only, `useQMailAppShell.ts:141-144`).
- 2.2.0 multi-name; 2.1.0 mobile; 2.0.x threads; 1.2.0 BCC; 1.1.0 multi-publish (`MultiplePublish.tsx`).

#### Feature slices: genuinely new vs. improve what exists

**Genuinely new**

| Slice | Files it would touch |
|---|---|
| **N1. Unread counts & badges** (rail per Inbox/name/alias/group, bottom-nav badge, document title; a local persistent read store keyed by id instead of `threadV2`) | `Mail.tsx` (buildSidebarItems, read helpers 2405-2627 now 2386-2608, localMailStateById), `GroupedMailboxList.tsx`, `MailMessageRow.tsx`, `AliasMail.tsx`, `src/layout/Rail.tsx` + `BottomNav.tsx` (badge rendering), new `utils/readState.ts`, `state/features/mailSlice.ts` |
| **N2. Archive / hide / star** (local + a new top-level map in `qmail_state_v1`) | `Mail.tsx` (state doc build/merge 337-414, 2629-2819; view filters 1270-1343), `GroupedMailboxList.tsx` (bulk bar), `MailMessageRow.tsx`, new "Archived" rail item in `Mail.tsx`/`Rail.tsx` |
| **N3. Reply-all + real quoting + Re:/Fwd: + forward attachments** (additive `to`/`cc` fields; strip embedded history) | `NewMessage.tsx` (724-792, 1201-1229, editor init), `ShowMessageV2.tsx` (57-77), `Mail.tsx` (1456-1501), `utils/helpers.ts` |
| **N4. Conversation view across inbox+sent** (group by subject/participants, additive `threadId`/`inReplyTo`) | `GroupedMailboxList.tsx`, `Mail.tsx` (combinedInboxMessages, openMessage), `SentMail.tsx`, `ShowMessageV2.tsx`, `ShowMessageV2Replies.tsx`, `NewMessage.tsx` (payload) |
| **N5. Attachment previews** (decrypted-blob cache, image/audio/video/PDF/text viewer, size/type, download-all) | `components/FileElement.tsx`, `wrappers/DownloadWrapper.tsx`, `ShowMessageV2.tsx`, `ShowMessageV2Replies.tsx`, `ShowMessageWithoutModal.tsx`, `MailThreadWithoutCalling.tsx`, new `components/AttachmentPreview.tsx`, `state/features/globalSlice.ts` (downloads) |
| **N6. Keyboard shortcuts + help overlay** | `Mail.tsx` (keydown), `NewMessage.tsx` (send), `MailboxSearchBar.tsx`, `ShowMessageV2.tsx`, new `hooks/useKeyboardShortcuts.ts` |
| **N7. Drafts mailbox** (list, open, delete; attachment metadata; thread-post drafts) | `NewMessage.tsx` (155-285, 794-875), `Mail.tsx` (rail item + view), new `pages/Mail/DraftsMailbox.tsx`, `NewThread.tsx` |
| **N8. Global search** (one box over inbox+sent+aliases+threads, persistent decrypted-text index, filters, highlighting, subject-first then opt-in bodies) | `useMailboxSearch.ts`, `MailboxSearchBar.tsx`, `Mail.tsx` (1344-1357, search bar mounts), `SentMail.tsx`, `AliasMail.tsx`, `utils/fetchMail.ts` (persist decrypted text), `mailSlice.ts` |
| **N9. Alias list sync + cheaper scan** (aliases/reply links in `qmail_state_v1`; scan limited by window) | `Mail.tsx` (171-303, 2078-2403, 2629-2819), `AliasesPage.tsx` |
| **N10. In-app new-mail notice + unified poller** (visibility pause, backoff, all names/aliases, one scheduler, in-flight merge + session cache for searches) | `Mail.tsx` (1380-1398), `hooks/useFetchMail.tsx` (97-140), `SentMail.tsx` (509-526), `AliasMail.tsx` (217-237), `Thread.tsx` (177-266), `GroupMail.tsx` (454-466), `GlobalWrapper.tsx` (232-246), new `hooks/usePolling.ts`, new `utils/qdnSearchCache.ts` |

**Improve what exists**

| Slice | Files it would touch |
|---|---|
| **I1. Fix secondary-name Inbox instance (Bugs #1) + cache per-name indexes (Bugs #9)** | `Mail.tsx` (1330-1357, 1914-1969, 795-900) |
| **I2. Name switcher UI** (Settings/rail; wire `setActiveName` from `AppShellContext`) | `src/layout/Rail.tsx`, `SettingsPage.tsx`, `app-shell/AppShellContext.tsx`, `GlobalWrapper.tsx`, `Mail.tsx` |
| **I3. Recipient autocomplete: real recency, avatars, inline validation, cached name→key lookups** | `NewMessage.tsx` (364-527, 1174-1196, 1411-1539), `Mail.tsx` (1299-1329), `ChipInputComponent.tsx`, new `utils/nameCache.ts` (also serves `fetchMail.ts`, `SentMail.tsx`, `GroupMail.tsx`) |
| **I4. Sent view: cache recipient names from decrypted `recipient`, one SEARCH_NAMES per group, link to replies** | `SentMail.tsx`, `MailMessageRow.tsx` (108-149), `GroupedMailboxList.tsx`, `mailIdentifier.ts` |
| **I5. Alias inbox parity** (reuse `GroupedMailboxList` + search + mark-read; real paging; delete dead `NewMessage`/`ShowMessage` mounts) | `AliasMail.tsx`, `Mail.tsx` (alias mounts; read helpers) |
| **I6. Read-state doc: persist local reads, apply to alias/thread views, fix the "always apply" checkbox (Bugs #2), confirm before publish (UX #4), move the preference to Settings › Sync** | `Mail.tsx` (1147-1170, 2405-2819, 3273-3354), `utils/qdnStatePreference.ts`, `SettingsPage.tsx` |
| **I7. Loading / empty / error states on every list** (`ListSkeleton`, `EmptyState`, `ErrorState`, `FetchingFromPeers`; fix Bugs #3, #4, #6) | `GroupedMailboxList.tsx`, `SentMail.tsx`, `AliasMail.tsx`, `ThreadsMailbox.tsx`, `GroupMail.tsx`, `Thread.tsx`, `OpenMail.tsx`, `FileElement.tsx`, `DownloadWrapper.tsx`, `utils/fetchMail.ts`, `src/layout/states.tsx` |
| **I8. Threads: unread per thread, member/key cache, overview paging, reply-to-post, fix the slice bug (Bugs #13), thread-before-message ordering (Bugs #21)** | `ThreadsMailbox.tsx`, `GroupMail.tsx`, `Thread.tsx`, `NewThread.tsx`, `ShowMessageWithoutModal.tsx`, `NewMessage.tsx` (990-1031, 1120-1128) |
| **I9. Avatar + attachment fetch efficiency** (one `GET_QDN_RESOURCE_URL` per name per session with miss cache, lazy via IntersectionObserver; drop the unused URL fetch; single status poller) | `DownloadWrapper.tsx`, `FileElement.tsx`, `OpenMail.tsx`, `useFetchMail.tsx` (244-259, 315-319), `AliasMail.tsx` (73-88, 205-209), `GroupMail.tsx` (116-131, 341), `Mail.tsx` (1728-1774), `MailTable.tsx` (AvatarWrapper), `globalSlice.ts` |
| **I10. Component-level mobile fixes** (real buttons UX #3, tap targets #10, sideways scroll #11, fixed widths #12, relative dates #13, 14 px floor #14, spacers #15, 950 px breakpoints Bugs #24, responsive dialogs #9, Send in the pane header #6, row/checkbox propagation #5, copy #27, aria labels #32-34) | `NewMessage.tsx`, `NewThread.tsx`, `ShowMessageV2.tsx`, `ShowMessageV2Replies.tsx`, `MailMessageRow.tsx`, `GroupedMailboxList.tsx`, `AliasesPage.tsx`, `ThreadsMailbox.tsx`, `GroupMail.tsx`, `Thread.tsx`, `Mail-styles.ts`, `MailboxSearchBar.tsx`, `TextEditor.tsx`, `DisplayHtml.tsx`, `texteditor.css`, `ConfirmationModal.tsx`, `MultiplePublish.tsx`, `BlockedNamesModal*`, `ReusableModal.tsx`, `OpenMail.tsx`, `utils/time.ts` |
| **I11. Dead-code and bundle removal** (`ShowMessage.tsx`, `MailThread.tsx`, `SimpleTable`, `GroupTabs`/`Tabs`, `qapp-lib/left-sidebar`, `AppMenu`, `ChangelogPage`, `DownloadTaskManager`, `blogSlice`/localforage, `moment`, `mime`, `react-toastify`→Snackbar (fixes Bugs #22), Joyride (UX #25/Bugs #10) or a fixed tour, Roboto ttf + 15 unused fonts, `quotedReplyHtml`/`escapeHtml`, `audios` state; lazy `NewMessage`/`NewThread`/`ShowMessageV2`/rare screens) | `Mail.tsx`, `AliasMail.tsx`, `GroupMail.tsx`, `MailTable.tsx`, `GlobalWrapper.tsx`, `DownloadWrapper.tsx`, `NewMessage.tsx`, `store.ts`, `mailSlice.ts`, `globalSlice.ts`, `ConsentModal.tsx`, `Notification.tsx`, `App.tsx`, `utils/time.ts`, `utils/helpers.ts`, `styles/lexendIllinoisTypography.ts`, `main.tsx`, `package.json`, `src/styles/fonts/` |

#### Proposed grouping of slices into agents (slices that touch the same files go together)

Ordering constraint: **Agent A must land first** (every other agent reads from the search cache, the read store and the state-doc shape), then B–E can run in parallel on disjoint files; F runs last because it deletes what the others stop using.

| Agent | Slices | Why together | Files it owns (nobody else edits these while it runs) |
|---|---|---|---|
| **A. Mail data core** (read state, state doc, polling, search cache) | N1 (store half), N2 (doc half), N9, N10, I1, I6, Bugs #1 #2 #5 #9 #14 #20 | All edit `Mail.tsx` lines 171-414 (storage helpers, state-doc types), 1270-1398 (lists + poll), 2405-2819 (read helpers, state publish/load) and 3273-3354 (apply on load); the unified poller and the QDN search cache are the substrate every other list needs. | `src/pages/Mail/Mail.tsx` (data/effects half), `src/hooks/useFetchMail.tsx`, `src/state/features/mailSlice.ts`, `src/utils/qdnStatePreference.ts`, `src/wrappers/GlobalWrapper.tsx` (groups poll), new `src/hooks/usePolling.ts`, new `src/utils/qdnSearchCache.ts`, new `src/utils/readState.ts`, `src/pages/Settings/SettingsPage.tsx` (Sync section) |
| **B. Lists** (inbox, sent, alias inbox, rail badges) | N1 (UI half), N2 (UI half), N4 (list half), N8, I4, I5, I7 (list screens), I10 (row/list items), Bugs #8 #15 #18 #19, UX #2 #5 #13 #26 | All edit `GroupedMailboxList.tsx` + `MailMessageRow.tsx` + `SentMail.tsx` + `AliasMail.tsx` + `useMailboxSearch.ts`; unread badges land in `Rail.tsx`/`BottomNav.tsx`. | `src/pages/Mail/GroupedMailboxList.tsx`, `MailMessageRow.tsx`, `SentMail.tsx`, `AliasMail.tsx`, `AliasesPage.tsx`, `useMailboxSearch.ts`, `MailboxSearchBar.tsx`, `mailIdentifier.ts`, `MailTable.tsx`, `src/layout/Rail.tsx`, `src/layout/BottomNav.tsx`, `src/layout/states.tsx`, `src/utils/time.ts`, the list-pane section of `Mail.tsx` (now `:3360-3400`, coordinate with A) |
| **C. Composer** | N3, N7, I3, I10 (composer items: real Send button, Send in pane header, keyboard-safe height, toolbar), Bugs #12 #16 #21 #22 (key spread), UX #3 #6 #22 #23 | All share `NewMessage.tsx:724-875` (reply/forward/drafts), `:1174-1229` (resolve + payload), `:1411-1539` (autocomplete) and the footer; `NewThread.tsx` mirrors it. | `src/pages/Mail/NewMessage.tsx`, `NewThread.tsx`, `src/components/common/ChipInputComponent/*`, `TextEditor/*`, `MultiplePublish/*`, `src/utils/helpers.ts`, new `src/utils/nameCache.ts`, new `src/pages/Mail/DraftsMailbox.tsx`, `src/layout/PaneHeader.tsx` (actions slot) |
| **D. Reader + attachments** | N3 (forward half: `ShowMessageV2.tsx:57-77`), N4 (viewer half), N5, I7 (OpenMail/FileElement/DownloadWrapper), I9, Bugs #3 #4 #6 #7 #17, UX #11(a) #27 (download copy) | All share `ShowMessageV2*.tsx`, `FileElement.tsx`, `DownloadWrapper.tsx`, `OpenMail.tsx`, `fetchMail.ts`; the avatar cache and the blob cache live in the same slice of `globalSlice.ts`. | `src/pages/Mail/ShowMessageV2.tsx`, `ShowMessageV2Replies.tsx`, `ShowMessageWithoutModal.tsx`, `OpenMail.tsx`, `src/components/FileElement.tsx`, `src/wrappers/DownloadWrapper.tsx`, `src/utils/fetchMail.ts`, `src/utils/checkStructure.ts`, `src/components/common/TextEditor/DisplayHtml.tsx`, `texteditor.css`, `src/state/features/globalSlice.ts`, new `src/components/AttachmentPreview.tsx`, new `src/utils/avatarCache.ts` |
| **E. Threads** | I8, I7 (thread screens), I10 (thread items), Bugs #13 #15 #21, UX #18, group member/key cache | `ThreadsMailbox.tsx`, `GroupMail.tsx`, `Thread.tsx`, `NewThread.tsx` (post path only, coordinate with C), `ShowMessageWithoutModal.tsx` (coordinate with D). | `src/pages/Mail/ThreadsMailbox.tsx`, `GroupMail.tsx`, `Thread.tsx`, new `src/utils/groupMembersCache.ts`, `src/utils/apiCalls.ts` |
| **F. Shell polish, shortcuts and bundle** | N6, I2, I10 (dialogs, breakpoints, a11y globals), I11, Bugs #10 #24, UX #4 #7-#9 #14 #16 #25 #28-#31 #34-#36, Bundle plan 2-10 | Cross-cutting edits to imports in `Mail.tsx`, `App.tsx`, `main.tsx`, `package.json`, fonts, theme; lazy boundaries wrap components the other agents finished. Runs last. | `src/App.tsx`, `src/main.tsx`, `src/layout/*` (MailShell, useLayoutMode, ComposeFab), `src/hub-theme/*` (via `shared/` + sync), `src/index.css`, `src/styles/*`, `src/components/common/{Notification,ConfirmationModal,PageLoader,LoaderBar,BlockedNamesModal,GlobalContextMenu}/*`, `src/components/modals/*`, `src/qapp-lib/*` (delete), `src/pages/Mail/ChangelogPage.tsx` (delete), `ShowMessage.tsx`/`MailThread.tsx`/`MailThreadWithoutCalling.tsx` (delete), `Mail-styles.ts` (breakpoints), `package.json`, `vite.config.ts`, new `src/hooks/useKeyboardShortcuts.ts`, Joyride steps in `Mail.tsx` (`:888-993` now) |

Shared-file protocol: `Mail.tsx` is touched by A (data/effects), B (list pane), C (compose handlers `:1441-1546` and `:3235-3260`), D (`openMessage` `:1385-1424`, reading pane `:3405-3420`), E (threads pane `:3503`), F (imports, overlays `:3648-3660`). Each agent edits only its region, in its own branch `q-mail-plus/<agent>`, and rebases on A's merge; F waits for all of B–E.

### Upstream branches

Monorepo: `/home/simon-james/Desktop/Q-Apps+-QMail`, app: `apps/Q-Mail+`. Paths prefixed `up-q-mail/<branch>:` are upstream refs.

#### Branch topology (what is already fetched)

| ref | sha | date of tip | relation |
|---|---|---|---|
| `up-q-mail/main` (= `up-q-mail/HEAD`) | `ddf3aa9` | 2026-05-28 | imported by `6cf4c17 Q-Mail+: import Qortal/q-mail@main (ddf3aa9)` |
| `up-q-mail/v3.1.0` | `fa2913b` | 2026-03-24 | strict ancestor of `main` (`git merge-base --is-ancestor` = yes); nothing unique |
| `up-q-mail/feature/version-2` | `8255fcf` | 2025-09-11 | 22 commits not in `main`; merge-base with `main` is `3e71890` (the very first "Initial q-mail commit") |
| `up-q-mail/version1` | `8a6f803` | 2024-01-13 | older cut of the same line as `feature/version-2` (merge-base `ddedcc5`); its only unique commit is "remove files" (deletes Q-Blog leftovers) |

Key structural fact: `main` did **not** branch from `feature/version-2` in git terms. crowetic's `fa2913b` ("major re-write ... taken from his [GF's] v3.0.0") lands directly on top of the initial commit `3e71890`, so `git log up-q-mail/main..up-q-mail/feature/version-2` lists **every** commit of the 2023-2025 line as "missing" from `main`, even though their content was carried over. Comparing trees: `comm` of `src/` file lists shows **zero files that exist on `feature/version-2` but not on `main`**; `main` only adds files (AliasesPage, ChangelogPage, GroupedMailboxList, MailboxSearchBar, ThreadsMailbox, mailIdentifier.ts, useMailboxSearch.ts, qapp-lib/*, app-shell/*, qdnStatePreference.ts, qortalRequestFunctions.ts, plus the re-added Q-Blog files that `tsconfig.json` excludes).

`git diff --stat up-q-mail/feature/version-2 up-q-mail/main -- src package.json vite.config.ts`: 94 files, +20,338 / −2,726. The 2,726 removed lines are the old tab/instance-popover UI in `Mail.tsx`, the old modal composer in `NewMessage.tsx`, the old Navbar, and the old `useFetchMail` blog helpers, all replaced by the v3 page/sidebar design.

#### (a) Does the imported `main` already have multi-name support? Yes, confirmed in code
The 2.2.0 commit `8255fcf` introduced `NameRecord` + `User.names` in `authSlice.ts`, `getAccountNames`/`getPrimaryAccountName`, a `switchActiveName` callback and `accountNames`/`setActiveName` props into `GlobalWrapper.tsx`, and a name-dropdown in `Navbar.tsx` (`up-q-mail/feature/version-2:src/components/layout/Navbar/Navbar.tsx:141-153` renders `accountNames.filter(n => n.name).map(... onClick setActiveName(n.name) ...)` with a "✔︎" on the active one).

In the imported app:
- `src/state/features/authSlice.ts:3-13`: `NameRecord {name, owner}` and `User.names?: NameRecord[]`.
- `src/utils/qortalRequestFunctions.ts:3-14`: `getAccountNames(address)` calls `GET_ACCOUNT_NAMES`, falling back to `[{name:'', owner:address}]`; `:16-26` `getPrimaryAccountName` uses `GET_PRIMARY_NAME`.
- `src/wrappers/GlobalWrapper.tsx:248-260` `askForAccountInformation` does `GET_USER_ACCOUNT`, then `getAccountNames` + `getPrimaryAccountName`, and dispatches `addUser({...account, name: primary, names})`.
- `src/wrappers/GlobalWrapper.tsx:308-316` passed `accountNames={user?.names || []}` and a `setActiveName` that clears messages, re-dispatches the user with the new `name` and reloads local subjects (now in `AppShellContext.tsx:19-27`).
- `src/pages/Mail/Mail.tsx:1176-1196` `ownedNameCandidates` = dedupe of `user.name` + every `user.names[].name`.
- `src/pages/Mail/Mail.tsx:1682-1726` probes each owned name and sets `ownedInboxNames` / `ownedSentNames`.
- `src/pages/Mail/Mail.tsx:2882-2897` `buildSidebarItems({inboxNames, sentNames, ...})` puts one Inbox / Sent sub-entry per owned name (the v3 replacement for the dropdown switcher).
- `src/pages/Mail/Mail.tsx:3715` and `:4174` pass `ownedNames={ownedNameCandidates}` into `NewMessage`; `src/pages/Mail/NewMessage.tsx:328-329` initialises `fromName` from `user.name || ownedNames[0]`, and `:348-358` builds `fromOptions` (primary first, then alphabetical) so the composer has a From-name picker.

**Gap/dead code:** the 2.2.0 Navbar dropdown was *not* carried into v3. `src/components/layout/Navbar/Navbar.tsx:47-48` declared `accountNames` and `setActiveName` and `:59-60` destructured them, but never used them (same in `up-q-mail/main:src/components/layout/Navbar/Navbar.tsx:47-60`); that file is now deleted. Multi-name in v3 works by showing all owned names at once (rail subviews + From picker) rather than by switching the active name; a Settings/identity switcher can wire the existing `setActiveName` back in without new data code (slice I2). `docs/apps/Q-Mail+.md:23,34,45,92` still says the multi-name check is "not yet verified in code"; this audit resolves it.

#### (b) What `feature/version-2` has that `main` lacks, per commit

| commit | what it does | verdict |
|---|---|---|
| `3dbb791` fix attachment download, more info when downloading, new multi-publish | adds `MultiplePublish.tsx`, `MailDownloadWrapper.tsx`, `DownloadTaskManager` | **already in main**: `src/components/common/MultiplePublish/MultiplePublish.tsx` (used by `NewMessage.tsx`, `NewThread.tsx`), `src/wrappers/MailDownloadWrapper.tsx` (excluded), `DownloadTaskManager.tsx`. Nuance: fv2 (`up-q-mail/feature/version-2:.../MultiplePublish.tsx:38-40`) used `qortalRequestWithTimeout(pub, resources.length * 30000)`; main's version (`MultiplePublish.tsx:44-46`) calls plain `qortalRequest(pub)` and only string-matches "timed out"/"user declined" (`:65-73`). Optional micro-port: per-resource timeout scaling. |
| `244c181` attachment limit 40 MB | | **in main**: `NewMessage.tsx:66`, error text `:926`. |
| `2afdb39` right-click copy text | `GlobalContextMenu.tsx` + mount in `main.tsx` | **in main, byte-identical**; mounted at `src/main.tsx:39` (now `:51`). |
| `ddedcc5` change editor (react-quill), save replies in message, BCC | | **in main**: `TextEditor.tsx`/`DisplayHtml.tsx`/`quillHtml.ts` (locally swapped to `react-quill-new` in `9e9aa1c`); BCC at `NewMessage.tsx:164,254,334,812-814`; replies as `generalData.threadV2` (`ShowMessageV2.tsx:328-332`). |
| `e6a16d7` remove general loader for regular mail | | obsolete: v3 replaced the loading model (3.2.0 banner, `LoaderBar` in `GlobalWrapper.tsx:307`). |
| `8cf5772` home page + bundled Roboto fonts | | obsolete/superseded: v3 uses `lexendIllinoisTypography.ts`; `App.tsx` has only mail routes. |
| `95ebcf1`, `a52fcd3` new-message modal rework | | superseded: v3 compose is a full page (`NewMessage.tsx`, 2,078 lines vs fv2's modal). |
| `d139758`, `a39352a` show-message v2 | `ShowMessageV2.tsx` | **in main**: `ShowMessageV2.tsx` + `ShowMessageV2Replies.tsx`. |
| `d5a5d45` threads, `c66a195` fixes | `Thread.tsx`, `NewThread.tsx`, `GroupMail.tsx` | **in main**, extended by `ThreadsMailbox.tsx`. |
| `5c2671f` fix tour | react-joyride | **in main**: `Mail.tsx:12,1009,1971-1976,4024-4027`. |
| `ff1a821` add reply subject | `NewMessage.tsx`, `ShowMessageV2.tsx`, plus a 250 ms remount hack in `ReadOnlySlate.tsx` | **in main** for the subject part: `NewMessage.tsx:741-742`. The `ReadOnlySlate` `setTimeout(250)` hack was dropped in main's rewrite (local `:91-93` is a pure renderer): obsolete, do not port. |
| `3b81fd9` fix issues | misc | absorbed by rewrite. |
| `816b4f5` fix open old msg error | guard `threadV2` spread | **in main**: `ShowMessageV2.tsx:328-329`. |
| `819b977` fix order of replies | ascending `createdAt` sort | **in main**: `ShowMessageV2.tsx:332`. |
| `cd89548` add missing status (MISSING_DATA) | `OpenMail.tsx`, `DownloadWrapper.tsx` | **in main**: `OpenMail.tsx:270`, `DownloadWrapper.tsx:177`. |
| `7c1c7de` avatar images in thread posts | `GroupMail.tsx` `getAvatar` | **in main**: `GroupMail.tsx:116-125,341`. |
| `96b165d` mobile friendly | media-query layouts | superseded by 3.1.0 "made mobile fully supported" and now by `d5f6dfd`. |
| `8255fcf` multi-name support | see (a) | **in main** except the Navbar dropdown. |

Net: **nothing on `feature/version-2` needs porting**. The only two items with residual value are (1) re-wiring the name switcher (slice I2) and (2) optionally restoring a publish timeout that scales with resource count in `MultiplePublish.tsx`.

#### (c) `scripts/sync-upstream.sh --check`
Run from the monorepo root (`scripts/sync-upstream.sh:22-30` fetches each remote/branch and counts `git rev-list --count <remote>/<branch> ^HEAD`). Output: `Q-Mail+  0 new upstream commit(s)  (Qortal/q-mail main)`, and 0 for every other app. `up-q-mail/main` is still `ddf3aa9`, so the import is current. The script does `git fetch` for each remote (`:25`), so it is not strictly offline.

Local branch commits since the import (`git log 6cf4c17..HEAD -- "apps/Q-Mail+"`): `6a6ad80` TS 5.9/Vite 8, `53facde` React 18.3.1, `b0fa012` RTK 2 / react-redux 9.3, `69df0ad` react-router 6.30, `9e9aa1c` react-quill-new + test harness, `f5ae785` MUI 5.18, `45640d9` React 19.3, `f2f86c0` React-19-safe libs, `6c95304`/`43d9236` MUI 9.4, `c26c54c` test cleanup, then the pass commits `507641e` (theme kit + Settings), `224fb37` (drop audio player), `d5f6dfd` (layout shell). The app is upstream `3.2.1` (`package.json:4`) plus the stack upgrade plus the first three redesign commits; no upstream-feature commits were pulled.

#### (d) Other upstream branches with mail features worth porting
- `up-q-mail/v3.1.0` (`fa2913b`): ancestor of `main`, nothing unique.
- `up-q-mail/version1` (`8a6f803`, 2024-01-13): a 1.x cut of the same line as `feature/version-2`; its single unique commit "remove files" deletes Q-Blog leftovers (`AudioElement.tsx`, `VideoPlayer.tsx`, `BlogIndividualPost.tsx`, `CreatePost*.tsx`) that `main` re-added and that `tsconfig.json` now excludes. Only reusable idea: precedent for deleting those 55 excluded files rather than excluding them (slice I11). No mail features.
- No q-mail tags are fetched (`git tag -l` is empty; `git for-each-ref | grep -i mail` shows only the four branches above), and no other fetched Qortal remote carries q-mail code.

Side findings noticed while verifying: `NewMessage.tsx:996` and `GroupMail.tsx:423` still fetch `/groups/members/<id>?limit=0` (ground rule 4 violation, inherited from upstream; a commented-out copy sits at `GlobalWrapper.tsx:129`).

### Pre-audit notes (2026-09-29)

- **Baseline (main):** `npm ci && npm run build` passes; tsc 0 errors; dist 2.2 MB; biggest chunk `index-*.js` 1,688.58 kB (gzip 511 kB). Vite 5.0 built in 16 s.
- **Reachability:** only 129 of 163 files in `src/` are reachable from `main.tsx`. The other 55 are Q-Blog leftovers (Blog* pages, CreatePost/EditPost, BlogEditor, Comments, Tipping, video/audio publish modals, Chat/ChatInput/ShowChatMessage, FlexLayout, MailDownloadWrapper, webworkers). They were never bundled. They are now listed in `tsconfig.json` → `exclude` and their 15 unused dependencies are gone from `package.json` (flexlayout-react, react-grid-layout, react-dnd, tiptap ×4, axios, compressorjs, react-virtuoso, react-masonry-css, react-resize-detector, slate, slate-react, slate-history).
- **React 19 blockers found** (node_modules scan for `findDOMNode`/legacy context): react-quill 2 (editor), react-joyride 2.5 (first-run tour), slate-react 0.91 (renders old `textContent` Slate mail). Peer ranges also blocked `npm install` for react-copy-to-clipboard 5.1.0 and react-intersection-observer 9. All replaced or bumped (see Done). **Found later (2026-10-01):** `philliplm-react-modern-audio-player` bundles React 18's jsx-runtime and reads `__SECRET_INTERNALS…ReactCurrentOwner`, which React 19 removed; the app built but showed a blank page. Removed (Q-Mail never rendered it).
- **Editor/HTML:** mail bodies are stored as HTML in `textContentV2` and rendered through DOMPurify as plain HTML (`DisplayHtml`), not through Quill. Quill 2 writes bullet lists as `<ol><li data-list="bullet">` and code blocks as nested `<div>`s, which the original app would show as numbered lists / paragraphs. `toQuill1Html()` converts at the two publish points; tests in `quillHtml.test.ts`.

## Plan

Overnight pass of 2026-09-30 → 10-01 (the qplus-app skill in overnight mode, run with parallel agents). Status is tracked in Done and Follow-ups.

**Phase 1, foundation (done, one agent at a time):** platform upgrade → test harness → theme kit with the four themes (Hub 2.0 = "Q-Mail Classic") → Settings page → PR #15 as the checkpoint → the audit above → the Hub 3.0 layout shell in `src/layout/` (rail · list · reading pane on desktop; list + reading pane at 600–899 px; one pane at a time, bottom nav with five items and a floating Compose below 600 px, which also covers narrow Hub panes). Two shared utilities every feature builds on: `src/utils/qdnSearch.ts` (one door for `/arbitrary/resources/search`: identical in-flight searches share a promise, results are cached for the session with a TTL, `invalidateSearches()` after a publish) and `src/hooks/usePolling.ts` (visibility-aware polling with backoff and jitter; replaces every `setInterval`).

**Phase 2, features in parallel.** Each slice runs in its own git worktree on `q-mail-plus/feat-<slug>`, branched from the current tip, and is merged into `q-mail-plus/pass-1` one at a time with build, tests and lint after every merge. The grouping follows the audit's "Proposed grouping of slices into agents" (slices that touch the same files go together; each agent owns its files and edits only its region of `Mail.tsx`):

| Round | Agent | Slices |
|---|---|---|
| 1 | **A data core** | persistent local read state keyed by message id (independent of `threadV2`), unread counts per inbox/name/alias/group, archive/hide (local, plus a new top-level map in `qmail_state_v1`, additive), polling for every owned name with `usePolling`, all `Mail.tsx`/`useFetchMail` searches through `qdnSearch`, Bugs #1 #2 #9 #14 #20, Settings → Sync |
| 1 | **C composer** | reply with a real quote and `Re:`, reply all (additive `to`/`cc` fields), forward with `Fwd:` and the attachments, embedded reply history stripped of its own history, a Drafts mailbox, recent recipients by real recency with avatars and inline "name exists" validation (`utils/nameCache.ts`), Ctrl/Cmd+Enter to send, composer phone polish |
| 1 | **D reader + attachments** | every attachment kind opens in the app (images, text, audio, video, PDF through pdf.js with the worker on the main thread, as Torq does; pdf.js loads only when a PDF is opened), a decrypted-blob cache, size/type, Download all, "Fetching from peers…" states in OpenMail/FileElement, an avatar cache (one `GET_QDN_RESOURCE_URL` per name per session, lazy), reader layout driven by the pane, not by 950 px |
| 1 | **E threads** | group threads in the shell (threads list · thread pane), unread per thread, member and public-key cache with paged `/groups/members` (no `limit=0`), overview paging, polite polling, loading/empty/error states, Bugs #13 #21 |
| 2 | **B lists** | unread badges in the rail, bottom nav and `document.title`; search across inbox + sent + aliases with highlighting; archive row/bulk actions; alias inbox parity with the inbox (grouping, search, mark read); sent view recipient caching; list skeletons/empty/error states; 44 px rows with real buttons, relative dates |
| 2 | **F shell, shortcuts, bundle** | desktop keyboard shortcuts with a help overlay, dialogs full-screen or bottom sheets on phones, accessibility pass, dead code removal (`ShowMessage`, `MailThread*`, `SimpleTable`, `qapp-lib/left-sidebar`, `AppMenu`, `DownloadTaskManager`, `blogSlice`/localforage, moment, react-toastify, unused fonts), code-splitting (composer + Quill, Settings, previews), the first-run tour fixed |

**Phase 3, verify:** a review workflow over the whole diff (correctness, data compatibility, efficiency, mobile/UX, accessibility) with adversarial verification of each finding, then one fix commit per confirmed finding; a Hub Dev Mode test through the debug port at 1440, 700, 390×844, 360×740 and 844×390, in all four themes and Hub light/dark, compared with the original Q-Mail; then the brief's Done and Follow-ups, version 1.0.0 + changelog, `scripts/build-zip.sh Q-Mail+`, and the PR description.

## Done

Branch `q-mail-plus/pass-1`, PR [#15](https://github.com/SJQortal/Q-Apps-Plus/pull/15). Every commit builds and passes the tests.

### Platform upgrade (2026-09-29/30)

| Commit | Build | Main chunk |
|---|---|---|
| Toolchain: TS 5.9, Vite 8, plugin-react 6 | ✅ | 1,676 kB |
| React 18.3.1 | ✅ | 1,676 kB |
| RTK 2.13 + react-redux 9.3 | ✅ | 1,681 kB |
| react-router-dom 6.30 + v7 flags | ✅ | 1,685 kB |
| react-quill → react-quill-new 3.8 + `toQuill1Html` + vitest harness (`npm test`, 7 tests) | ✅ | 1,631 kB |
| MUI 5.18 | ✅ | 1,646 kB |
| React 19.3 + types 19 + Emotion 11.14 (tsc 0 errors) | ✅ | 1,726 kB |
| joyride 3.2, ReadOnlySlate without slate-react (2 tests), unused deps removed, dead files excluded | ✅ | 1,544 kB (gzip 473 kB) |
| MUI 9.4 (codemods + 7 manual fixes; every MenuItem inside Menu/Select; icon check clean) | ✅ | 1,576 kB (gzip 482 kB) |
| Drop `philliplm-react-modern-audio-player` (bundled React 18 internals → blank page on React 19; Q-Mail never rendered it); `qortalRequest` rejecting stub outside Hub | ✅ | 1,437 kB (gzip 443 kB) |

### Redesign pass 1 (2026-10-01, overnight)

| Step | What landed | Main chunk · tests |
|---|---|---|
| Test harness | `src/test/setup.ts` mocks `qortalRequest` and `fetch` per action/URL; Testing Library cleanup between tests | 17 tests |
| Theme kit + Settings | `src/hub-theme` (synced copy), Hub 2.0 = "Q-Mail Classic" from `src/styles/theme.ts` + the `--qmail-*` variables (mapped onto `--qp-*` for the other three themes); boot snippet in `index.html`; full Settings page (Account with name switcher, Appearance, Mail, Sync, About with changelog dialog) opened over the mail page without unmounting it | 1,603 kB · 17 |
| Layout shell | `src/layout/*`: rail · list · reading pane on desktop; list + reading at 600–899 px; one pane, bottom nav (5 items) and floating Compose below 600 px; full-screen composer and message with Back on phones; `useAppViewport` sizes the app to the Hub/GO iframe and the visual viewport (keyboard); loading/empty/error/"Fetching from peers…" states; old Navbar, qapp-lib sidebar and 343 lines of CSS removed | 1,409 kB · 30 |
| Foundations | `src/utils/qdnSearch.ts` (in-flight merge + 90 s session cache + invalidation for every `/arbitrary/resources/search`), `src/hooks/usePolling.ts` (visibility pause, backoff, no overlap) | 1,409 kB · 40 |
| A · data core | persistent read state per account (`qmail_read_state_<address>`, independent of the `threadV2` marker), unread counts per inbox/name/alias in the rail, bottom nav and `document.title`; archive/hide (`qmail_archived_<address>`, Archived view, additive `archived` map in `qmail_state_v1`); polling for every owned name through `usePolling`; all Mail searches through the cache; Bugs #1 #2 #9 #14(partly) #20; Settings → Sync ("Publish mail state now" with a confirmation that names the fee). First load for one name with mail = **4 searches** (was ≈20–30), 0 on a repeat within the TTL | 1,418 kB · 71 |
| C · composer | Reply quotes the original in a Quill-1 `<blockquote>` with `Re:`; embedded reply history is stripped of its own history (payloads now grow linearly); Forward with `Fwd:`, an escaped header and the original attachments re-attached; Reply all over additive `to`/`cc` fields; a Drafts mailbox (same `qmail_compose_drafts_<address>` key, additive fields, thread-post drafts too); recipients by real recency with avatars and inline "name exists" validation through `src/utils/nameCache.ts`; Ctrl/Cmd+Enter sends; phone polish | 1,443 kB · 87 |
| D · reader + attachments | every attachment opens in the app: images, text, audio, video and **PDF** (pdf.js 4.10 with the worker on the main thread, Torq's Hub trick; the 1.6 MB engine is a lazy chunk loaded only when a PDF opens); one decrypted-blob cache per session; attachment cards with size, type, progress and Download all; "Fetching from peers…" with retry in OpenMail and the cards; avatar cache (one `GET_QDN_RESOURCE_URL` per name per session, misses remembered, lazy per visible row); reader with real buttons, collapsed earlier messages, pane-driven layout; opening a message happens in the reading pane, not a modal | 1,428 kB + 27 kB preview chunk + 1,641 kB pdf.js chunk · 91 |
| E · threads | group members and public keys from a paged cache (`/groups/members` with `limit=100`, no more `limit=0`, nameless members included); Threads as list + pane with unread marks per thread and group, paging beyond 60, empty/error states; thread screen with paged posts, polite polling (visibility-aware, backoff), reply-to-post quoting; thread searches through the cache; Bugs #13 #21(recipe) | 1,417 kB · 71 |
| Integration | the four branches merged one at a time (two small conflicts), the composer's group keys from the shared cache, per-message avatar storms removed, Reply all / Forward wired, rail icons and unread-thread badges | 1,298 kB (gzip 398 kB) · 200 tests |
| B · lists, badges, search | rows decide unread from the read store (no more synthetic `threadV2` markers; Mark as Unread never empties a real reply chain); every list has skeleton, empty (with a next action) and error (Retry) states; 44 px rows as real buttons with their own checkbox target, relative dates, lazy avatars, "Locked · open to read" instead of ciphertext; **search across mail**: subject/sender/recipient first with zero requests, "Search message bodies" on request (capped, with progress), "This mailbox / All mail" scope, highlighted matches, results open in their own mailbox; alias inbox parity (grouped list, search, read state, archive, real paging, polite delta polling, exact unread counts); sent view with cached recipient names (one lookup per recipient group), a delta poll and a delete bottom sheet; count badges (99+) in the rail and bottom nav | 1,291 kB · 238 |
| F · shell, shortcuts, bundle | React.lazy boundaries for the composer (Quill, dropzone), reader, threads, aliases, sent, drafts, Settings and the tour, with idle preloads for the composer and reader; dead code out (qapp-lib sidebar, AppMenu, DownloadTaskManager, audio state, localforage, mime, react-toastify → MUI Snackbar, react-copy-to-clipboard, react-joyride, 15 unused fonts); ResponsiveDialog (full-screen under 600 px) and bottom-sheet menus for every dialog; desktop keyboard shortcuts (c r a f e u j k Enter o Esc / g-i g-s g-t g-a ?) with a help dialog; hiding pane header on phones, global focus rings, reduced motion, phone Back closes sub-panes (GO's hardware button), a three-tip first-run tour instead of Joyride | **initial JS 388 kB (gzip 122 kB) + 34 small shared chunks ≈ 831 kB / 272 kB gzip; lazy: composer 318 kB, pdf.js 1,641 kB; CSS 12 kB · 266 tests** |

Before → after (platform baseline `43d9236` → merged redesign `e69a2fe`): initial JS 1,576 kB / 482 kB gzip → ≈ 831 kB / 272 kB gzip (main chunk 388 kB); CSS 183 kB → 12 kB; first-load searches ≈ 20–30 → 4 for one name; pollers 9 fixed intervals (none paused) → every one visibility-aware with backoff; `limit=0` calls 2 → 0; tests 17 → 266.

### Round 3: Hub & GO pitfalls, screenshot check, lint (2026-10-02)

Two parallel agents from `b2426c9` (main merged in, kit synced), merged one at a time; then a leftovers pass.

**Hub & GO pitfalls (docs/QORTAL.md), one commit each:** 1 light/dark: kit in sync (THEME_CHANGED handled by the kit) · 2 sticky headers: no `overflow-x` on html/body · 3 frame height: `src/utils/hubFrame.ts`; in a landscape frame the pane header is a 48 px bar, the floating Compose is hidden and the medium layout shows one pane at a time · 4 sheets: `BottomSheetMenu` mounts on first open · 5 avatars: `useLazyAvatarUrl` hands out no `src` until the row is in view (a real bug: it marked rows visible before the ref existed) · 6 overlaps: toasts above the bottom bar and left of the FAB; lists get 88 px clearance under it · 7 deep links: see Follow-ups · 8 Back: `usePhoneBackClose` rebuilt on the router's history, zero `window.history` calls · 9 unusual names: every direct fetch encodes; `SEARCH_NAMES` with `+` handled in the leftovers pass · 10 publishing: `MultiplePublish` waits as long as Hub (resources × 30 min), shows `PUBLISH_STATUS` per item, checks QDN by name + identifier after a timeout before offering Retry · 11 declines: `src/utils/hubErrors.ts` (12 languages) → quiet cancels everywhere · 12 account: `GET_USER_ACCOUNT` retried once after 35 s, then "Sign in" · 13 public nodes: Blocked names shows "Not available on a public node" · 14 resources: "D" bodies = deleted (said so, dropped), 2/4/8/16 s retries, then "Not available on your node right now" with sender and date · 15 trust: caches keyed by name + identifier, the search row wins over the body · 16 PDFs: bundled pdf.js with the worker on the main thread (round 1); since round 5 "Open PDF" uses Hub's own reader first: `SHOW_PDF_READER {blob}` gets the decrypted bytes on this device (nothing is uploaded or published), and the bundled pdf.js viewer is the fallback where Hub has no reader · 17 saves: always `SAVE_FILE` with a blob (an ATTACHMENT_PRIVATE location save would write ciphertext; the composer caps attachments at 40 MB) · 18 user HTML: DOMPurify 3.4, qortal links built with a TreeWalker over the sanitised fragment, inline colours dropped, web links shown as text with Copy. Tests 266 → 352.

**Audit against Hub's source** (read-only, `Qortal GO/Qortal-Hub` + Core's `q-apps.js`): q-apps.js answers `GET_ACCOUNT_DATA`, `GET_ACCOUNT_NAMES`, `SEARCH_NAMES` (raw `&query=`), `GET_NAME_DATA`, `GET_QDN_RESOURCE_URL/STATUS/PROPERTIES` and `FETCH_QDN_RESOURCE` itself; everything else goes to Hub, which gives each request 30 s except `PUBLISH_MULTIPLE` (resources × 30 min) and `PUBLISH_QDN_RESOURCE` (1 h), dedupes identical read-only requests in flight, and rejects with `{ error, message }`. Those limits and texts are what `hubErrors.ts` and `MultiplePublish` now follow.

**Screenshot check** (`scripts/screens.mjs Q-Mail+`, Brave headless, `e2e/screens.config.mjs` with 30 inbox rows incl. names with `+`, spaces and non-ASCII, locked and decrypted rows, a four-attachment message with a real PDF, sent, aliases, archived, drafts, a group with threads and posts; 19 screens × 5 sizes × 4 themes, dark and light):

| | console errors | sideways overflow | unlabelled buttons | targets < 44 px | text < 14 px | axe violations |
|---|---|---|---|---|---|---|
| before | 0 from the app | 0 | 5 | 150 | 314 | 6 rules (landmark-one-main ×71, aria-input-field-name ×10, image-alt ×10, scrollable-region-focusable ×6, button-name ×5, aria-dialog-name ×3) |
| after | 0 | 0 | 0 | 0 | 20 (the kit's theme-card captions, 12 px) | 0 |

Post-merge reruns (full matrix, then Hub 3.0 only) both stopped partway with Playwright's "browser has been closed" after 100+ clean captures: the snap Brave used as `QPLUS_CHROMIUM` hands off to the already-open Brave window. Rerun `QPLUS_CHROMIUM=/snap/bin/brave node scripts/screens.mjs Q-Mail+` with Brave closed (or point `QPLUS_CHROMIUM` at a Chromium that isn't running) to refresh the matrix on the final tree; the merges after the matrix touched the shell header, dialogs and lint only.

Contrast computed from the built themes: rows, headers, chips, badges, active rail items, avatar initials and selected rows pass 4.5:1 in Hub 3.0 (dark and light), Q-Mail Classic, Black and White; the kit's `error.main` as text reads 3.5:1 in Hub 3.0 (kit follow-up). Q-Mail Classic's primary moved from the pale `#dce9ff` (unreadable as text) to `#39afff` / `#155f9f`.

**Lint:** `npm run lint` added (eslint 9, the Q-Share+ config); 0 errors, 0 warnings.

**Leftovers pass (merge `99d5ef1`):** the lint exemption for the pitfalls files removed and its 26 findings fixed (dead `mobileMode`/`isChangelogOpen` state gone from Mail.tsx); **Settings sync**: the published state document gains an additive `settings` map (theme, text size, watched aliases, reply links); on load the alias lists are unioned into the local ones (local wins) and Settings → Sync offers "Restore appearance from the published state" (applied only on click); deleted ("D") mail is hidden from secondary-name and alias inboxes too; "Sign in" wording; `SEARCH_NAMES` queries keep a `+` (q-apps.js would turn it into a space). Tests 352 → 360; version 1.0.0; `scripts/build-zip.sh Q-Mail+` → `release/Q-Mail+.zip` (1.6 MB, 83 files, `index.html` at the root).

### Hub Dev Mode check (2026-10-01/02)

Driven with `scripts/hub-cdp.mjs` on a test Hub at debug port 9223 (`Qortal-Hub --no-sandbox --remote-debugging-port=9223`), signed in as **Tester GO**, Dev Mode → Server → 127.0.0.1:5174 (the Vite dev server through the node's proxy on 12393). The original Q-Mail (`qortal://APP/Q-Mail`) ran in a second tab.

- **Same data as the original:** Tester GO has no inbox mail, no sent mail and no groups with threads; both apps show exactly that (Q-Mail: "No messages to display." / "No groups with threads available."; Q-Mail+: "No mail yet · Compose", "No sent mail yet", "No threads yet · New thread"). Screens with real messages, attachments and the PDF viewer could not be exercised in Hub with this account (Follow-up 1).
- **First load (`hub-cdp.mjs requests 15 --reload` and `calls`):** before round 3: 8 `qortalRequest` calls (2 `QDN_RESOURCE_DISPLAYED`, `NOTIFICATION_MARK_SEEN`, `GET_USER_ACCOUNT`, `GET_ACCOUNT_NAMES`, `GET_PRIMARY_NAME`, `FETCH_QDN_RESOURCE` qmail_state_v1, `GET_QDN_RESOURCE_URL` avatar) and 11 Core calls (7 searches, `/names/address`, `/groups/member`, the state document, one avatar status). After round 3: 6 searches (the duplicated newest-20 inbox search is gone), 13 Core calls in total with two more lazy avatar lookups for the owned names shown in Settings.
- **Sizes** (`size`, `--touch` for phones): 1440 → desktop (rail · list · reading pane); 700 → medium (list 300 px + reading pane); 390×844 and 360×740 → phone (header, search, list, floating Compose, 5-item bottom bar; no sideways overflow); 844×391 → medium with the 48 px bar and no floating button after round 3.
- **Themes:** Hub 3.0 dark and light (`?theme=light`: warm paper background), Black, White and Q-Mail Classic (dark and light) all apply from Settings and survive a reload; the boot snippet paints the right background.
- **Dialog order:** the first-run tips opened on top of the welcome dialog; fixed, the welcome dialog now comes first.
- **Console:** only the dev proxy's HMR socket failure and a 404 for the account's missing `qmail_state_v1` document (expected).
- **Not checked in Hub (needs mail or a phone):** opening a message, attachments and the PDF viewer, Reply/Forward flows, the composer's Send above GO's keyboard, GO's hardware Back, pull-to-refresh, the alias scan, publishing (read-only session).

### Round 4 (2026-10-04): review, Simon's answers, leftovers, screenshot rerun, Hub check

**Whole-diff review** (six dimensions: correctness, data compatibility, efficiency, mobile/UX, accessibility, security; 66 agents): 38 findings, 37 after dedupe, **35 confirmed** by skeptics (three per high-severity finding), 2 refuted. One agent fixed them one commit each (`28952dc` … `d80d187`, 34 commits; the 35th was a duplicate). The serious ones:

- **Data:** publishing the mail state before the published document had loaded would have wiped other devices' archived map, alias lists and read entries; drafts written by Q-Mail+ could turn into direct mail to a group's name in the original app; a new thread's header could be dropped while its posts were published; thread paging used the filtered count as the next offset, so older threads never loaded.
- **Security:** group-thread posts rendered legacy `htmlContent` with bare DOMPurify instead of the app's sanitiser; a thread post's author and date came from the decrypted body, so any name could post as anyone; legacy Slate links had no link policy; Forward would decrypt and re-send any resource an attachment reference named; embedded reply history was shown as authentic messages (including as "You").
- **Keyboard and focus:** desktop shortcuts swallowed Enter on every focused button and stayed live behind Settings and the first-run tips.
- **Efficiency:** opening a group looked up every member's name and key just to count them; every decrypt repeated `GET_NAME_DATA` + `GET_ACCOUNT_DATA`; the thread pollers never backed off; mailbox rows decrypted subjects and resolved recipients off screen.
- **Landscape and phones:** the mailboxes drawer showed no mailboxes in a landscape frame; the attachment preview left 16 px for the file; the composer left 77 px; the floating Compose sat 76 px too high; Settings' Back pushed a new history entry.

**Early Hub smoke check with real mail** (Tester GO, Simon's test message): the message opened in both apps with the same subject and body; Reply/Reply all/Forward, read state, archive and search behaved. It found the `&nbsp;` bug before any mail was sent, a 5.4 s first open of a message already on the node, reply drafts saved on open, and archive/unread reachable only through checkboxes; all fixed below.

**Simon's answers and the leftovers** (six agents in worktrees on disjoint files, merged one at a time, every merge green; 0 dropped):

| Item | Result | Commit |
|---|---|---|
| FU 2: delete dead code | 85 files and 14,825 lines gone: 57 of the 60 `tsconfig` excludes (3 were live tests, now type-checked), the named legacy files, and 22 files only they imported (import graph walked from `main.tsx` and every test first); `tsconfig` exclude list and eslint ignores removed | `7a39311` |
| FU 3: visible Cc row | Cc row like To (names checked), Reply all fills Cc, note "Cc names are visible to every recipient", one copy per Cc name, additive `cc` field; publish request pinned by tests | `81bcf11`, `2a14fd6` |
| FU 4: unarchive across devices | left as is (union) | — |
| FU 5: local-only rating | hidden in Settings → About (code kept) | `9f7394f` |
| FU 6: Classic blue | kept (`#39afff` / `#155f9f`) | — |
| FU 7: shortcuts | from 600 px wide; off on phones and touch-only devices | `b897bfe` |
| FU 8: Classic's Roboto | subset WOFF2, Latin + Latin Extended, 400 and 500: 336,904 → 57,584 bytes (−83%) | `46fd613` |
| FU 9: shared fixes | kit: default avatar letter 4.5:1+ in every theme (e.g. Hub 3.0 light 1.30 → 7.07, White 1.88 → 5.44), ThemePicker captions 14 px, Hub 3.0 `error.main` readable as text; `hub-cdp.mjs shot` raises Hub first and times out stuck commands; `screens.mjs` writes one report per theme set and mode | `6e0a67c`, `49e4037`, `052c1fe` |
| FU 10: load-state prompt | its own checkbox removed; the prompt points to Settings → Sync, the only control; the state document is searched before it is fetched (no more 404 per load) | `68ddff6` |
| Bug #19 | sent identifiers parse names containing `_` (and spaces, `+`, `'`, `.`, `|`); the format written is unchanged | `c24fb3c` |
| Bug #15 | stable keys (MailTable rows by message id) | `3ff649c` |
| N9 alias scan | 50 per page, at most 10 pages (500 resources) per run, newest first, 15-minute session cache, a checkpoint of walked stretches, "Scan more", candidates decrypted once (remembered per address) | `cae8fe0` |
| `moment` | replaced by `Intl.DateTimeFormat`, package removed | `7ae58bc` |
| `extractTextFromHTML` | already removed in round 3 | — |
| `&nbsp;` in sent bodies | published bodies use plain spaces (`toPublishedMailHtml`) | `d39082a` |
| Slow first open | re-checks at 0.5 s and 1 s while DOWNLOADED/BUILDING: about 0.5 s instead of 5.4 s | `a40ae1f` |
| Reader actions | Archive / Move to inbox and Mark unread in the reader's action row | `2ef2c12` |
| Reply drafts | saved only once the user writes; Reply and Reply all keep separate drafts | `416f28c` |
| Calls | the composer's name directory search is cached for the session; the own avatar URL is fetched once | `9ad6f3f`, `884c985` |
| A blank app after a failed chunk | an error boundary shows "Reload" and a failed chunk is retried once (found in Hub) | `e5a424e` |

**Screenshot rerun** (Playwright's own Chromium 1243, not Brave; 23 screens incl. compose with To/Cc/Bcc, Reply all and the alias scan; 103 captures per theme × mode): hub30 dark, hub20 dark, Black, White, hub30 light and hub20 light all at **0 console errors, 0 sideways overflow, 0 unlabelled buttons, 0 small targets, 0 small text, 0 axe violations**. The run found and fixed: the reply card squeezed to a sliver, Subject above Cc/Bcc, a success toast below 4.5:1 with a small close button, and an unnamed progress bar.

**Numbers now:** main chunk 388 kB (gzip 125 kB), dist 3.6 MB (fonts included), 72 test files and 510 tests, lint clean, kit in sync.

**Hub check (round 4, 2026-10-04)**, test Hub on debug port 9223 signed in as Tester GO, the dev server on 5174 through the node's proxy, `scripts/hub-cdp.mjs`. The original Q-Mail ran in a second tab.

- **Real mail:** Tester GO's only message (from Simon James, no attachments) shows the same subject, body and date in both apps. The original's "to:" line is empty; Q-Mail+ shows "to Tester GO".
- **Checked and OK:** inbox, reader, Reply (To, `Re:`, reply card, quote), Reply all (Cc stays empty because the original had no Cc), Forward (`Fwd:`, header, quote); closing an untouched composer leaves no draft; Archive → Archived → Move to inbox; Mark unread (row and rail badge); search by subject and by body word, plus the "No matches" state; a watched alias "qmailplus-test" (rail entry, empty alias inbox, "Compose as"); Settings; Tester Hub's empty Sent.
- **Sizes and themes:** all four themes at 1440×900, 700×900, 390×844 touch and 360×740 touch on Settings, inbox and reader; 844×390 touch in Hub 3.0 and White. Every combination had 0 sideways overflow and only 44 px+ targets. Portrait phones show the bottom bar and floating Compose; landscape is compact with neither. Hub light gives Hub 3.0 light, and switching back works.
- **Calls on first load:** 9 `qortalRequest` (2 `QDN_RESOURCE_DISPLAYED`, `NOTIFICATION_MARK_SEEN`, `GET_USER_ACCOUNT`, `GET_ACCOUNT_NAMES`, `GET_PRIMARY_NAME`, 2 avatar URLs, 1 `DECRYPT_DATA`) and 11 Core fetches (5 searches with limits 200/20/20/1/20, 2 status, 2 thumbnails, `/names/address`, `/groups/member`). No `limit=0`, no storms; the state-document 404 is gone.
- **Found and fixed:** a failed code-split chunk unmounted the whole app and left Hub showing an empty frame; it now shows "Reload" and retries the chunk once (`e5a424e`).
- **Test sends (evening, with Simon present).** Simon allowed a few test mails from the second test account, Tester Hub. When the test Hubs reopened on the wallet lock screen, Simon unlocked them himself. The session sent four mails through Q-Mail+ and accepted Hub's publish dialog for each after reading its contents (fees 0.05 + 0.05 + small + 0.04 QORT, paid by Tester Hub):
  1. **To Tester GO, Cc Simon James:** formatting (lists, code block, `qortal://APP/Q-Tube`, a long line) plus a PDF, a PNG and a TXT. On the node: two mail copies with one send id, `_mail_qortal_qmail_Tester GO_v89BrC_mail_SU6Xr4` and `…_Simon James_YcyQyH_mail_SU6Xr4`, and three `attachments_qmail_<uid>_<uid>`.
  2. **To Simon James, Cc POS+, MA's, "Custom Node on Qortal GO | GUIDE", biohackerscorner.com:** five copies, `…_Simon James_YcyQyH_…`, `…_POS+_YcyQyH_…`, `…_MA's_YcyQyH_…`, `…_Custom Node on Qorta_YcyQyH_…` (cut at 20 characters, as the original writes it) and `…_biohackerscorner.com_YcyQyH_…`, all `_mail_N94OVu`.
  3. **To Tester GO's alias:** `_mail_qortal_qmail_qmailplus-test_mail_uOYmyr`, after upstream's "Same alias on both sides… Send anyway?" warning.
  4. **Forward of mail 1 to Simon James:** "Fwd: …" with all three files re-attached and re-encrypted (12.48 KB, 683 B, 67 B), `…_Simon James_YcyQyH_mail_RSSqXw`.
- **Found and fixed during the sends** (`e239bab`): a freshly sent message stayed on "Preparing… 100%" for good. Core had the file (`DOWNLOADED`) but only assembles it to `READY` when a status request carries `build=true`, which q-apps.js forwards for `GET_QDN_RESOURCE_STATUS`. The original app never passed it either; it showed "building message…". Every status check now passes `build: true`, and the same unbuilt copy then opened in about 3 s.
- **Received on Tester GO, read-only:**
  - Mail 1 opened in about 3 s. The body has no `&nbsp;` between words, with both lists, the code block, the link, "to Tester GO" and all three attachments.
  - **PNG preview** decodes (96×64); **TXT preview** shows `åäö ß €` correctly; **the PDF opens in the in-app pdf.js viewer in Hub** (page 1 of 1 drawn, zoom and page controls, dark-mode rendering).
  - **Save all (3)** hands the first file to Hub's save prompt; Decline stops the rest quietly.
  - **Reply all** fills To = Tester Hub and Cc = Simon James, with `Re:` and the "visible to every recipient" note, and closes without a warning when untouched.
  - **Search** finds mail 1 by subject.
  - The **alias inbox** `qmailplus-test` shows "Has messages" and opens mail 3.
  - **At 390×844 touch,** mail 1 opens full-screen with Back, no floating button and no sideways overflow.
  - **Original Q-Mail** (second tab): lists mail 1 with the same time (17:54:05) and opens it with the same subject and body, normal spaces and both lists.
- **On Tester Hub:** Sent groups the eight copies by recipient with the odd names correct. The long name shows its 20-character identifier prefix until opened.
- **Calls on Tester GO's first load after the fixes:** 8 `qortalRequest` (no state-document fetch when none exists) and 10 Core calls (6 searches, 2 status, `/names/address`, `/groups/member`).
- **Not checked:**
  - mail 1 in a landscape frame (the capture caught Hub mid-resize; landscape was checked on the inbox earlier);
  - the delete-sent sheet (Cancel only);
  - archive and read state on mail 1 (checked on Simon's message earlier).

### Round 5 (2026-10-04, evening): Simon's requests on his own account

Simon tried the app on his main account: 86 names and about 177 messages in the combined inbox. He asked for seven things. The work came in five branches, merged one at a time: `193a1c8` links, `3df1a03` names, `5725fe2` layout, `763fbb7` footer, `c803631` PDF.

| Item | What changed | Commits |
|---|---|---|
| Name switcher | Settings → Account → Active mailbox is a dropdown. Above 15 names it is a searchable popover on desktop and a full-screen sheet on phones and in landscape frames. A newly chosen name never shows the previous name's avatar. | `79aeb82`, `8a4f308`, `1e49dc5` |
| Adjustable panes | The borders between rail, list and reading pane can be dragged or moved with the keyboard. Rail 180–360 px, list 260 px up to 60 % of the main area, reading pane at least 360 px. Widths are saved per account. The handle is hidden on touch-only screens. | `75ecf44`, `9a2098b` |
| Switching messages | Any row opens while another message is shown or still opening. The newer open wins and the row highlight follows it. | `1cf3eec` |
| No "Select a message" | With nothing open the list takes the full width. The reading pane appears when a message opens. | `b6da4f8` |
| Group-join link | `qortal://` links in every reader open through Hub: `JOIN_GROUP` for use-group links, a new Hub tab for apps and resources. A link that can't open becomes text. | `76b24af`, `9101ab0`, `2cc2cb8` |
| Mail footer | Settings → Mail → Footer: a default footer, one per name, and a switch for replies and forwards. The composer adds it to new mail, replies and forwards, and From swaps it while it is unedited. It is published in `settings.footer` (§10, §17). | `62d036a`, `a31a1e1`, `750ffb7`, `1fd2ad9`, `ffd1459`, `3cb88ba`, `d55e763`, `37bfa06`, `376c827` |
| PDF preview | PDF attachments get Q-Share+'s file card. Open PDF hands the decrypted bytes to Hub's own reader (`SHOW_PDF_READER {blob}`, nothing uploaded); the bundled pdf.js viewer is the fallback. On phones the Save button is one row tall. | `05e3c41`, `3955caf`, `75fc9ac` |
| Other | A paging test got 20 s under full-suite load; Settings row buttons no longer shrink under long labels (found in the Hub check). | `4b32aae`, `5071fe0` |

**Causes:**
- Switching: while a message was shown, the reader kept the reading pane, so OpenMail never mounted and nothing was fetched.
- Join link: Core's q-apps.js crashes in `extractComponents` on `qortal://use-group/…` links and the frame navigates away (the original app too). The app now stops the click and asks Hub itself.
- Join link, second cause: Hub declares `const qortalRequest`, which is not a window property, so `main.tsx` put its "outside Hub" stub on `window` and the link helper picked the stub.

**Review** of the round's diff: 3 reviewers, 10 findings, 6 confirmed and 4 refuted. The fixes, one commit each:

| Commit | Fix |
|---|---|
| `d55e763` | a cleared footer stays cleared; the published state no longer refills it |
| `37bfa06` | the footer is inserted with Quill's whitespace, so a From change can swap it |
| `376c827` | the footer's name picker is A to Z and searchable above 15 names |
| `1e49dc5` | the name switcher is a full-screen sheet in landscape frames |
| `9a2098b` | the pane resize handle is hidden on touch-only screens |

**Hub check on Simon's account (earlier, round 5):** test Hub on port 9223 signed in as Simon James, dev server in Dev Mode. The switcher lists 86 names and "pos" finds 3. Both panes drag and keep their widths. Switching between messages works, including from a decrypted one to a locked one. Mugician's join link opens Hub's "Confirm joining the group" dialog; it was declined. It found the avatar bug (POS+ showed Simon James's picture), fixed in `8a4f308`.

**Hub check on Simon's account (this evening):** same Hub, never locked. "Load published QDN state?" was answered "Not now" each time. The frame's localStorage was saved first and matched exactly at the end (0 differing keys).

| Check | Result |
|---|---|
| PDF preview | "Q-Mail+ test 1" (PDF 683 B, PNG 12 KB, TXT 67 B) found by search. Open PDF opens Hub's reader with the page drawn in under 2.5 s; Exit closes it. Download then reads Save, as in Q-Share+. Hub's save prompt was declined and the app showed no error. PNG and TXT previews open; the in-app pdf.js viewer still works. "Fwd: Q-Mail+ test 1" is not in Simon's mail (0 matches in 349 subjects). |
| Q-Share+ comparison | Share "HR Newsletter 967" (438 KB PDF): the same card layout. Hub's reader opened on page 1 of 4 after about 9 s (first download), then Download read Save. Only difference: Q-Mail+ also offers the in-app viewer. |
| PDF at 390×844 touch | Hub's reader in about 0.5 s. The Save/Download button was 160 px tall; fixed in `75fc9ac`, now 48 px. |
| Footer | Saved as you type. New mail: an empty line, then the footer. Reply: the footer above the "On … wrote:" quote. A POS+ footer set through the "Footer for" picker (popover at 1440, full-screen sheet at 390); From = POS+ swaps it in and back. An edited footer survives From changes. Every composer was discarded and no draft was left. Both footers cleared: after a reload the footer stays empty (`d55e763` holds). No overflow at 390 touch. |
| Switching | Decrypted Mugician → locked TFreedman decrypts and opens in about 0.7 s. |
| Name switcher | "pos" finds 3 of 86; POS+ and back works. Landscape 844×390 touch: a full-screen sheet with 6 names visible. |
| Panes | At 1440 rail 260 → 320 and list 306 → 406, saved. At 1024×768 touch and 390 touch the handle is hidden. No message open: full-width list; Mark unread closes back to it. |
| Join link | `qortal://use-group/action-join/groupid-1176` opens Hub's "Confirm joining the group: Q-Builder Test Users" (0.01 QORT fee). DECLINE pressed. |
| Settings at 390 | Publish and Restore were squeezed to 79 px with icons outside the border; fixed in `5071fe0` (109 px and 111 px, no overflow). |

**Calls on Simon's first load** (`requests 20 --reload`, about 31 s):

| Kind | Count |
|---|---|
| `qortalRequest` | 46: 21 `FETCH_QDN_RESOURCE` (19 group-thread MAIL + `qmail_state_v1`), 18 `GET_QDN_RESOURCE_URL`, 1 `DECRYPT_DATA`, account and name calls |
| `/arbitrary/resources/search` | 408, most in the first 3 s: 170 inbox queries with limit 200 (2 per owned name), 86 + 84 sent probes with limit 20, 45 MAIL thread searches |
| Other Core fetches | 20 MAIL, 16 status, 5 THUMBNAIL |

Group avatars 694 and 659 were each requested twice at the same moment. The per-name probes are the same in the original app; merging them is the next speed fix (Follow-ups).

**Numbers now:**

| | Round 4 | Round 5 |
|---|---|---|
| Main chunk | 388 kB (gzip 125 kB) | 394 kB (gzip 126 kB) |
| Test files · tests | 72 · 510 | 83 · 632 |
| Lint | clean | clean |
| Kit | in sync | in sync |
| dist | 3.6 MB | 3.6 MB |

## Follow-ups

**For Simon on his own account.** The round 5 Hub checks already ran on your account (read-only, nothing published or sent): the 86-name switcher and its search, the avatars after a switch, pane widths, switching between messages, the full-width list, Mugician's join link (declined), the footer at 1440 and 390 (all cleared again), mail 1's PDF in Hub's reader and in the in-app viewer, and the Q-Share+ comparison. Left for you, in Q-Mail+ and the original Q-Mail:
1. **The footer for real:** set yours, send one mail, and check it in the original app.
2. **GO on a phone:** Open PDF in Hub's reader, the footer in the composer above the keyboard, and the name sheet.
3. **The five copies of "Q-Mail+ test 2"** under Simon James, POS+, MA's, "Custom Node on Qortal GO | GUIDE" and biohackerscorner.com.
4. **Mail 1's Cc:** Reply all from your side should list Tester GO.
5. **The forward:** "Fwd: Q-Mail+ test 1" did not show in your mail this evening (0 matches for "Fwd" in This mailbox and All mail, 349 subjects), although Tester Hub published it to Simon James in round 4. Check whether it arrives in the original app.

**Simon's answers (2026-10-04), all done:** 1 test mail: one message arrived without attachments; the attachment checks ran with test sends from Tester Hub (see Round 4) · 2 dead code deleted · 3 Cc row added · 4 unarchive left as is · 5 rating hidden · 6 Classic blue kept · 7 shortcuts from 600 px · 8 Roboto as subset WOFF2 · 9 kit and script fixes made · 10 the prompt's checkbox removed.

**Questions for Simon**

1. **Cc in the reader:** mail from Q-Mail+ now carries `cc`, but the reader only shows "to <recipient>". Show a Cc line (additive, from the `cc` field)?
2. **Cc autocomplete:** only To has directory suggestions; Cc and Bcc names are typed and checked. Add suggestions there too?
3. **Closing a reply** goes back to the full-width list; the message you replied to is not reopened. Reopen it beside the list instead?
4. **`blogSlice`** stays registered because the `BlogPost` type and 8 tests use it; removing it is a small refactor with no user-visible change. Do it in the next pass?
5. **Orphaned assets** nothing imports (old PNG logos and 18 old SVG icons in `src/assets`) were not on the approved list, so they stay. Delete them too?

**Next pass:**
- **Merge the per-name probes (next speed fix).** On Simon's account a first load sends about 400 `/arbitrary/resources/search`, almost all the inbox and sent probe per owned name (I4/I5, the same in the original): 170 inbox queries and 86 + 84 sent probes in the first 3 s. One query per kind with several `name=` params, or probing only names that have mail, would cut most of them.
- **Duplicate group avatars:** avatars for groups 694 and 659 were requested twice at the same moment; the in-flight merge misses them.
- **Load-state prompt per name:** switching the active mailbox away and back asks "Load published QDN state?" again; Settings says it asks once per sign-in.
- **Compose's From** is a plain 86-item select with no search, unlike the Settings and Footer pickers.

Also: the attach control is an image inside a `role=presentation` drop zone rather than a labelled button; `MailTable.tsx`'s `SimpleTable` default export is dead; `hub-cdp.mjs tap` lands about 124 px high in the app frame (the frame's top offset in Hub's page; a separate repo task in `scripts/`); GO on a real phone (keyboard, hardware Back, pull-to-refresh); the React Compiler lint rules stay off (mostly upstream setState-in-effect code).
