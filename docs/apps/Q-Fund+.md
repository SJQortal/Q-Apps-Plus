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

- This is old code (last upstream commit 2024-04-17, 5 commits in total).
- Funding goes through `SEND_COIN` to an AT/address. Keep the donation flow and amounts exact.
- Has 3 `limit: 0` searches.

## Feature ideas to weigh in the audit

- progress bar with backers and time left
- campaign updates timeline
- filter by active, ending soon or funded
- share link

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
