# Q-Apps+

**This is the launcher for the + apps.** It is a new Qortal Q-App, not a copy of an upstream one: one user-friendly place to discover and open Q-Mail+, Q-Shop+, Q-Share+, Q-Support+, Q-Tube+, Q-Trade+, Q-Fund+, Names+, Q-Node+ and Q-Mintership+.

What it does:

- lists every + app with its tagline, grouped by category, with search, favourites and a Recently opened row;
- shows live QDN details for each app (last published, size) from **one** batched `SEARCH_QDN_RESOURCES` (`names` + `exactMatchNames`), cached for the session;
- opens an app with `OPEN_NEW_TAB` on `qortal://APP/<name>` (names contain `+`, so they are always URL-encoded);
- has an app page with what the + version adds, the QDN publish details, the download status on this node, and a link to the original app;
- ships the Hub 3.0 theme kit with the four themes, a Settings page and a changelog.

Stack: React 19.3, MUI 9.4, jotai, react-router 7, Vite 8, TypeScript 5.9, vitest 5. See `docs/apps/Q-Apps+.md` in the repo root for the brief.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5180 — Qortal calls need Hub, so the page explains it is outside Hub
npm test
npm run lint
npm run build
```

From the repo root, `scripts/build-zip.sh Q-Apps+` writes `release/Q-Apps+.zip` for publishing as `APP` under the name `Q-Apps+`.

The theme kit in `src/hub-theme/` is a copy of `shared/hub-theme`; never edit it here.
