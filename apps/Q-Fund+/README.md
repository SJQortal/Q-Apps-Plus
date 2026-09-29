# Q-Fund+

This is Simon's **+ version** of the official Qortal Q-Fund app, part of the
[Q-Apps+](https://github.com/SJQortal/Q-Apps-Plus) monorepo. It reads and
writes exactly the same QDN resources as the original
([Qortal/q-fund-v2](https://github.com/Qortal/q-fund-v2)), so campaigns,
updates, comments and donations made in either app show up in both.

What the + version adds so far (see `docs/apps/Q-Fund+.md` in the monorepo
for the full brief and status):

- React 19.3 and MUI 9.4, with the editor on react-quill-new (Quill 2) and
  MUI X date pickers 9.
- The four Hub 3.0 themes (Hub 3.0, Q-Fund Classic, Black, White) and a
  Settings page with a changelog.
- A vitest test harness with a `qortalRequest` mock that can never publish or
  spend QORT.

## Commands

```bash
npm ci
npm run dev       # vite dev server (Qortal calls need Hub; use the test mocks)
npm test          # vitest
npm run build     # tsc + vite build
```

Simon publishes the app to QDN as `Q-Fund+` from the zip that
`scripts/build-zip.sh Q-Fund+` produces.
