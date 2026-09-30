# Q-Tube+

This is the **+ version** of [Q-Tube](https://github.com/Qortal/q-tube), the Qortal video platform, maintained in [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). It reads and writes the same QDN data as the original (videos, playlists, comments, likes and super likes under the `qtube_` identifiers), so both apps show the same content.

What it adds:

- the Hub 3.0 look, with four themes in Settings: Hub 3.0, Q-Tube Classic, Black and White;
- a Settings page: account and name switcher, theme picker, blocked names, and a changelog;
- React 19.3, MUI 9.4, Vite 8 and TypeScript 5.9, with a vitest harness that mocks `qortalRequest`;
- Inter bundled as woff2 instead of twelve Roboto TTF files.

Build it with `npm ci && npm run build`, test with `npm test`, and make the publish zip with `scripts/build-zip.sh Q-Tube+` from the repo root. The vendored `qapp-core-1.0.80.tgz` is intentional: it carries video-player changes that are not on npm.

Upstream's own notes follow in `CONTEXT.md` and `QORTAL.md`.
