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

Q-Mail+ goes back to [Qortal/q-mail](https://github.com/Qortal/q-mail) as a pull request, prepared with `scripts/upstream-pr.sh Q-Mail+` (docs/RELEASE.md, stage 4). The first one is [Qortal/q-mail#7](https://github.com/Qortal/q-mail/pull/7) (Q-Mail 4.0.0, from 1.0.2).

- **The branch** is this folder's history split out of `main` with `git subtree split`, on top of Qortal/q-mail `main` (`ddf3aa9`, imported with `git subtree`), so the PR is a fast-forward while upstream hasn't moved. `scripts/upstream-pr.sh Q-Mail+ --check` says whether it still is.
- **The last commit, "Ship as Q-Mail 4.0.0",** turns the + build back into Q-Mail. What it changes is what is specific to the + build:
  - the name in `index.html`, the window title (`Mail.tsx`), the mailboxes header (`layout/Rail.tsx`), the welcome notice (`components/modals/ConsentModal.tsx`), Settings → About, What's new (`pages/Mail/ChangelogPage.tsx`) and the error messages;
  - the theme's storage key `qmailplus-ui-theme` → `qmail-ui-theme` (`index.html`, `theme/qplus-theme.ts`, `e2e/screens.config.mjs`); Q-Mail 3.2.1 keeps its settings under `qmail:*`, so nothing clashes;
  - the version (Qortal's series, one major up: 4.0.0) and one changelog entry for it;
  - a README for the Qortal repo, links to the brief in comments that cite it, and `e2e/screens.mjs`, a standalone copy of `scripts/screens.mjs`.
- **Data notes:** direct mail JSON gains optional top-level `to` and `cc` arrays, and the published mail state (`DOCUMENT_PRIVATE` / `qmail_state_v1`) gains optional top-level `archived` and `settings` maps; readers of the original app ignore all of these. Since 1.0.1, on Qortal DEV's advice, a reply carries nothing from earlier messages: its body has no quote, and `generalData.threadV2` holds `{ reference }` entries without `data` (the newest 10), so replies don't grow with the conversation. The original reader skips entries without `data`, so it opens these replies without their history; the + reader fetches the referenced messages on "Show earlier" and walks back through their own references. New local state lives under new `localStorage` keys (`qmail_read_state_*`, `qmail_archived_*`, `qmail-general-consent`); the original keys keep their shapes.
- **Also specific to the + build,** and simply part of the app once merged: the theme kit copy in `src/hub-theme/` (synced from `shared/hub-theme`, never edited here), the Settings page, the layout shell in `src/layout/`, the `qortalRequest` stub outside Hub in `src/main.tsx`, and the screenshot check config in `e2e/`.
- **The older ready-made branch** [`q-mail-plus/for-upstream`](https://github.com/SJQortal/Q-Apps-Plus/tree/q-mail-plus/for-upstream) stops at the published 1.0.0; the PR replaces it.
