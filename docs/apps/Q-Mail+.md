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

_Partial: the pass paused at the MUI 9 step (2026-09-29). Data contract and Qortal call inventory are still to do._

- **Baseline (main):** `npm ci && npm run build` passes; tsc 0 errors; dist 2.2 MB; biggest chunk `index-*.js` 1,688.58 kB (gzip 511 kB). Vite 5.0 built in 16 s.
- **Reachability:** only 129 of 163 files in `src/` are reachable from `main.tsx`. The other 55 are Q-Blog leftovers (Blog* pages, CreatePost/EditPost, BlogEditor, Comments, Tipping, video/audio publish modals, Chat/ChatInput/ShowChatMessage, FlexLayout, MailDownloadWrapper, webworkers). They were never bundled. They are now listed in `tsconfig.json` → `exclude` and their 15 unused dependencies are gone from `package.json` (flexlayout-react, react-grid-layout, react-dnd, tiptap ×4, axios, compressorjs, react-virtuoso, react-masonry-css, react-resize-detector, slate, slate-react, slate-history).
- **React 19 blockers found** (node_modules scan for `findDOMNode`/legacy context): react-quill 2 (editor), react-joyride 2.5 (first-run tour), slate-react 0.91 (renders old `textContent` Slate mail). Peer ranges also blocked `npm install` for react-copy-to-clipboard 5.1.0 and react-intersection-observer 9. All replaced or bumped (see Done).
- **Editor/HTML:** mail bodies are stored as HTML in `textContentV2` and rendered through DOMPurify as plain HTML (`DisplayHtml`), not through Quill. Quill 2 writes bullet lists as `<ol><li data-list="bullet">` and code blocks as nested `<div>`s, which the original app would show as numbered lists / paragraphs. `toQuill1Html()` converts at the two publish points; tests in `quillHtml.test.ts`.
- **Data contract (seen so far, to complete):** direct mail JSON `{ subject, createdAt, version: 1, attachments, textContentV2, generalData: { thread: [], threadV2: [] }, recipient }` published as `MAIL_PRIVATE`; group thread `{ title, groupId, createdAt, name }` at `qortal_qmail_thread_group<groupId>_<uid>` and thread message `{ subject, createdAt, version: 1, attachments, textContentV2, name, threadOwner }` at `qortal_qmail_thmsg_group<groupId>_<threadToken>_<uid>`; legacy bodies in `textContent` (Slate JSON: paragraph, heading-2/3, block-quote, code-block, code-line, link). Encryption, recipient format and identifiers are untouched.
- **Multi-name:** the upstream changelog says 2.2.0 added multi-name support, so `feature/version-2` is probably not needed; not yet verified in code.

## Plan

Remaining order for this pass (overnight mode, see the qplus-app skill):

1. Finish the MUI 9.4 step (7 type errors, listed in Follow-ups) and commit it as `Q-Mail+: upgrade MUI to 9.4`.
2. Checkpoint: theme kit (`src/hub-theme`), `qplus-theme.ts` with Hub 2.0 built from `src/styles/theme.ts` + the `--qmail-*` variables in `index.css`, Settings page with `ThemePicker`, boot snippet in `index.html`; `scripts/build-zip.sh Q-Mail+`; push; open the PR.
3. Data contract + Qortal call inventory (34 direct `/arbitrary/resources` fetches, 4 `limit: 0`), then dedupe/cache and paging.
4. Code-split the composer (Quill), joyride and the audio player; Hub 3.0 layout with phone nav.
5. Features: unread counts, recent recipients, keyboard shortcuts.

## Done

Branch `q-mail-plus/pass-1` (not yet a PR). Every commit builds except the last (WIP):

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
| **WIP:** MUI 9.4 installed, codemods run (v6 list-item/styled/sx-prop, v7 lab/input-label/grid, deprecations/all, v9 system-props; 35 files) | ❌ 7 tsc errors | – |

## Follow-ups

**Unfinished (next session starts here):** the working tree on the WIP commit has MUI 9.4 installed and the codemods applied. `npm run build` fails with exactly these 7 type errors:

1. `src/components/common/UserNavbar/UserNavbar.tsx:107` and `src/pages/Mail/GroupMail.tsx:569`: `<Menu PaperProps={…}>` → `slotProps={{ paper: … }}` (the codemod missed these two).
2. `src/pages/Mail/NewMessage.tsx:1378`: `MenuProps: { PaperProps }` inside a Select → `MenuProps: { slotProps: { paper: … } }`.
3. `src/pages/Mail/NewMessage.tsx:1425`: freeSolo Autocomplete option is now `string | ComposeTargetOption`; guard with `typeof option === 'string' ? option : option.id`.
4. `src/pages/Mail/OpenMail.tsx:225` and `:241`: `deprecations/all` produced two `slotProps` keys in one object; merge them into one.
5. `src/pages/Mail/MailMessageRow.tsx:2`: `@mui/icons-material/DeleteOutline` → `DeleteOutlineOutlined`, then run `scripts/check-mui-icons.sh Q-Mail+`.

Then `npm run build && npm test`, look at the 17 `<MenuItem>` uses (MUI 9 throws for a MenuItem outside Menu/Select), the Menu/Dialog `slotProps`, and check the layout at 1280/700/375 px. Amend or follow the WIP commit with `Q-Mail+: upgrade MUI to 9.4`, then continue with the Plan above.

Other open items:

- **Delete the 55 unreachable files** listed in `tsconfig.json` → `exclude` (tonight's session guard blocked a bulk `git rm`). After deleting, remove the `exclude` list. Simon: OK to delete the Q-Blog leftovers?
- **quill-image-resize-module-react** was dropped (Quill 1 only). The toolbar has no image button, so inline resize was only reachable by pasting an image. If wanted, look at a Quill 2 blot-formatter module.
- **Check Quill 2 mail in the original Q-Mail** in Hub: send a message with a bullet list, numbered list and code block from Q-Mail+ and open it in Q-Mail. The normaliser is unit-tested but not Hub-tested.
- **Joyride 3:** `showSkipButton` no longer exists as a prop; confirm the tour still shows Skip (v3 default) in Hub.
- **tsconfig target** was raised to ES2022 (needed for `Array.prototype.at`); fine for Chromium ≥ 117.
- Multi-name: verify in code that `main` already has the 2.2.0 multi-name inbox before considering `feature/version-2`.
