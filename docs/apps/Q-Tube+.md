# Q-Tube+

Video platform: upload, playlists, comments, super likes, subscriptions.

## Baseline at import

- **Upstream:** [Qortal/q-tube](https://github.com/Qortal/q-tube) branch `main` at `68c3ea7` (2026-07-15, 365 commits)
- **Stack:** React 19, MUI 7, qapp-core 1.0.80 (vendored tarball), jotai, Vite 7, TypeScript 5.8
- **Original theme (becomes Hub 2.0):** src/styles/theme.ts
- **i18n:** yes (ar, de, en, es, fr, it, ja, ru, zh)
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 7.4 MB, biggest JS chunk 3.2 MB
- **QDN services:** VIDEO, PLAYLIST, DOCUMENT, BLOG_COMMENT, CHAIN_COMMENT
- **Identifiers seen (partial; complete this in the audit):** `qtube_vid_`, `qtube_playlist_`, `qtube_superlike_` (`MYTEST_*` in test mode). See `CONTEXT.md` in the app
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×13, FETCH_QDN_RESOURCE ×9, GET_NAME_DATA ×4, SEARCH_QDN_RESOURCES ×3, SEND_COIN ×2 (super likes)

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 19 → 19.3, MUI 7 → 9.4. This app uses qapp-core, so add the `overrides` block and the `ErrorOutline` icon alias from PLATFORM.md.
- **Spike result (2026-09-29):** Q-Tube builds and renders on React 19.3 + MUI 9.4 with no new console errors. Things to fix:
  - two icon renames: `DeleteOutline` in `PlaylistListEdit.tsx` and `PlayCircleOutline` in `FilterOptions.tsx`;
  - ~31 mechanical type errors (Box/Typography system props → `sx`, `inputProps` → `slotProps.input`, ref types).
- **Keep the vendored `qapp-core-1.0.80.tgz`.** It isn't published and has video-player changes (`VideoSettings`) that aren't in qapp-core master, so don't swap it for an npm version.
- **Existing bug, not caused by the upgrade:** `useMediaInfo.tsx` fails to load `MediaInfoModule.wasm` ("WebAssembly.instantiate(): Import #0 \"env\": module is not an object or function") on both MUI 7 and MUI 9 builds. Check in Hub whether video publishing metadata still works, and fix it if not.
- This is the most active upstream (365 commits, last 2026-07-15), so expect to run `scripts/sync-upstream.sh` again later. Keep changes clean for easier merges.
- qapp-core comes from the vendored `qapp-core-1.0.80.tgz`; keep that file.
- The biggest JS chunk is 3.3 MB, the largest of all the apps. Splitting it is a priority.
- Read the app's own `CONTEXT.md` and `QORTAL.md` first.
- **Pass 1 baseline (2026-09-29, branch `q-tube-plus/pass-1`):** `npm ci && npm run build` passes in 23 s. dist 7.5 MB; biggest chunk `index-*.js` 3,389 kB (gzip 1,015 kB); twelve Roboto TTF files, 1.8 MB. `tsc --noEmit`: 6 errors, all in `VideoCardImageContainer.tsx` (untyped refs). `npm run lint` **fails at baseline**: 537 errors and 75 warnings (238 unused vars, 218 `no-explicit-any`, 49 exhaustive-deps, 35 set-state-in-effect, 26 only-export-components, the rest small). Left as is: fixing 500+ upstream lint hits would make every future `sync-upstream.sh` merge conflict.
- **Upgrade result (2026-09-29):** React 19.3.0, MUI 9.4.0 (material, icons, system), Vite 8.3 + plugin-react 6.1, TypeScript 5.9.3, typescript-eslint 8.71. qapp-core stays on the vendored 1.0.80 with the `overrides` block and the `ErrorOutline` alias. Codemods `deprecations/all` and `v9.0.0/system-props` changed 14 files. Fixed by hand: two icon renames, eight `inputProps`/`InputLabelProps` → `slotProps`, two Radio `inputProps`, `BoundedNumericTextfield` now takes its own `InputProps` prop, and `ResponsiveImage` accepts a `ref` (React 19 style; the hover-preview fade in `VideoCardImageContainer` never received its ref before). Type errors 6 → 0; lint unchanged (537/75). Build 4.6 s; chunk 3,388 kB, dist 7.5 MB. Chromium preview at 1280 and 375 px shows the same three console errors as the MUI 7 build, all from running outside Hub.
- Torq already embeds Q-Tube videos (`shared/reference/torq`): useful for player and card patterns.

## Feature ideas to weigh in the audit

- continue watching
- watch later
- better channel pages
- chapter or timestamp links
- faster home feed (cached, paged)

## Audit

_Not written yet (the session paused after the checkpoint). What was found in passing is under Follow-ups; the full audit (architecture map, binding data contract, call inventory, performance, UX, bugs) is the first job of the next session, before any data-layer change._

## Plan

Checkpoint items are done (below). The rest of pass 1, in order: the efficiency fixes listed under Follow-ups (on-demand publish dialogs, super-like feed paging, lazy routes), then the Hub 3.0 layout (nav rail on desktop, bottom nav on phones, sticky header), then 2–4 features from the ideas above (continue watching from the progress store and history is the cheapest).

## Done

Branch `q-tube-plus/pass-1`, PR [#6](https://github.com/SJQortal/Q-Apps-Plus/pull/6). Every commit builds and passes `npm test`.

1. **Upgrade to React 19.3 + MUI 9.4** (Vite 8, TS 5.9). tsc 6 → 0 errors. Details in Notes above.
2. **Test harness**: vitest + jsdom + Testing Library; `qortalRequest`, `qortalRequestWithTimeout` and `fetch` mocked and recorded, unregistered actions reject. 10 tests: harness, identifier prefixes (data compatibility), number/time formatters.
3. **Theme kit, four themes, Settings page** (`/settings`, in the side nav): Hub 3.0, Q-Tube Classic, Black, White; boot snippet; `PaletteExtender` supplies `paper2`/`unSelected`/`text.tertiary`/`superlike` for the kit themes. Settings: Account (avatar, name switcher, address), Appearance, Privacy (blocked names), About (version `2.1.0-plus.1`, changelog dialog, links). Strings in all 11 locales (English until translated). README added. Checked in Chromium at 1280 and 375 px in all four themes: theme attributes, backgrounds and fonts correct, console shows only the three outside-Hub errors.
4. **moment removed**: `utils/time.ts` uses `Intl.RelativeTimeFormat`; Notifications' 5-day cutoff is plain arithmetic.

| | Baseline | Now |
|---|---|---|
| dist | 7.5 MB | 5.9 MB |
| biggest JS chunk | 3,389 kB (gzip 1,015) | 3,071 kB (gzip 912) + Settings 10 kB lazy |
| fonts | 12 Roboto TTF, 1.8 MB | 4 Inter woff2, 426 kB |
| tsc errors | 6 | 0 |
| tests | 0 | 10 |
| searches on first load | not counted yet | not counted yet |

`scripts/build-zip.sh Q-Tube+` → `release/Q-Tube+.zip` (2.4 MB, `index.html` at the root).

## Follow-ups

**Where the session stopped (2026-09-29, paused by Simon):** the checkpoint and the moment removal are committed and pushed; nothing is half-done in the tree. Next session: say "continue" and work through this list in order, one commit each, pushing after every commit and updating PR #6's description at the end.

1. **Load the publish and edit dialogs on demand.** `PublishVideo` (imported statically by `components/layout/Navbar/Components/PublishMenu.tsx`), `EditVideo` and `PublishAndEditPlaylist` (always rendered by `wrappers/GlobalWrapper.tsx`, their Modals open on `editVideoAtom` / `editPlaylistAtom`) pull react-quill-new + quill-image-resize, mediainfo.js, compressorjs, react-dropzone and FrameExtractor into the main chunk. Worse, `hooks/useMediaInfo.tsx` instantiates MediaInfo in a mount effect, so the 2.4 MB `MediaInfoModule.wasm` is fetched on every app start (and fails: "Import #0 env", see Notes). Plan: `React.lazy` the three components; in GlobalWrapper render EditVideo / PublishAndEditPlaylist only while their atom is set (inside `<Suspense>`); in PublishMenu lazy-load PublishVideo inside the popover (MUI Popover mounts children only when open). Expected: main chunk well under 2.5 MB, no wasm fetch on first load. Then fix the wasm error: the copy in `public/MediaInfoModule.wasm` must match the installed `mediainfo.js` version (compare with `node_modules/mediainfo.js/dist/MediaInfoModule.wasm`, copy it over or serve it from node_modules through Vite's `?url` import).
2. **Super-like feed paging** (`wrappers/GlobalWrapper.tsx` → `getSuperlikes`): on mount and every 5 minutes it runs up to 100 sequential `/arbitrary/resources/search?…limit=1&offset=N` calls plus a `/transactions/signature/…` fetch per hit. Fetch pages of 20 (`limit=20&offset=N*20`, same query, same validity filter), stop at 20 valid or 100 scanned, cache payment info by signature for the session (transactions never change), skip the poll while `document.visibilityState !== 'visible'`. Put the loop in a pure function under `src/utils/` and test it with the harness by counting `fetchCalls`.
3. **Lazy routes** in `src/Routes.tsx` for VideoContent, PlaylistContent (both carry qapp-core's VideoPlayer), ChannelPage, Bookmarks, History, Subscriptions and Search. Settings already is.
4. **Other efficiency items seen in passing:** `hooks/useHandleNameData.tsx` calls `GET_ACCOUNT_NAMES` with `limit: 0` every 2 minutes (page it, pause when hidden); `components/ResponsiveImage.tsx` starts a 60 s timeout on every render (`useEffect(() => endLoading(60), [endLoading])` with a new function each render); framer-motion (`Layout.tsx`, `Search.tsx`, `PageTransition.tsx`, `ListSuperLikeContainer.tsx`) could be CSS transitions. The home feed's first-load search count still has to be measured (`pages/Home/Home-State.ts`, `utils/fetchVideos.ts`, `VideoList*.tsx`).
5. **Hub 3.0 layout**: replace the top AppBar + collapsed Drawer with the kit-style nav rail (desktop) and bottom nav (< 600 px), sticky translucent page headers via `components/layout/shell/PageHeader.tsx` (already used by Settings). Names+ on `origin/names-plus/pass-1` has `NavRail.tsx`, `BottomNav.tsx`, `navItems.ts` and `usePhoneLayout.ts` to copy from.
6. **Features** (after the data contract is written): continue watching row (qapp-core `useProgressStore` keys `${service}-${name}-${identifier}`, plus `watched-v1` history); watch later (local list first, no new QDN data); timestamp links in descriptions/comments that seek the player and `?t=` deep links.
7. **Lint fails at baseline** (537 errors, mostly upstream `any` and unused vars). Decide whether to relax the config for upstream files or fix them in a dedicated commit; the upgrade and redesign commits add no new lint errors (checked: totals unchanged).
8. **Theme kit follow-up (shared/, not touched here):** let `AppThemeConfig` pass extra palette keys into the three shared themes, so apps like Q-Tube don't need a `PaletteExtender`.
9. **Translations:** the new `settings.*` and `sidenav.settings` strings are English in all 11 locales.
10. **Questions for Simon:** (a) should Q-Tube Classic bundle Roboto again (1.8 MB) or is the OS Roboto / Inter fallback fine? (b) is the vendored qapp-core 1.0.80 going to be published, or should Names+/Q-Tube+ share one copy? (c) the audit workflow was cancelled to save budget; a full audit costs roughly 10 agent-runs.
11. **Test in Hub** (local session): all four themes and Hub's light/dark switch; Home, a video page, a channel page and the publish menu show the same data as `qortal://APP/Q-Tube`; whether publishing still reads video metadata given the MediaInfo error.
