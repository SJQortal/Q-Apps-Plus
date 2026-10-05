# Names+

Register, update, buy and sell Qortal names.

## Baseline at import

- **Upstream:** [Qortal/names](https://github.com/Qortal/names) branch `main` at `bdc9c13` (2026-03-22, 11 commits)
- **Stack:** React 19, MUI 7, qapp-core 1.0.41, jotai, i18next, Vite 6, TypeScript 5.7
- **Original theme (becomes Hub 2.0):** src/styles/theme/theme.ts
- **i18n:** yes
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 3.1 MB, biggest JS chunk 1.8 MB
- **QDN services:** THUMBNAIL (avatars)
- **Identifiers seen (partial; complete this in the audit):** `qortal_avatar`
- **Qortal calls (counts in source):** REGISTER_NAME, UPDATE_NAME, SELL_NAME, CANCEL_SELL_NAME, BUY_NAME, GET_ACCOUNT_NAMES, GET_PRIMARY_NAME, PUBLISH_QDN_RESOURCE; `/names/forsale`, `/transactions/unitfee`

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 19 → 19.3, MUI 7 → 9.4. This app uses qapp-core, so add the `overrides` block and the `ErrorOutline` icon alias from PLATFORM.md.
- Upstream committed build junk (`dist.zip`, `.qapp-tunnel.pid`, `.vite/`); the import cleanup removed it. `connect-qapp.sh` and `stop-qapp.sh` are the upstream dev tunnel scripts, kept.
- This app is small (~3k lines) and on the same stack as Torq. **Good pilot for the theme kit**, so do it first.
- Name purchases spend QORT, so keep the buy/sell flows exact.

## Feature ideas to weigh in the audit

- name search with availability check as you type
- marketplace sort and filter (price, length, newest)
- show fee before confirming
- my names dashboard with avatar and primary-name controls

## Audit

Read in full on 2026-09-29 (about 3 000 lines upstream). Ranked by user impact × effort at the end of each list.

### Architecture map

- **Entry:** `src/main.tsx` → `Root` (`HubThemeProvider`, remounted with a new key when Hub sends `THEME_CHANGED`) → `Routes` (`createBrowserRouter`, basename from `window._qdnBase`) → `AppWrapper` (qapp-core `GlobalProvider` with `publicSalt` and `appName: 'names'`, `FetchNamesProvider`, `PendingTxsProvider`, `Layout`).
- **Routes:** `/` My names (`pages/MyNames.tsx`), `/market` (`pages/Market.tsx`, lazy), `/settings` (`pages/Settings.tsx`, lazy). `Layout` owns the rail / bottom bar, the Hub message listener (`hooks/useIframeListener.tsx`: `NAVIGATE_TO_PATH`, `THEME_CHANGED`, `LANGUAGE_CHANGED`) and the data loaders (`hooks/useHandleNameData.tsx`).
- **State:** jotai atoms in `state/global/names.ts`: `namesAtom` (owned names), `primaryNameAtom`, `forSaleAtom`, `pendingTxsAtom` (transactions sent from this session, by type and signature, each with a callback that patches the lists once confirmed), `refreshAtom`; plus the new `namesStatusAtom` / `forSaleStatusAtom`. Two small contexts: pending-transaction helpers and `fetchPrimaryName`.
- **Components:** `components/Tables/NameTable.tsx` (the name list and the Update, Sell, primary-name warning and Avatar dialogs), `components/Tables/ForSaleTable.tsx` (market list and Buy dialog), `components/Tables/PendingTxsTable.tsx`, `components/RegisterName.tsx`, `components/layout/*`, `components/names/ListStates.tsx`.
- **Node access:** reads in `src/api/names.ts`; writes stay in the components that own the flow.

### Data contract (binding, CLAUDE.md rule 1)

| Kind | Call | Shape |
|---|---|---|
| read | `qortalRequest GET_ACCOUNT_NAMES {address, limit, offset, reverse}` | `NameData[]`: `{name, reducedName, owner, data, registered, updated?, isForSale, salePrice?}` (app uses `name`, `owner`) |
| read | `qortalRequest GET_PRIMARY_NAME {address}` | `string` (the name) |
| read | `GET /names/forsale?limit&offset&reverse` | `NameData[]` ordered by name; app uses `name`, `salePrice`, `owner`, `registered` |
| read | `GET /names/{name}` | `NameData`, or `{error, message: "name unknown"}` for a free name (reduced-name match, so case-insensitive) |
| read | `GET /transactions/unitfee?txType=…` | text, fee in QORT satoshis (1e8) |
| read | `GET /arbitrary/resources/searchsimple?service=THUMBNAIL&identifier=qortal_avatar&name=…(&name=…)&limit=n` | `[{name, service, identifier, …}]`; exact matches when `prefix`/`caseInsensitive` are absent |
| read | `GET /arbitrary/THUMBNAIL/{name}/qortal_avatar` | the avatar image (only ever loaded lazily by `<img>`) |
| read | `GET /transactions/signature/{sig}` | transaction JSON; `blockHeight` present once confirmed |
| write | `REGISTER_NAME {name}` · `UPDATE_NAME {newName, oldName}` · `SELL_NAME {nameForSale, salePrice}` · `CANCEL_SELL_NAME {nameForSale}` · `BUY_NAME {nameForSale}` | unchanged from upstream, byte for byte |
| write | `PUBLISH_QDN_RESOURCE {service: THUMBNAIL, identifier: qortal_avatar, name, base64}` | the shared Qortal avatar; unchanged |

QDN service used: **THUMBNAIL**. Identifier: **`qortal_avatar`** (shared with Hub and every other app). No app-specific identifiers exist, and this pass adds none. qapp-core config (`publicSalt`, `appName: 'names'`) is unchanged.

### Qortal call inventory (upstream → now)

| When | Upstream | Now |
|---|---|---|
| App mount (qapp-core) | `GET_USER_ACCOUNT`, balance every 180 s | same (qapp-core config untouched) |
| Layout mount | `/names/forsale?limit=0` **unlimited**, repeated every 120 s by `setInterval` whatever the tab state | pages of 100 until a short page (first page painted at once), refreshed every 120 s **only while visible**, backoff on error |
| Layout mount, per address | `GET_ACCOUNT_NAMES limit: 0` | pages of 100 |
| Layout mount | `GET_PRIMARY_NAME` | same |
| Every name row mount, again on every refresh | `searchsimple … &name=<one>` per name through a queue of 2 (**N+1**), negative answers never cached | **one** exact-match search per 50 names, both answers cached 5 min, in-flight merged; a publish forgets that one name |
| Every name row | avatar `<img>` | same, `loading="lazy"`, name URL-encoded |
| Register dialog mount, Update dialog every open | `/transactions/unitfee` | once per transaction type per session (`REGISTER_NAME`, `UPDATE_NAME`, `SELL_NAME`, `BUY_NAME`) |
| Always | `/transactions/signature/{sig}` for each pending tx every 80 s, interval recreated on every state change, even with nothing pending | only while something is pending and the tab is visible; first check after 80 s |
| Typing a name | `/names/{name}` after 500 ms, out-of-order answers could win | same call, name encoded, length validated first, late answers ignored |

First load with N owned names and M names for sale: **4 + N** requests before (plus N images) → **4 + ⌈M/100⌉ − 1 + ⌈N/50⌉** now (`FOR_SALE_PAGE`, `AVATAR_BATCH` in `src/api/names.ts`); a typical account (3 names, 200 for sale) goes from 7 to 6 requests, and an account with 40 names from 44 to 6. Tests in `src/api/names.test.ts` and `src/hooks/useVisiblePolling.test.ts` count them.

### Performance

- Upstream dist 3.1 MB with 1.2 MB of Inter TTFs and a 1.92 MB JS chunk. Now: dist 2.5 MB, zip 1.1 MB, biggest chunk 1.58 MB (482 KB gzip), app code 404 KB.
- The 1.58 MB chunk is almost entirely **qapp-core 1.0.41**, which is one ESM file that pulls in **video.js**, react-rnd, dexie, crypto-js and more. Names+ never renders a video (`enableGlobalVideoFeature: false`), but the import is unconditional, so tree-shaking can't drop it. See Follow-ups for the two ways out.
- Both lists are virtualised (react-virtuoso), so images only load for visible rows.
- The theme remount on `THEME_CHANGED` remounts `GlobalProvider` too (kit limitation, see Follow-ups); this only happens when the user flips Hub's own theme.

### UX problems found (upstream)

1. Two MUI tables with three buttons per row: unusable below 600 px, and the table header repeated "Actions" untranslated. *(fixed)*
2. No loading, empty, error or signed-out states: an empty table while loading, forever, if the node call failed. *(fixed)*
3. Buying spent QORT with no in-app confirmation of price or fee; the price column had no unit. *(fixed)*
4. Sell dialog opened with `0` in the price field and accepted any number. *(fixed)*
5. Pending transactions showed raw types (`REGISTER_NAME`) and `name: x`. *(fixed)*
6. Market sort only by name and price via hidden header clicks; no length or newest. *(fixed)*
7. Register dialog had a fixed 400×250 box, an empty `<label>` in an unbundled font, and no hint about name rules. *(fixed except the box, which is fine at phone width)*
8. No Settings page at all. *(Account, Appearance, About done; app options and QDN sync deferred)*

### Bugs (upstream), with the fixing commit

- `RegisterName.tsx`: `t('balance_message')` had no namespace → the raw key showed under the fee warning. *(87bd27a)*
- `NameTable.tsx`: `update_name.balanceInfo` and `new_name.checking` don't exist → raw keys; the Update success toast used the *loading* text; the avatar error toast used the *loading* text; refusing to update a primary name said "Set avatar". *(87bd27a)*
- `NameTable.tsx`: the primary-name guard used the **filtered** list's length, so filtering to the primary name enabled Update and Sell on it. *(87bd27a)*
- `NameTable.tsx`, `RegisterName.tsx`: names were not URL-encoded in the avatar image URL, the avatar search and `/names/{name}`, so names with spaces or non-ASCII characters broke. *(87bd27a)*
- `useHandleNameData.tsx`: `clearPendingTxs('REGISTER_NAMES', …)` (typo) never cleared confirmed registrations on refetch. *(87bd27a)*
- Availability check: a slow answer for an earlier name could overwrite the current one. *(87bd27a)*
- Avatar search used `prefix=true`, which also prefix-matches the **name**: `bob` appeared to have an avatar if `bobby` had one. *(now exact; b77f25c)*
- Update dialog showed `REGISTER_NAME`'s fee; it now asks for `UPDATE_NAME`'s. *(b77f25c)*

### Missing features weighed

| Idea | Verdict |
|---|---|
| Availability check as you type with validation | done: debounced, length limits from Core, race-free |
| Marketplace sort and filter (price, length, newest) | done |
| Show fee before confirming | done for Buy (dialog), Sell and Register/Update (inline) |
| My names dashboard with avatar and primary-name controls | header shows primary name and count; chips mark primary and for-sale. No Core/Hub action to *set* a primary name from a Q-App was found, so no control (question for Simon) |
| Search all registered names (`/names/search?query=`) | not done; additive, good next feature |
| Settings: default sort, density, sync to QDN | not done |

## Plan

This pass, in order (all done unless marked):

1. Platform upgrade to React 19.3 + MUI 9.4 (1aaa792), lint baseline (d236dcb).
2. Test harness: vitest + jsdom, `qortalRequest` and `fetch` mocks that record every call (9359e39).
3. Theme kit, four themes, Hub 3.0 shell, Settings page (3065b2d).
4. Upstream bug fixes (87bd27a).
5. Efficiency: paged lists, batched avatar check, cached fees, visibility-aware polling, with tests (b77f25c).
6. UX redesign of My names and Market with states, phone menu, sort chips, buy and sell confirmations (77187c3).
7. Brief, README, changelog, version (this commit).

Deliberately deferred: stubbing video.js out of qapp-core's bundle (needs a Hub test), Settings app options and QDN sync, name search, any change to the write actions.

## Done

- **Build:** green. `npm test` 24 tests in 6 files, `npm run lint` clean, `scripts/sync-theme.sh --check` clean, `scripts/build-zip.sh Names+` → 1.1 MB.
- **Sizes:** dist 3.1 MB → 2.5 MB; zip 1.1 MB; biggest chunk 1.92 MB → 1.58 MB (qapp-core); app code 404 KB.
- **Requests on first load:** 4 + N (N = owned names) → 4 + ⌈N/50⌉ (+ ⌈M/100⌉ − 1 pages for M names for sale). Polling: two always-on intervals → two visibility-aware timers, the transaction check only while something is pending.
- **Screens:** desktop rail, 700 px compact rail and 375 px bottom bar checked in Chromium with a mocked node (screenshots in the session, not committed) for Hub 3.0, White and Black. Hub itself not tested from this cloud session.
- **Version:** 1.0.0-plus.1, changelog in Settings → About.

## Follow-ups

**Please test in Hub (needs a node):**

1. The batched avatar lookup: `/arbitrary/resources/searchsimple?service=THUMBNAIL&identifier=qortal_avatar&name=a&name=b&limit=2` against the local node should return only the names that have an avatar (verified against Core's source, not a running node).
2. Buy flow: the new dialog, then Hub's own confirmation; the total shown should match what Hub charges. Sell flow with a decimal price.
3. Update name: the dialog now shows `UPDATE_NAME`'s unit fee instead of `REGISTER_NAME`'s. If Hub charges the registration fee for an update, switch it back (one line in `NameTable.tsx`).
4. Hub theme flip (`THEME_CHANGED`) remounts the app: check the list survives and no duplicate auth prompt appears.
5. `qortal://APP/Names+` deep link and the `/market` route under `/render/APP/Names+`.

**Questions for Simon:**

6. Is there a Hub or Core action to *set* an account's primary name from a Q-App? If yes, the dashboard header is the place for it.
7. Should the market hide names owned by the viewer, or keep showing them disabled (upstream behaviour, kept)?

**Next pass:**

8. **Bundle:** try `resolve.alias` of `video.js` to an empty module in `vite.config.ts` (qapp-core imports it at module scope for a player this app never renders); check the console in Hub. Or ask Qortal to split qapp-core's player into a sub-path export. Expected: roughly −600 KB.
9. **Kit:** `HubThemeProvider` reads Hub's mode once at mount. A `hostMode` prop (or the provider listening to `THEME_CHANGED` itself) would avoid the remount in `Root.tsx`.
10. Settings: default market sort, row density, and settings sync to QDN under the user's name (Torq's `settingsQdn.ts`), which would be the app's first own identifier (propose `namesplus_settings`).
11. Name search across all registered names (`GET /names/search?query=&prefix=&limit=`) as a "Find a name" box on the market page.
12. `/names/forsale` is loaded 100 at a time up to 50 pages; a node with more than 5 000 names for sale would be truncated (a console warning says so). Server-side price sorting would need a Core change.
13. The new strings in de/es/fr/it/ru/zh were written by the session; a native check is welcome.
