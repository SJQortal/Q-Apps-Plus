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
- **Data notes:** nothing published changed shape. Direct mail JSON gains optional top-level `to` and `cc` arrays; the published mail state (`DOCUMENT_PRIVATE` / `qmail_state_v1`) gains optional top-level `archived` and `settings` maps; replies embed the previous message without its own `generalData` history. Readers of the original app ignore all of these. New local state lives under new `localStorage` keys (`qmail_read_state_*`, `qmail_archived_*`, `qmail-general-consent`); the original keys keep their shapes.
- **Specific to the + build:** the theme kit copy in `src/hub-theme/` (synced from `shared/hub-theme`, never edited here), the Settings page, the layout shell in `src/layout/`, the `qortalRequest` stub outside Hub in `src/main.tsx`, and the screenshot check config in `e2e/`.
- To merge back, cherry-pick the `Q-Mail+:` commits in order or diff `apps/Q-Mail+/src` against upstream `src`; the platform upgrade commits (React 19.3, MUI 9.4, react-quill-new) come first.
