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
- **Identifiers seen (partial; complete this in the audit):** collect during the audit (file and document prefixes); `qortal_avatar`
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×5, GET_QDN_RESOURCE_URL ×5, SEARCH_QDN_RESOURCES ×4, GET_QDN_RESOURCE_PROPERTIES ×4, ADD/DELETE/GET_LIST_ITEMS; `/arbitrary/resources` ×13

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- **`react-quill` 2 crashes on React 19** (it calls `findDOMNode`). Switch to `react-quill-new` (Quill 2) and check that content written by the + app still displays correctly in the original app, and the other way round (docs/MIGRATION-NOTES.md, Q-Apps+ specifics).
- Has 3 `limit: 0` searches.

## Feature ideas to weigh in the audit

- drag-and-drop multi-file upload with progress
- folders or collections
- file previews (images, PDF, text, audio, video)
- sort by newest or popular
- copy share link

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
