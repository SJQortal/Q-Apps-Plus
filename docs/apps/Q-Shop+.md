# Q-Shop+

Decentralised shops: sellers publish a store and products; buyers order and pay in QORT or other coins.

## Baseline at import

- **Upstream:** [Qortal/q-shop](https://github.com/Qortal/q-shop) branch `main` at `0738e27` (2024-04-17, 18 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 4, TypeScript 4.9
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 2.9 MB (1.9 MB of it ten font files), biggest JS chunk 887 KB (282 KB gzip), tsc 0 errors
- **After the platform upgrade (React 19.3 + MUI 9.4, branch `q-shop-plus/pass-1`):** tsc 0 → 27 errors after the MUI 9 bump → 0 after fixes; biggest chunk 887 KB → 1029 KB (MUI 9 is larger, nothing is code-split yet); dist 2.1 MB after removing seven unused font files; zip 1.1 MB
- **QDN services:** STORE, PRODUCT, DOCUMENT, DOCUMENT_PRIVATE, VIDEO, AUDIO, THUMBNAIL
- **Identifiers seen (partial; complete this in the audit):** store/product/order identifiers (collect during the audit); leftovers `qvideo_qblog_`, `qaudio_qblog_`, `qortal_qmail_` from the Q-Blog template it was built from; `qortal_avatar`
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×13, FETCH_QDN_RESOURCE ×6, GET_NAME_DATA ×4, GET_ACCOUNT_DATA ×4, GET_USER_WALLET ×3, DECRYPT_DATA ×3, SEND_COIN ×2; `/crosschain/price` for coin prices

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- This has the oldest upstream code (last commit 2024-04-17). `package.json` is still named `q-blog`.
- Payments go through `SEND_COIN`, and orders are encrypted (`DOCUMENT_PRIVATE`). Treat checkout and order code as money code: keep the flow identical unless the plan says otherwise, and test it.

## Feature ideas to weigh in the audit

- product search and filters
- cart that survives reload
- clear order status for buyers and sellers
- seller dashboard
- price shown in several coins

## Audit

_Partial (session 1 stopped at the checkpoint). The full deep dive is the first job of the next session._

- **Architecture:** `main.tsx` → `BrowserRouter basename=_qdnBase` → `App.tsx` (Redux `Provider` → `HubThemeProvider` → `Notification` → `GlobalWrapper` → routes). Routes: `/` StoreList, `/:user/:store` Store, `/:user/:store/:product/:catalogue` ProductPage, `/product-manager/:store` ProductManager, `/my-orders` MyOrders, `/settings` SettingsPage (new). `GlobalWrapper` does boot (GET_USER_ACCOUNT, name lookup, avatar, my-stores search), owns the create/edit store modals, the Navbar and the Cart drawer. Slices: auth, global (current own store, data container, products, my orders), store (viewed store, hash maps, reviews, preferredCoin), cart, order, notifications.
- **Dead code removed:** 26 files unreachable from `main.tsx` (Slate editor, video/audio publish modals, workers, fetchMail…) and their packages. 13 unused SVG components remain in `src/assets/svgs/` (harmless).
- **Data contract (identifiers seen so far; complete before touching data code):** STORE `q-store-general-<shortStoreId>`; DOCUMENT `<storeId>-datacontainer` (the product index: `{storeId, shortStoreId, owner, products: {productId: {created, priceQort, category, catalogueId, status}}}`); DOCUMENT `q-store-catalogue-…` (batches of products); PRODUCT `q-store-product-…`; DOCUMENT_PRIVATE `q-store-order-<shortStoreId>-…` (encrypted, buyer publishes; seller status via a second DOCUMENT_PRIVATE); DOCUMENT `q-store-review-<shortStoreId>-<id>-<rating×10>` (rating is parsed from the identifier); Hub list `blockedNames_q-blog`; localStorage `productsToSave`; localforage `general-consent`. Validators are in `src/utils/checkStructure.ts` (now under test). New + keys: localStorage `qshopplus-ui-theme`, `qshopplus-settings`.
- **Qortal calls flagged:** two `limit: 0` searches (`GlobalWrapper.tsx` ~679 and `Store.tsx` ~421, both "does the data container exist" checks: use `limit: 1`); `getStoreAverageReview` searches 100 reviews with `query=` substring matching (`Store.tsx` ~493); `/crosschain/price/PIRATECHAIN` is fetched separately in Store, Cart and ProductPage with no cache; store list and reviews page with `query=` where `identifier=` + `prefix=true` would be narrower; no polling loops. Full inventory and first-load counts still to do.
- **Bugs fixed:** `includes("Android" || "iOS")` only matched Android (`GlobalWrapper.tsx`). **Bugs seen, not fixed:** `StoreCard.tsx` copies links as `qortal://APP/Q-Store/…` (the app is Q-Shop; should be `Q-Shop+`); `Store.tsx` share link points at `Q-Shop` not `Q-Shop+`; Q-Mail links should go to `Q-Mail+`.
- **Styling debt:** ~80 `theme.palette.mode === 'dark'` ternaries and ~100 hard-coded hex colours in `*-styles.tsx` (CreateStoreModal 15, Store 13, ProductManager 12, ProductPage 10…); the Black and White themes will show the wrong colours there until they use `theme.palette.*`.

## Plan

1. ✅ Platform upgrade in the PLATFORM.md order, one commit per step.
2. ✅ Test harness (vitest + jsdom + `qortalRequest` mock).
3. ✅ Theme kit, Q-Shop Classic as Hub 2.0, Settings page, version and changelog.
4. Efficiency: the two `limit: 0` → `limit: 1`; one cached ARRR price fetch shared by Store, Cart and ProductPage; `identifier=`+`prefix` instead of `query=` for store and review searches; lazy product images; code-split ProductManager, Cart, ProductPage and Settings (target: biggest chunk under 700 KB).
5. UX: replace hex colours with `theme.palette.*` in the styles files (Black/White themes); phone layout with a bottom nav (Stores, Orders, Cart, Settings) under 600 px; skeletons and empty states on StoreList, Store and MyOrders.
6. Features (additive only): store search on the home page; product sort by price; order status badge counts; `qortal://APP/Q-Shop+/…` share links.
7. Deferred: any change to checkout, SEND_COIN or order encryption (money code) until it has tests; moving to qapp-core; react-router 7.

## Done

Session 1 (2026-09-29, branch `q-shop-plus/pass-1`, PR [#8](https://github.com/SJQortal/Q-Apps-Plus/pull/8)), stopped at the overnight checkpoint on Simon's request:

- Upgrade: TS 5.9 + Vite 8 + plugin-react 6 → React 18.3 + RTK 2 + react-redux 9.3 + RR 6.30 (v7 flags) + MUI 5.18 → React 19.3 → MUI 9.4. tsc 0 → 27 → 0. Unused and dead packages removed (13 packages, 26 files).
- Harness: 24 tests (checkStructure validators, base64 round trip, the mock itself, Settings page).
- Theme kit installed; four themes switch live and persist; boot snippet in `index.html`; Inter from the kit; hard-coded `fontFamily` removed from 21 files; seven unused font files deleted (dist 2.9 → 2.1 MB, zip 1.1 MB).
- Settings page with Account, Appearance, Shop (preferred coin now persisted in `qshopplus-settings`, blocked names) and About (version `1.0.0-plus.1`, changelog dialog). README added; package renamed `q-shop-plus`.
- Data code untouched. Searches on first load: not yet measured.

## Follow-ups

**Where to pick up (next session, on `q-shop-plus/pass-1`):** the build, tests and `scripts/sync-theme.sh --check` all pass at the last commit; nothing is half-done. Continue with Plan steps 4–6 in that order, one commit each, pushing after every commit and updating PR #8's description at the end. First measure the searches on first load with the mock (a test that renders StoreList and counts `SEARCH_QDN_RESOURCES` + `fetch('/arbitrary/…')` calls) so the efficiency work has a before number.

**Questions for Simon**
- Upstream never set a version (`0.0.0`), so the + series starts at `1.0.0-plus.1`. OK, or start at `0.1.0-plus.1`?
- Q-Shop Classic now uses Raleway as its base font (most original components forced Raleway; un-styled text used Cambon Light). Check the Classic theme in Hub looks right to you.
- Share links: should product/store copy-links point at `Q-Shop+` (they point at `Q-Store` and `Q-Shop` today)?
- Blocked names still use Hub list `blockedNames_q-blog` (shared with the original app, so it stays).

**Not yet checked in Hub:** the MUI Grid codemod changed the layout markup of Store, StoreList, Cart, StoreReviews and ProductManager; a visual pass at 1280/700/375 px is needed. GO on a phone too.

**Kit:** no kit changes were needed.
