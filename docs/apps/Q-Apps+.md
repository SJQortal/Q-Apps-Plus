# Q-Apps+

New launcher that presents every + app in one user-friendly place.

## Baseline at import

- **Upstream:** none (new app)
- **Stack:** New. React 19.3, MUI 9.4, jotai, react-router 7, Vite 8 (Rolldown), TypeScript 5.9, vitest 5 (docs/PLATFORM.md). No qapp-core: the launcher only needs `qortalRequest`
- **Original theme (becomes Hub 2.0):** none of its own. Hub 2.0 is offered as "Qortal Classic": the standard Q-App template palette (the one Names, Q-Node and Q-Tube shipped with), so it sits in the family with the other + apps
- **i18n:** English-only; all copy is in components, no i18n library yet
- **Tests:** vitest + jsdom + Testing Library, `qortalRequest` mocked per action in `src/test/setup.ts`
- **QDN services:** APP (reads metadata of the + apps and their originals), THUMBNAIL (app icons = each name's `qortal_avatar`)
- **Identifiers:** none of its own. Reads `qortal_avatar` thumbnails. Publishes nothing
- **Qortal calls:** SEARCH_QDN_RESOURCES ×1 (service APP, `names` + `exactMatchNames`), GET_QDN_RESOURCE_STATUS ×1 (per app page), OPEN_NEW_TAB ×1 (per open), GET_USER_ACCOUNT / GET_PRIMARY_NAME / GET_ACCOUNT_NAMES (only when the user taps "Show my name" in Settings)

## Notes

- Built on branch `q-apps-plus/first-version` (2026-09-29/30). The other apps' passes haven't merged yet, so the per-app "What the + version adds" lists come from each brief's feature ideas. Confirm them once the passes land (see Follow-ups).
- Content comes from a static manifest in the app (name, tagline, category, what's new, upstream app) plus live QDN metadata for each `APP` resource (last updated, size). One batched search with `names` + `exactMatchNames`, not one search per app.
- Opening an app: `OPEN_NEW_TAB` with `qortal://APP/<encodeURIComponent(name)>`. Test in Hub that names with `+` open (Follow-ups).
- Nice touches done: "what the + version adds" per app, "compared with the original" section with the original's QDN date and an Open original button, and the same Hub 3.0 theme as the others.

## Feature ideas to weigh in the audit

- search and categories ✅
- recently opened ✅
- app detail page with screenshots and changelog: detail page ✅, screenshots and per-app changelog deferred (Follow-ups)
- link to each app's original version ✅

## Audit

Written for the first version rather than an inherited codebase.

### Architecture map

- `index.html`: Hub boot script (from Torq): `<base href>` for `/render/APP/Q-Apps+/`, theme-kit paint before React, strips Hub's `?theme=&lang=&identifier=&time=` from the visible URL, posts `QDN_RESOURCE_DISPLAYED` to Hub.
- `src/main.tsx`: `HubThemeProvider` (storage key `qappsplus-ui-theme`) → `BrowserRouter` with `basename = resolveQdnBase()` → `App`.
- `src/App.tsx`: routes `/` (Home), `/app/:name` (App page, lazy), `/settings` (lazy), `/index.html` and `*` → `/`. `HubNavigationReporter` posts every route change to Hub (`notifyHubDisplayedPath`). `ToastProvider` gives snackbars.
- `src/components/Layout.tsx`: desktop left rail (≥ 600 px; labels from 900 px), phone bottom nav (< 600 px, safe-area aware), sticky translucent `PageHeader` that hides on scroll-down on phones, `Page`, `Section`, `SectionTitle`, `Card`.
- `src/apps/manifest.ts`: the ten apps, four categories, per-app "adds", shared improvements, upstream repos, search matcher. `allQdnNames()` = the 20 names looked up on QDN.
- `src/qortal/`: `request.ts` (host detection, `NoQortalError`, `describeError`), `appResources.ts` (batched search, TTL cache, in-flight dedupe, status), `openApp.ts` (`appLink`, `OPEN_NEW_TAB`), `hubLocation.ts` (base, app name, Hub history), `avatar.ts`.
- `src/state/settings.ts`: jotai `atomWithStorage` for recent apps, favourites, layout (grid/list), show-recent, show-originals.
- `src/hooks/`: `useAppResources` (one search per name-set; cached data shown at once; refresh on `visibilitychange` when stale), `useOpenApp` (open + remember + explain), `useNow` (minute clock via `useSyncExternalStore`, paused when hidden), `usePhoneLayout`, `useHideOnScroll`.
- `src/pages/`: `HomePage` (search, category chips, favourites, recently opened, grouped grid/list), `AppDetailPage` (hero, about, adds, shared, On QDN with download status, compared with the original), `SettingsPage` (Account, Appearance, Launcher, About + changelog).

### Data contract (binding)

| Read/write | Service | Name | Identifier | Notes |
|---|---|---|---|---|
| read | APP | the 10 + names and their 10 originals | (none) | `SEARCH_QDN_RESOURCES` with `names`, `exactMatchNames: true`, `includeMetadata: true`, `mode: 'LATEST'`, `limit = names.length` (20), `offset: 0` |
| read | APP | one + name | (none) | `GET_QDN_RESOURCE_STATUS` on the app page |
| read | THUMBNAIL | each name | `qortal_avatar` | `<img loading="lazy">` from `/arbitrary/THUMBNAIL/<name>/qortal_avatar?async=true`, fallback to a bundled icon |

The launcher publishes nothing and spends nothing. Its own state (theme, favourites, recent, layout) is `localStorage` under `qappsplus-*`.

### Qortal call inventory

| Call | When | How often |
|---|---|---|
| `SEARCH_QDN_RESOURCES` (APP, 20 names) | Home or App page mount | 1 per 3 minutes at most (session cache + in-flight dedupe); again on Refresh or when the tab becomes visible after the TTL |
| `GET_QDN_RESOURCE_STATUS` | App page mount | 1 per app page; READY cached 3 min, other states 5 s |
| `OPEN_NEW_TAB` | Open button | 1 per tap |
| `GET_USER_ACCOUNT` → `GET_PRIMARY_NAME` → `GET_ACCOUNT_NAMES` | Settings → "Show my name" | only on tap (Hub asks for permission) |
| THUMBNAIL image loads | cards scroll into view | ≤ 10 + originals in Settings, lazy, failures remembered for 60 s |

No `limit: 0`, no polling, no N+1: the test `HomePage.test.tsx` asserts exactly one search on first load.

### Performance

- dist 1.1 MB, zip 616 KB. JS: `mui-core` 299 KB (95 KB gzip), `react-vendor` 258 KB (82 KB gzip), app `index` 58 KB (20 KB gzip), App page 7 KB and Settings 8 KB lazy. Inter woff2 ×4 = 426 KB (the kit's fonts; the largest part of the zip).
- Nothing else is heavy: no editors, charts or media libraries.

### UX

- Every screen has loading (skeleton status lines, skeleton page while a lazy route loads), empty ("No apps match…", "Not on QDN yet", "Nothing yet") and error states (Retry on the search failure, plain-words toasts on open failures).
- Outside Hub the page says so once (an info alert) instead of failing per card.
- Phone: bottom nav, one-column cards, header hides on scroll, safe-area insets.
- Accessibility: every icon button has an `aria-label`, favourites use `aria-pressed`, focus is visible in `primary`, reduced motion honoured.

### Bugs and risks found while building

- Vite 8 (Rolldown) removed the object form of `manualChunks`; `build.rollupOptions.output.codeSplitting.groups` is used instead.
- The react-hooks 7 rules (React Compiler lint) reject `Date.now()` in render and synchronous `setState` in effects; `useNow` and promise-callback effects were written to satisfy them.
- Whether Hub matches names containing `+` with `exactMatchNames`, and whether `OPEN_NEW_TAB` opens `qortal://APP/Q-Mail%2B`, can only be checked in Hub (Follow-ups).

## Plan

1. Theme kit, Settings page and the four themes ✅
2. Static manifest + one batched APP search with cache and dedupe ✅
3. Home: search, categories, favourites, recently opened, grid/list ✅
4. App page: adds, shared improvements, QDN details + download status, compared with original ✅
5. Test harness + tests for the search contract, links, routing under Hub, settings and the Home screen ✅
6. Deferred: screenshots per app (needs images from the finished apps), per-app changelog on the app page (needs each app's published changelog; a `DOCUMENT` per app would be a new, additive resource), ratings (Hub's rating scheme to confirm), i18n.

## Done

- First version 1.0.0 on React 19.3 + MUI 9.4 + Vite 8, theme kit synced (`scripts/sync-theme.sh --check` clean).
- Searches on first load: **1** (20 names, exact match, limit 20). App page adds **1** `GET_QDN_RESOURCE_STATUS`.
- Bundle: biggest chunk `mui-core` 299 KB (95 KB gzip); app code 58 KB; dist 1.1 MB; `release/Q-Apps+.zip` 616 KB with `index.html` at the root.
- Tests: 7 files, 28 tests (`npm test`); `npm run lint` clean of errors (7 fast-refresh warnings on files that export both components and helpers); `npm run build` passes.
- Not yet tested in Hub (cloud session). See Follow-ups for the Hub checklist.

## Follow-ups

Questions for Simon:

1. **Original app names on QDN.** The manifest assumes `Q-Mail`, `Q-Shop`, `Q-Share`, `Q-Support`, `Q-Tube`, `Q-Trade`, `Q-Fund`, `names`, `Q-Node` and `Q-Mintership`. Please check each opens from the app page's "Open original" button and correct `src/apps/manifest.ts` if not.
2. **Names with `+` in Hub.** Check in Hub Dev Mode that (a) the batched search returns rows for the + names (Hub must URL-encode `names`), and (b) `OPEN_NEW_TAB` with `qortal://APP/Q-Mail%2B` opens Q-Mail+. If either fails, the fallback is `qortal://APP/Q-Mail+` unencoded; note the exact failure here.
3. **App icons.** Cards show each name's `qortal_avatar`. Set avatars for the + names (or tell me if the launcher should ship bundled icons instead).
4. **"What the + version adds" lists** come from the other briefs' feature ideas. Once each pass merges, replace them with what actually shipped (each app's Settings → About).
5. **Ratings.** The brief mentioned "rating if available". Hub's app-rating scheme (polls) wasn't confirmed; left out for now.
6. **GO.** `OPEN_NEW_TAB` and the bottom nav need a check on a phone.

Hub test checklist (local session, docs/HUB-TESTING.md): four themes and a Hub light/dark switch; 1280 / 700 / 375 px; one search in the console on load; Open for each app; the App page's "On this node" status; Settings → Show my name; deep link `qortal://APP/Q-Apps+/app/Q-Mail%2B`.

Ideas for the next pass: screenshots on the app page; per-app changelog pulled from each app; "installed on this node" badge on cards (from one `includeStatus` search, if it proves cheap); pin favourites to the top of the Hub tab bar via Hub's own list, if Hub exposes it; i18n with the same locale set as Q-Tube+.
