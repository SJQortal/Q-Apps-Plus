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

- **The upstream build was broken:** `.gitignore` has excluded `src/assets/icons/*` since Q-Support 1.0, so the icons the code imports were never pushed. The import commit fixed it:
  - It copied the 7 coin PNGs from Q-Trade+ and the Q-Fund logo (`QFundDarkLogo.png`) from Q-Fund+.
  - It added **labelled placeholders** for the 10 category and status icons (`Bug-Report-Icon.webp`, `Feature-Request-Icon.webp`, `Tech-Support-Icon.webp`, `Q-App-Icon.webp`, `Qortal-Core-Icon.webp`, `Qortal-UI-Icon.webp`, `Open-Icon.webp`, `In-Progress-Icon.webp`, `Complete-Icon.webp`, `Closed-Icon.webp`). Those exist nowhere in git.
  - It removed the ignore rule.

  In the redesign, either replace the placeholders with proper icons in the Hub 3.0 style (preferred: MUI icons or SVGs that follow the theme), or use the originals if Simon extracts them from the published Q-Support app.
- Has 4 `limit: 0` searches.

## Feature ideas to weigh in the audit

- issue status workflow (open, in progress, solved)
- filter by status, category and bounty
- mark a reply as the solution
- notify the issue author

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
