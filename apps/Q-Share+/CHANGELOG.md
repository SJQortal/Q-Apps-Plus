# Changelog

Newest first. The in-app copy lives in `src/constants/changelog.ts` (Settings → About → What's new).

## 1.0.0-plus.1 (2026-09-30)

- Platform: React 19.3, MUI 9.4, Redux Toolkit 2, react-router 6.30 (v7 flags), Vite 8, TypeScript 5.9, vitest.
- Themes: Hub 3.0 (default), Q-Share Classic, Black and White from the shared theme kit, with a no-flash boot snippet.
- Settings page: active name and name switcher, theme picker, blocked names, About with this changelog.
- Editor: react-quill-new (Quill 2) replaces react-quill; published descriptions are normalised to the Quill 1 markup the original Q-Share stores, and old descriptions render with the app's own styles.
- Data: unchanged. Same services, identifiers and JSON as Q-Share.
