# Q-Share+

This is the **+** version of [Qortal's Q-Share](https://github.com/Qortal/q-share), the public file-sharing Q-App, maintained in [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). It reads and writes the same QDN data as the original: your shares, files and comments show up in both, and anything published here still works in Q-Share.

What it adds:

- the Hub 3.0 look with four themes (Hub 3.0, Q-Share Classic, Black, White) and a Settings page;
- the current stack: React 19.3, MUI 9.4, Vite 8, with a vitest harness;
- a Quill 2 description editor that keeps the stored format readable in the original app.

See `CHANGELOG.md` for versions and `docs/apps/Q-Share+.md` in the monorepo for the audit, plan and status.

## Develop

```bash
npm ci
npm run dev        # Qortal calls need Hub; tests use the mocks in src/test/setup.ts
npm test
npm run build
```

Publish zips are built from the monorepo root with `scripts/build-zip.sh Q-Share+`.
