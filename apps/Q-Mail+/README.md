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
