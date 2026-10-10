# Q-Node+

Manage the local Qortal node: status, peers, minting accounts, admin actions.

## Baseline at import

- **Upstream:** [Qortal/Q-Node](https://github.com/Qortal/Q-Node) branch `master` at `fe15445` (2026-02-14, 46 commits)
- **Stack:** React 19, MUI 7, qapp-core 1.0.56, jotai, i18next, Vite 6, TypeScript 5.7
- **Original theme (becomes Hub 2.0):** src/styles/theme/theme.ts
- **i18n:** yes
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 3.3 MB, biggest JS chunk 2.0 MB
- **QDN services:** none (admin API)
- **Identifiers seen (partial; complete this in the audit):** none
- **Qortal calls (counts in source):** ADMIN_ACTION ×11, GET_NODE_STATUS, GET_NODE_INFO, IS_USING_PUBLIC_NODE

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 19 → 19.3, MUI 7 → 9.4. This app uses qapp-core, so add the `overrides` block and the `ErrorOutline` icon alias from PLATFORM.md.
- This is the smallest app (~2.5k lines), a second pilot after Names+.
- `ADMIN_ACTION` only works against the user's own node. The UI must explain clearly when the user is on a public node.
- The import removed the upstream `.claude/settings.json`: it only allowed reading another developer's local folder.

## Feature ideas to weigh in the audit

- live status that polls only while visible
- peer list with sort and filter
- sync progress explained
- minting account health
- confirm dialogs for restart/stop

## Status (2026-09-29, session paused after the overnight checkpoint)

Branch `q-node-plus/pass-1`, PR [#9](https://github.com/SJQortal/Q-Apps-Plus/pull/9). Four commits: platform upgrade, baseline lint fix, test harness, theme kit + Hub 3.0 shell + Settings. Build, tests (11), lint and `sync-theme.sh --check` pass; `scripts/build-zip.sh Q-Node+` writes a 1.1 MB zip. Nothing is half-done in the code. The audit below is from a full read of the app; the plan's efficiency, UX and feature items are **not started**.

## Audit

Baseline lint crashed (string `extends` in the flat config); with it fixed there were 44 errors, now 0. tsc had 0 errors before and after the upgrade.

- **Architecture map:** `main.tsx` → `Root` (I18nextProvider, HubThemeProvider) → `routes/Routes.tsx` (browser router, basename `_qdnBase`) → `AppWrapper` (qapp-core `GlobalProvider`: appName `Q-Node`, publicSalt, authenticate on mount, balance poll every 3 min) → `styles/Layout.tsx` (`useIframe` handles NAVIGATE_TO_PATH / THEME_CHANGED / LANGUAGE_CHANGED; nav rail / bottom bar) → `App.tsx` (the whole dashboard, ~1.8k lines: 7 status widgets, minting accounts table, peers table, data peers table, three add dialogs, two snackbars) and `pages/Settings.tsx`. State is local `useState` in App; jotai holds only rows-per-page and the host colour mode.
- **Data contract:** no QDN resource is read or written. Read-only: avatar URLs `/arbitrary/THUMBNAIL/{name}/qortal_avatar?async=true`, `/names/primary/{address}`, `/peers`, `/peers/data`. localStorage: `q-node-peers-rows-per-page`, `q-node-data-peers-rows-per-page` (upstream), `qnodeplus-ui-theme` (new). qapp-core identity (`Q-Node`, the salt in `qapp-config.ts`) is kept though no data depends on it.
- **Qortal call inventory (first load):** `IS_USING_PUBLIC_NODE` ×1; `GET_NODE_INFO` + `GET_NODE_STATUS` ×1 then every 60 s; `ADMIN_ACTION getmintingaccounts` ×1 once the address is known, then `/names/primary/{address}` per account (N+1, uncached, repeated after every add/remove); `fetch('/peers')` and `fetch('/peers/data')` ×1 then every 120 s each. Three `setInterval` loops keep running while the tab is hidden. Plus qapp-core's auth calls and its balance poll, which this app never shows. Writes, all user-triggered `ADMIN_ACTION` types that Hub confirms: restart, bootstrap, stop, addmintingaccount, removemintingaccount, addpeer, removepeer, forcesync, adddatapeer, removedatapeer.
- **Performance:** one 1.98 MB chunk (MUI + qapp-core; qapp-core is used only for `GlobalProvider`/`useAuth` but pulls in its media players). Settings is lazy (8 KB). Every poll re-renders the whole App, tables included.
- **UX problems, by impact:** (1) restart / bootstrap / stop are one-click icon buttons with no confirmation of the app's own; (2) on a public node every control is silently disabled with no explanation; (3) no loading, empty or error states except a spinner for minting accounts, so peers show "no peers" while loading and sync shows "(undefined%)"; (4) tables with 6–7 columns overflow at phone width; (5) peers cannot be sorted or filtered, and `isTooDivergent` / `lastPing` are not shown; (6) raw 44-character keys and addresses with no copy or shortening.
- **Bugs:** `getNameInfo` treats an error JSON body as a name, so an address without a name shows "undefined" and requests `/arbitrary/THUMBNAIL/undefined/…`; `getConnectedPeers` / `getConnectedDataPeers` have no try/catch (unhandled rejection when the node is unreachable); admin actions that return `{ error }` show neither success nor error; the peers table's filler row uses `colSpan={6}` for 7 columns; if `IS_USING_PUBLIC_NODE` throws everything stays disabled forever. Fixed already: the router was rebuilt on every render, the theme's Dialog/Popover overrides sat outside `components`, and the i18n instance race with qapp-core (below).

## Plan

1. ✅ Test harness. 2. ✅ Theme kit, Settings, four themes.
3. **Efficiency (next):** one polling hook that runs only while `document.visibilityState === 'visible'`, backs off on failure, merges in-flight requests and stops on unmount; try/catch around every fetch with an error state; cache `/names/primary` results for the session; set qapp-core's balance polling to `onlyOnMount: true`.
4. **UX:** confirm dialogs for restart / bootstrap / stop and for remove peer / remove minting account, each saying what happens; a public-node banner explaining why controls are off; skeletons and empty/error states for the three tables; a card layout for peers below 600 px; copy buttons and shortened keys.
5. **Features:** sync explained (own height vs. the highest peer height, blocks behind); peer filter and sort; a last-updated line with manual refresh.
- **Deferred:** splitting App.tsx into Node / Peers / Minting pages, minting-account health (`/addresses/{address}` level and blocks minted), dropping qapp-core.

## Done

- React 19.3, MUI 9.4, Vite 8, TypeScript 5.9; lint fixed (44 → 0 errors); vitest harness with 11 tests.
- Theme kit with Hub 3.0 / Q-Node Classic / Black / White, boot snippet, nav rail + bottom bar, Settings page (Account, Appearance, About with changelog), version 1.0.3-plus.1, README + CHANGELOG entries.
- dist 3.3 MB → 2.5 MB, biggest chunk 2.06 MB → 1.98 MB, zip 1.1 MB. Core calls on first load unchanged (6 + one per minting account).
- Checked in Chromium at 1280 / 700 / 375 px: both pages render, all four themes switch and survive a reload.

## Follow-ups

- **Unfinished, in order:** plan items 3, 4 and 5 above. Start with the polling hook and fetch error handling (App.tsx, the three `useEffect` intervals and `getConnectedPeers` / `getConnectedDataPeers` / `getNameInfo`), then the confirm dialogs and the public-node banner. Each is its own commit; run `npm run build && npm test && npm run lint` and `scripts/sync-theme.sh --check` before pushing to `q-node-plus/pass-1`, then update PR #9.
- **qapp-core i18n race (affects every qapp-core app):** qapp-core does `createInstance().use(initReactI18next)`, which overwrites react-i18next's global default instance with its own. Whichever module initialises last wins, so import order decides whether the app's strings render or show as keys. Q-Node+ passes its instance through `I18nextProvider` in `Root.tsx`. Names+, Q-Tube+ and Q-Trade+ should get the same guard.
- **Question for Simon:** is dropping qapp-core acceptable for this app? It is used only for `useAuth` (address and name in Settings) and gives nothing else here, but costs bundle size and a balance poll every 3 minutes. `GET_USER_ACCOUNT` + `GET_PRIMARY_NAME` would replace it.
- Hub confirms every `ADMIN_ACTION` with its own generic prompt; the app's confirm dialogs (plan item 4) will explain the specific consequence, which Hub's prompt does not.
- Not yet tested inside Hub Dev Mode (cloud session); see the PR's "To test in Hub" list.
