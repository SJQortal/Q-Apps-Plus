# Q-Mail+

**This is Simon's "+" version of [Q-Mail](https://github.com/Qortal/q-mail)**, the encrypted mail app for Qortal names. It reads and writes exactly the same QDN resources as the original (services, identifiers, encryption), so your mail shows up in both apps.

What the + version adds:

- the Hub 3.0 look with four themes (Hub 3.0, Q-Mail Classic, Black, White) and a real Settings page;
- a layout that works on phones and in GO, not only on wide desktop windows;
- fewer and cheaper QDN calls, and a smaller bundle;
- the obvious missing mail features (see `CHANGELOG.md`).

It lives in the [Q-Apps+](https://github.com/SJQortal/Q-Apps-Plus) monorepo under `apps/Q-Mail+/`. The upstream history is kept with `git subtree`.

## Develop

```bash
npm ci
npm run dev        # Vite dev server; Qortal calls need Hub Dev Mode
npm test           # vitest (qortalRequest is mocked in src/test/setup.ts)
npm run build      # tsc + vite build
```

The theme kit in `src/hub-theme/` is a copy of `shared/hub-theme` in the monorepo. Never edit the copy; edit the shared kit and run `scripts/sync-theme.sh`.

## Merging this back into Q-Mail

- The upstream history is intact: the app was imported from [Qortal/q-mail](https://github.com/Qortal/q-mail) `main` at `ddf3aa9` with `git subtree`, and every + commit sits on top. `git log --oneline -- apps/Q-Mail+` shows the full series; `scripts/sync-upstream.sh --check` reports new upstream commits.
- **Data notes:** direct mail JSON gains optional top-level `to` and `cc` arrays, and the published mail state (`DOCUMENT_PRIVATE` / `qmail_state_v1`) gains optional top-level `archived` and `settings` maps; readers of the original app ignore all of these. Since 1.0.1, on Qortal DEV's advice, a reply carries nothing from earlier messages: its body has no quote, and `generalData.threadV2` holds `{ reference }` entries without `data` (the newest 10), so replies don't grow with the conversation. The original reader skips entries without `data`, so it opens these replies without their history; the + reader fetches the referenced messages on "Show earlier" and walks back through their own references. New local state lives under new `localStorage` keys (`qmail_read_state_*`, `qmail_archived_*`, `qmail-general-consent`); the original keys keep their shapes.
- **Specific to the + build:** the theme kit copy in `src/hub-theme/` (synced from `shared/hub-theme`, never edited here), the Settings page, the layout shell in `src/layout/`, the `qortalRequest` stub outside Hub in `src/main.tsx`, and the screenshot check config in `e2e/`.
- **Ready-made branch:** [`q-mail-plus/for-upstream`](https://github.com/SJQortal/Q-Apps-Plus/tree/q-mail-plus/for-upstream) is this folder's history as a repository of its own, split at the published 1.0.0. It sits on top of Qortal/q-mail `main` up to `ddf3aa9`, with the original commit hashes, so the merge is a fast-forward while upstream hasn't moved. In a clone of Qortal/q-mail:

  ```bash
  git fetch https://github.com/SJQortal/Q-Apps-Plus.git q-mail-plus/for-upstream
  git merge FETCH_HEAD
  ```

  To include later changes, split it again in a clone of SJQortal/Q-Apps-Plus with `git subtree split --prefix="apps/Q-Mail+" origin/main -b q-mail-plus`. The platform upgrade commits (React 19.3, MUI 9.4, react-quill-new) come first in the series.
