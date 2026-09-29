# Changelog

Newest first. The in-app copy lives in `src/constants/changelog.ts` (Settings → About → What's new).

## 1.0.0-plus.1 (2026-09-30)

- Platform: React 19.3, MUI 9.4, Redux Toolkit 2, react-router 6.30 (v7 flags), Vite 8, TypeScript 5.9, vitest.
- Themes: Hub 3.0 (default), Q-Share Classic, Black and White from the shared theme kit, with a no-flash boot snippet.
- Settings page: active name and name switcher, theme picker, blocked names, About with this changelog.
- Editor: react-quill-new (Quill 2) replaces react-quill; published descriptions are normalised to the Quill 1 markup the original Q-Share stores, and old descriptions render with the app's own styles.
- Qortal efficiency: every search goes through one helper (page of 20, in-flight merge, 2-minute cache, never `limit=0`); comment replies in one prefix search; comment avatars by URL; follow size only on tooltip open; share statistics moved to Settings on demand; download polling stops on READY and pauses while hidden.
- Bundle: moment removed, Quill editor and secondary routes lazy; biggest chunk 1,123 kB → 415 kB.
- UX: Hub 3.0 Home with a filters rail, sort, My shares, empty/error/loading states; labelled row actions with Copy link; share page previews for images, audio and video; profile header; theme colours everywhere.
- Fixes: updated shares are re-fetched (comparison bug), unfollow sends `item`, download intervals cleared, Load more only after a full page, names encoded in paths and links.
- Data: unchanged. Same services, identifiers and JSON as Q-Share.
