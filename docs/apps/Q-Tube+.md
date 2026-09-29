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
- Torq already embeds Q-Tube videos (`shared/reference/torq`): useful for player and card patterns.

## Feature ideas to weigh in the audit

- continue watching
- watch later
- better channel pages
- chapter or timestamp links
- faster home feed (cached, paged)

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
