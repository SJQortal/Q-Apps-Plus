# Q-Fund+

Crowdfunding campaigns funded in QORT, with updates and comments.

## Baseline at import

- **Upstream:** [Qortal/q-fund-v2](https://github.com/Qortal/q-fund-v2) branch `master` at `5927bf8` (2024-04-17, 5 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 4, TypeScript 5
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 2.3 MB, biggest JS chunk 1.2 MB
- **QDN services:** DOCUMENT, AUDIO, VIDEO, THUMBNAIL, FILE, BLOG_COMMENT
- **Identifiers seen (partial; complete this in the audit):** collect during the audit (crowdfund prefixes); `qortal_avatar`
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×4, GET_QDN_RESOURCE_URL ×4, FETCH_QDN_RESOURCE ×3, SEARCH_TRANSACTIONS ×2, PUBLISH_MULTIPLE ×2, SEND_COIN ×1

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- **`react-quill` 2 crashes on React 19** (it calls `findDOMNode`). Switch to `react-quill-new` (Quill 2) and check that content written by the + app still displays correctly in the original app, and the other way round (docs/MIGRATION-NOTES.md, Q-Apps+ specifics).
- **`@mui/x-date-pickers` 6 → 9** (MUI 9 needs MUI X 9). Follow MUI X's own migration guides, and keep stored date values and formats unchanged.
- This is old code (last upstream commit 2024-04-17, 5 commits in total).
- Funding goes through `SEND_COIN` to an AT/address. Keep the donation flow and amounts exact.
- Has 3 `limit: 0` searches.

## Feature ideas to weigh in the audit

- progress bar with backers and time left
- campaign updates timeline
- filter by active, ending soon or funded
- share link

## Status (pass 1, branch `q-fund-plus/pass-1`)

**Checkpoint reached 2026-09-30:** platform upgrade, test harness, theme kit and Settings page are in, the build is green and `scripts/build-zip.sh Q-Fund+` produces the zip. The audit, efficiency and redesign work below is what remains.

### Platform upgrade (done, one commit per rung)

| Step | Result |
|---|---|
| Baseline (React 18.2, MUI 5.11, Vite 4) | build ✅, tsc 0 errors, **lint already failing** (18 errors, 279 warnings, mostly `any` and hook deps). dist 2.3 MB, biggest chunk 1.21 MB |
| Toolchain: TS 5.9, Vite 8, plugin-react 6 | ✅. **Blocker found:** `qortal-app-utils` depends on an npm package literally named `node` (20.7.0) whose binary lands in `node_modules/.bin` and shadows Node 22 inside npm scripts, so Vite 8 could not start. Its `main` also points at TypeScript source that pulled a second MUI 5 and react-quill into the bundle. The dozen helpers this app uses are vendored verbatim in `src/utils/qortalAppUtils.ts` and the package is gone |
| React 18.3.1, RTK 2, react-redux 9.3, RRD 6.30 + `v7_relativeSplatPath`/`v7_startTransition` | ✅, nothing to codemod |
| react-quill → react-quill-new 3.8 | ✅. Quill 2 hands `onChange` its *semantic* HTML (`<ul><li>`, nested `<ol>`), the same markup Quill 1 stored, so no conversion layer is needed (checked with a jsdom probe). Only the Resize/DisplaySize parts of the image-resize module are enabled, as upstream Q-Tube does. Quill 2's CSS hides markers on plain `<li>`, so `index.css` restores them for displayed content |
| MUI 5.18 + MUI X 7 | ✅ |
| React 19.3 | ✅, `types-react-codemod preset-19` changed nothing; react-rnd, react-intersection-observer and react-dropzone bumped so `npm install` resolves without `--legacy-peer-deps` |
| MUI 9.4 + MUI X 9 | ✅. Codemods in the documented order, then 16 manual fixes (styled TextField `inputProps`, Menu `PaperProps`, two Grid items, two `…Outline` icons, duplicate keys the system-props codemod produced). tsc 0 errors after; biggest chunk 1.36 MB |
| Theme kit + Settings | ✅. Biggest chunk 1.38 MB (Inter fonts are separate files). Verified in Chromium at 1280/375 px: four themes switch live and persist; console shows only the expected outside-Hub errors |

Stored date values are unchanged: `NewCrowdfund` still converts the picker's dayjs value to a block count (`diffInMins`) before publishing; MUI X 9's `DesktopDateTimePicker` typechecked without changes.

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

- **Lint was red at the baseline** (18 errors, 279 warnings from upstream code). Not hidden; not fixed in this pass.
- **`qortal-app-utils` upstream:** its `node` dependency and source `main` break any modern toolchain. The vendored copy in `src/utils/qortalAppUtils.ts` should be kept in sync if Qortal ever fixes the package. The same trap will hit Q-Shop+/Q-Support+ if they use it.
- **Image resize in the editor:** the Toolbar part of `quill-image-resize-module-react` is off because it needs Parchment 2. Users can still drag-resize images; alignment buttons are gone. A Quill 2 native resize module would restore them.
- **Version:** upstream never set one (0.0.0), so the + series starts at `1.0.0-plus.1`. Simon may prefer another base.
- **Home hero** still uses upstream's hard-coded green gradient and Raleway/Mulish fonts in every theme; the redesign pass replaces it with the Hub 3.0 layout.
- Hub Dev Mode test of the upgraded app (Hub-only): check the date picker, the editor, and a real donation flow.
