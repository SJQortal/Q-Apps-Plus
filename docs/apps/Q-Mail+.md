# Q-Mail+

Encrypted mail between Qortal names, with threads, attachments and group mail.

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

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
