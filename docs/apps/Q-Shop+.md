# Q-Shop+

Decentralised shops: sellers publish a store and products; buyers order and pay in QORT or other coins.

**Published:** not yet.

**Version on the branch:** `1.0.0` (unpublished; replaces the old `1.0.0-plus.1`), branch `q-shop-plus/1.0.0`, PR [#32](https://github.com/SJQortal/Q-Apps-Plus/pull/32) (supersedes #8).

## Baseline at import

- **Upstream:** [Qortal/q-shop](https://github.com/Qortal/q-shop) branch `main` at `0738e27` (2024-04-17, 18 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 4, TypeScript 4.9
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 2.9 MB (1.9 MB of it ten font files), biggest JS chunk 887 KB (282 KB gzip), tsc 0 errors
- **After the platform upgrade (React 19.3 + MUI 9.4, session 1):** tsc 0 → 27 errors after the MUI 9 bump → 0 after fixes; biggest chunk 887 KB → 1,030 KB (MUI 9 is larger, nothing code-split yet); dist 2.1 MB after removing seven unused font files; zip 1.1 MB
- **Lint at the start of night 1:** no lint script. ESLint 9 with the Q-Share+ config found 278 problems (234 errors, 44 warnings).
- **QDN services:** STORE, DOCUMENT, DOCUMENT_PRIVATE, MAIL_PRIVATE, THUMBNAIL (read)
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×13, FETCH_QDN_RESOURCE ×6, GET_NAME_DATA ×4, GET_ACCOUNT_DATA ×4, GET_USER_WALLET ×3, DECRYPT_DATA ×3, SEND_COIN ×2; `/crosschain/price` for coin prices

## Notes

- This has the oldest upstream code (last commit 2024-04-17). It was built from the Q-Blog template; leftovers are listed in the audit.
- Payments go through `SEND_COIN`, and orders are encrypted (`DOCUMENT_PRIVATE`). Checkout, SEND_COIN, order encryption and price conversion are **money code**: pinned by tests before any change, kept identical unless a change is clearly a fix, and every change is listed under "Money code changes" below.
- Simon's decisions for night 1 (2026-10-21): plain version `1.0.0`; the app's own share links point at `Q-Shop+`; keep the shared blocked-names list `blockedNames_q-blog` so the original keeps working.

## Feature ideas to weigh in the audit

- product search and filters
- cart that survives reload
- clear order status for buyers and sellers
- seller dashboard
- price shown in several coins

## Audit

Read in full on 2026-10-21 (night 1): every file under `src/` outside the theme kit, about 12k lines. Line numbers are from commit `db199e17`.

### Architecture map

- **Entry:** `main.tsx` → `BrowserRouter basename=_qdnBase` → `App.tsx` → Redux `Provider` → `HubThemeProvider` → `Notification` (toasts) → `GlobalWrapper` → routes.
- **Routes:** `/` StoreList (all shops), `/:user/:store` Store (one shop: filters + product grid), `/:user/:store/:product/:catalogue` ProductPage, `/product-manager/:store` ProductManager (own shop: Products and Orders tabs), `/my-orders` MyOrders (buyer), `/settings` SettingsPage (session 1).
- **GlobalWrapper** (912 lines) does everything global: the account request and name lookup (`/names/address/…`, first name, not the primary name), the avatar, the signed-in name's first shop and its data container (and publishes an empty data container when that fetch fails, see Bugs), the list of own shops, the create-shop and edit-shop modals and their publish code, the Navbar, the Cart drawer (always mounted), the consent and "download Qortal" modals.
- **State (Redux):** `auth` (user), `global` (own current store, own data container → `listProducts`, `catalogueHashMap` (every catalogue fetched, by id), own products list, `myOrders` (buyer), `productsToSave` (unpublished product drafts), loading flag), `store` (viewed shop, its data container → `viewedStoreListProducts`, `hashMapStores`, `stores` (home list), `myStores`, reviews, `preferredCoin`), `cart` (`carts` by storeId: `{orders: {productId: {productId, quantity, catalogueId}}, storeOwner, storeId, lastUpdated}`, `isOpen`), `order` (seller's received orders and `hashMapOrders` of decrypted orders), `notifications`.
- **How a shop is stored:** the STORE resource holds the shop (with its logo as a data URL); a DOCUMENT "data container" is the shop's product index (price in QORT, category, status, catalogue id per product); products themselves live in DOCUMENT "catalogues" of at most 10 products each, with their images as data URLs inside the JSON. There is no per-product QDN resource: `q-store-product-…` is only a JSON id.
- **Where Qortal calls live:** `wrappers/GlobalWrapper.tsx` (account, own shop, create/edit shop), `pages/StoreList` (home search), `pages/Store/Store/Store.tsx` (viewed shop, data container, average rating), `hooks/useFetchOrders.tsx` + `utils/fetchOrders.ts` + `utils/fetchCatalogues.ts` (orders, catalogues), `hooks/useFetchStores.tsx` + `utils/fetchStores.ts`, `pages/Cart/Cart.tsx` (checkout), `pages/ProductManager/ProductManager.tsx` (publish products), `ShowOrder.tsx` (order status read/write, payment details), `StoreReviews/*` (reviews), `components/modals/*StoreModal.tsx` (GET_USER_WALLET, "Recreate shop data"), `BlockedNamesModal`.
- **Dead code** (removed on night 1): `utils/fetchPosts.ts`, `utils/extractTextFromSlate.ts`, `hooks/useProductsToSaveLocalStorage.tsx` (its import was commented out upstream), `components/common/Error/*`, 14 editor/theme SVG icons. Session 1 had removed 26 unreachable Q-Blog files (Slate editor, video/audio publish modals, workers).

### Data contract (binding, CLAUDE.md rule 1)

Every shape below is what the original app writes; the + app writes the same, and the tests named in the last column pin it. Product, catalogue and order objects are stored exactly as the app holds them in memory, so a few UI fields (`isUpdate`, `isValid`, `user`) are part of the stored data and stay.

| Service | Identifier | Who publishes | R/W | Shape | Pinned by |
|---|---|---|---|---|---|
| STORE | `q-store-general-<shortStoreId>` (`shortStoreId`: letters, digits and `-`; "post" and "q-shop" are stripped) | seller | R/W | JSON `{title, description, location, shipsTo, created, shortStoreId, logo (data URL, webp), foreignCoins: {ARRR: address}, supportedCoins: ["QORT", "ARRR"?]}`; an edit republishes `{...currentStore, title, description, location, shipsTo, logo, shortStoreId, foreignCoins, supportedCoins}` (so also `id`, `category`, `tags`, `created`, `owner`). `filename: "store.json"`, metadata `title`, `description: "**coins:QORTtrue,ARRR<true/false>**" + description.slice(0, 180)` | qdn/payloads tests |
| DOCUMENT | `<storeId>-datacontainer` | seller | R/W | JSON `{storeId, shortStoreId, owner, products: {<productId>: {created, priceQort, category, catalogueId, status}}, catalogues: [{id, products: {<productId>: true}}], id: "<storeId>-datacontainer"}` (the first publish has no `catalogues` and no `id`), `filename: "datacontainer.json"` (the boot-time and "Recreate shop data" publishes send no filename) | ProductManager.pin |
| DOCUMENT | `q-store-catalogue-<shortStoreId>-<uid10>` | seller | R/W | JSON `{id, products: {<productId>: Product}}`, at most 10 products; `filename: "catalogue.json"`. New products fill the last catalogue to 10, then new catalogues open; edits replace the product in its catalogue. The catalogues and the data container go in one PUBLISH_MULTIPLE, data container last | ProductManager.pin |
| (inside a catalogue) | Product id `q-store-product-<shortStoreId>-<uid10>` | seller | R/W | `{title, description, created, version: 1, images: [data URL…] (≤3), mainImageIndex: 0, type: "digital"/"physical", price: [{currency: "qort", value: number}, {currency: "ARRR", value: number}?], storeId, shortStoreId, category, id, status: "AVAILABLE"/"OUT_OF_STOCK"/"RETIRED", user, catalogueId}`; an edit adds `isUpdate: true` | ProductManager.pin |
| DOCUMENT_PRIVATE | `q-store-order-<shortStoreId>-<uid10>` | **buyer** | R/W | encrypted to `[sellerPublicKey, buyerPublicKey]`; JSON `{created, version: 1, details: {totalPrice: "<total>.toFixed(8)", <productId>: {product: Product, catalogueId, quantity, pricePerUnit (float), totalProductPrice (float)}}, storeName, sellerName, delivery: {customerName, shippingAddress: {streetAddress, city, region (or state for "United States"), country, zipCode, deliveryNote}}, payment: {total: "<toFixed(8)>", currency: "QORT"/"ARRR", transactionSignature: <QORT signature or null>, arrrAddressUsed: "<address>" or ""}, communicationMethod: ["Q-Mail"]}`; no filename | Cart.pin |
| MAIL_PRIVATE | `qortal_qmail_<seller.slice(0,20)>_<sellerAddress.slice(-6)>_mail_<uid6>` | buyer | W | Q-Mail message `{title: "Order for shop <shortStoreId> from <buyer>", subject: "New order", createdAt, version: 1, attachments: [], textContent: "", htmlContent: <order summary HTML>, generalData: {thread: []}, recipient: <seller>}`; published in the same encrypted PUBLISH_MULTIPLE as the order | Cart.pin |
| DOCUMENT_PRIVATE | `q-store-status-order-<shortStoreId>-<uid10>` (the order id with `q-store-order` → `q-store-status-order`) | **seller** | R/W | encrypted to `[buyerPublicKey, sellerPublicKey]`; JSON `{status: "Received"/"Shipped"/"Refunded", note}`, `filename: "<orderId>_status.json"`; read with `DECRYPT_DATA {encryptedData, publicKey: <buyer's key>}` | ShowOrder.pin |
| DOCUMENT | `q-store-review-<shortStoreId>-<uid10>-<rating×10>` | buyer with an order | R/W | JSON `{title, description, rating (0.5 steps), created}`, `filename: "review.json"`, metadata `title.slice(0,60)`, `description.slice(0,150)`. Lists read the rating from the identifier and the text from the metadata | AddReview.pin |
| THUMBNAIL | `qortal_avatar` | any name | R | avatar image | |
| Hub list | `blockedNames_q-blog` | user | R/W | names, shared with the original (Simon, night 1) | |
| localStorage | `qshopplus-ui-theme`, `qshopplus-settings` (session 1); `qshopplus-cart`, `qshopplus-pending-orders` (night 1, additive) | | R/W | browser only | |
| localforage | `general-consent` | | R/W | welcome notice | |

**Searches the original makes** (what the + app must keep finding): shops `service=STORE&query=q-store-general&prefix=true` (home), own shops by `name=` + `exactmatchnames`; a shop's orders `service=DOCUMENT_PRIVATE&query=q-store-order-<shortStoreId>` (all names); a buyer's orders `query=q-store-order-&name=<buyer>`; reviews `service=DOCUMENT&query=q-store-review-<shortStoreId>` with the exact prefix re-checked in code (Core's `query` is a case-insensitive substring).

**New data in the + app (additive only):**
- Other payment coins: the store's existing `supportedCoins` array and `foreignCoins` map gain more tickers (`BTC`, `LTC`, `DOGE`, `DGB`, `RVN`) with their payout addresses; products may carry their own price per coin in the existing `price` array (`{currency: "BTC", value}`); orders paid in them write `payment.currency: "<ticker>"` and the address paid in a new `payment.foreignAddressUsed` (ARRR keeps `arrrAddressUsed`). The original shows QORT/ARRR only and ignores the rest; editing such a store in the original asks for an address for the extra coin (its form only has ARRR), so the seller removes the coin there or keeps editing in the + app.
- Q-Assets: a new store field `acceptedAssets: [{id, name}]` (Qortal assets the shop accepts, paid with `TRANSFER_ASSET` to the seller's Qortal address) and product prices `{currency: "ASSET:<id>", value}`; orders paid in an asset write `payment.currency: "ASSET:<id>"`, `payment.assetId`, `payment.assetName` and the transfer's `transactionSignature`. The original ignores all of these.
- The QORT/ARRR/order shapes above are unchanged.

### Money code (pinned before any change)

`pages/Cart/Cart.tsx` `handlePurchase` (lines 257–797), the three copies of the price/coin logic (Cart, Store, ProductPage, ProductCard), `ShowOrder.tsx` (status read/write, payment details), `utils/fetchOrders.ts` (decrypt). Tests: `Cart.pin.test.tsx` (4), `ShowOrder.pin.test.tsx` (3). What they pin:

- **QORT:** `GET_NAME_DATA(seller)` → owner address → `GET_ACCOUNT_DATA` → public key; then `SEND_COIN {coin: "QORT", destinationAddress: <owner address>, amount: "<sum>.toFixed(8)"}`; the returned `.signature` goes into the order.
- **ARRR:** the product's own ARRR price if set, otherwise QORT price × the node's rate `/crosschain/price/PIRATECHAIN?maxtrades=10&inverse=true` ÷ 1e8 (float, unrounded per unit; only the total is rounded, `toFixed(8)`); `SEND_COIN {coin: "ARRR", destinationAddress: foreignCoins.ARRR.trim(), amount}`; no signature is kept.
- **Then:** one `PUBLISH_MULTIPLE_QDN_RESOURCES {resources: [order, mail], encrypt: true, publicKeys: [seller, buyer]}` through the MultiplePublish dialog (30 s per resource).

### Qortal call inventory

| Call | Where | When | Notes |
|---|---|---|---|
| GET_USER_ACCOUNT | GlobalWrapper:258 | mount | no retry; errors swallowed (a locked Hub leaves the app signed out with no hint) |
| `/names/address/<addr>` (fetch) | GlobalWrapper:138 | mount | takes the **first** name, not the primary name |
| GET_QDN_RESOURCE_URL avatar | GlobalWrapper:121 | after sign-in | |
| search STORE `identifier=q-store-general-&prefix=true&name=<me>` | GlobalWrapper:172 `getMyCurrentStore` | after sign-in | then the first shop's JSON **and** its data container are fetched |
| PUBLISH_QDN_RESOURCE data container | GlobalWrapper:242 | **at boot** when the data container fetch returns an error | see Bugs: can overwrite a real product index with an empty one |
| search STORE `name=<me>&query=q-store-general` | GlobalWrapper:548 `getMyStores` | after sign-in | then each own shop's JSON again (the first one twice) |
| search STORE `query=q-store-general&prefix=true` limit 20 | StoreList:39 | home, every "load more" | `includemetadata=false`, so titles wait for each shop's JSON |
| `/arbitrary/STORE/<name>/<id>` × 20 | fetchStores | home | each carries the shop logo as a data URL; skeletons until every one lands |
| search STORE `identifier=<id>&name=<owner>` | Store:360 | shop page | |
| `/arbitrary/STORE/…` + `/arbitrary/DOCUMENT/…-datacontainer` | Store:378, 404 | shop page | |
| SEARCH_QDN_RESOURCES **`limit: 0`** | Store:414, GlobalWrapper:672 | every shop page; own shop when the container is missing | an unlimited search only to learn whether the container exists |
| search DOCUMENT `query=q-store-review-<short>` **limit 100** | Store:485 | every shop page | average rating; `query=` substring, includes the owner's own reviews |
| FETCH_QDN_RESOURCE catalogue | fetchCatalogues | per catalogue of the first 20 products | sequential (`await` in a loop) |
| `/crosschain/price/PIRATECHAIN` | Store:192, Cart:155, ProductPage:69 | whenever ARRR is chosen, on each of the three (the Cart is always mounted) | three uncached copies; failure resets the coin to QORT |
| search DOCUMENT_PRIVATE `query=q-store-order-<short>` limit 20 | useFetchOrders:93 | Orders tab, each page | then one FETCH + DECRYPT_DATA per order, **sequential**; one bad order stops the rest (Bugs) |
| search DOCUMENT_PRIVATE `query=q-store-order-&name=<me>` | useFetchOrders:162 | My orders | offset from the **seller's** list (Bugs) |
| search `query=q-store-status-order-…` limit 1 (no name) + FETCH + GET_NAME_DATA + GET_ACCOUNT_DATA + DECRYPT_DATA | ShowOrder:150 | each time an order opens | lists always say "Received" until an order is opened |
| `/transactions/signature/<sig>` | ShowOrder:89 | Payment details | dumps the raw transaction JSON |
| search DOCUMENT_PRIVATE `name=<me>&query=q-store-order-<short>` limit 1 | StoreReviews:58 | reviews dialog | "can I review?" |
| search DOCUMENT `query=q-store-review-<short>` limit 10 | StoreReviews:77 | reviews dialog, each page | |
| `/arbitrary/DOCUMENT/<name>/<review>` | StoreReviewCard | each review card | full text |
| LIST_QDN_RESOURCES | AddReview:59 | before a review | |
| GET_USER_WALLET | Create/EditStoreModal | "Import ARRR address" | |
| GET_LIST_ITEMS / DELETE_LIST_ITEM `blockedNames_q-blog` | BlockedNamesModal | Settings | refused on public nodes (pitfall 13) |
| SEND_COIN, PUBLISH_MULTIPLE (order + mail) | Cart | checkout | money code |
| PUBLISH_MULTIPLE (catalogues + container) | ProductManager | Save products | no batching: 25 unconfirmed per account (>~230 products at once fails) |
| PUBLISH_MULTIPLE (store + container), PUBLISH (store edit, review, status) | GlobalWrapper, AddReview, ShowOrder | | |

**First load (by reading the code; measured counts for the harness are under Done):** home, signed in with one shop: 1 account request, 1 names fetch, 1 avatar URL, 3 STORE searches, the own shop's JSON twice and its data container once, then 20 shop JSONs (with their logos) for the list. A shop page: 2 searches (one unlimited) + 1 review search of 100 + shop JSON + data container + one sequential catalogue fetch per 10 products shown; with ARRR chosen, 2–3 price fetches.

### Performance

- **Chunk:** one 1,030 kB JS file (gzip 319 kB): MUI 9, react-redux/RTK, react-router, `moment` (only `format("llll")` is used), react-dropzone + compressorjs (needed only by sellers), react-toastify, countries/states JSON (needed only at checkout), ua-parser-js (only for the "download Qortal" modal on gateways), react-copy-to-clipboard.
- **Fonts:** Inter (kit, 426 kB woff2) + Raleway 310 kB, Cambon Light 123 kB, Karla 89 kB TTF for the Classic theme.
- **Images:** every shop logo and product image is a base64 data URL inside JSON, so a list must download whole JSON documents to show a picture; nothing is lazy. Catalogues of 10 products with up to 3 images each are a few hundred kB to fetch for one product.
- **Re-renders:** `filteredProducts` re-sorts on every catalogue that lands; `useFetchOrders` callbacks depend on whole lists; the Cart (with its 300-entry country list) is always mounted.

### UX problems (ranked by impact × effort)

1. **High/M — phones:** desktop layout everywhere: fixed 75 % modals, a 1500 px cart modal at 96 %, filters in a column that stacks above the grid, tables (orders, products) that scroll sideways, 22–30 px icon buttons, no bottom navigation, `100vh`/`90vh` sizes.
2. **High/S — no states:** a blank page while the global loader is up (`isLoadingGlobal` hides whole pages), "Store Not Found!" for a slow node, "There are currently no products for sale!" before products load, no retry anywhere, errors only as toasts.
3. **High/M — checkout:** a modal over a modal; the coin picker only on the last step; no order review before paying; physical orders pay on "Purchase" without a confirmation; no keyboard handling; the delivery note is marked required but isn't checked.
4. **High/S — order status:** every order shows "Received" in the lists until opened; no counts; the seller has no "to handle" view; status colours are hard-coded (yellow on white).
5. **Med/S — discovery:** no search at all, no sort on the home page, no way to find a product across shops; shop cards need their JSON before anything shows.
6. **Med/S — cart:** lost on reload; only the current shop's cart is reachable; the cart icon only appears on a shop page; adding from a card gives no feedback.
7. **Med/S — themes:** 121 hex colours and 77 `palette.mode` ternaries outside the theme files; Black/White/Hub 3.0 show the Classic greys and yellows.
8. **Med/S — accessibility:** clickable `Box`es and SVGs instead of buttons (cart +/−, bin, close icons), icon buttons without labels, low-contrast text, no focus styles, images with `alt` like `product-img-…`.
9. **Low/S — copy:** "Authenticate", "Data container", "Shop successfully created" vs "store", "🛈" in titles, "Product ID ${productID} Not Found" with a literal `$`.

### Bugs (ranked)

1. **Money — paid but no order** (Cart.tsx:385–797): `SEND_COIN` runs first, then the order and mail publish. If Hub's publish dialog is declined, fails or times out (the dialog allows 30 s per resource; Hub allows 30 minutes), the payment is gone, no order exists, the cart is still full and the toast says "Order failed to be placed! Please try again!", inviting a second payment. A declined publish leaves no trace of the payment at all.
2. **Data loss — empty product index published at boot** (GlobalWrapper:224–249): if fetching the own shop's data container returns anything that isn't JSON without `error` (not yet downloaded from peers, a node hiccup), the app publishes an empty data container over it at start-up (Hub asks to confirm, with no context). Accepting hides every product of the shop.
3. **Money — ARRR price edit drops the ARRR price** (ProductForm:149–189): editing a product initialises only the QORT price, so saving without retyping the ARRR price removes it; buyers then pay the converted QORT price instead.
4. **Seller's orders stop at the first bad one** (useFetchOrders:117, orderSlice `addToHashMap`): a failed or undecryptable order returns `undefined`, `addToHashMap` throws on `order.details`, and the loop ends; the rest of the page never loads.
5. **My orders pages from the wrong list** (useFetchOrders:158): the offset comes from the seller's `orders`, not `myOrders`, so "load more" re-fetches page 1 or skips pages.
6. **Prices when the rate isn't loaded:** with ARRR chosen and no product ARRR price, the QORT number is shown (and would be charged) as ARRR until the rate arrives; the global loader usually hides it, but the Cart's own copy has no loader.
7. **ARRR without an address** (Cart:399): `throw` outside `try`: an unhandled rejection and nothing on screen.
8. **Price missing → crash** (Cart:331–339): `return;` inside the reducer makes the accumulator `undefined`; the next line throws.
9. **Wrong share links:** shop cards copy `qortal://APP/Q-Store/…` (StoreCard:101); product cards in other people's shops copy a link with **your own** shop id (`currentStore?.id`, Store:975); names aren't encoded.
10. **Status colour never red:** `" Refunded"` with a leading space (ShowOrder:309).
11. **Status read trusts any publisher:** the status search has no `name=`, so another name's resource with that identifier answers "exists" (the fetch is by the seller's name, so the content is safe).
12. **Average rating** counts the owner's own reviews and duplicates per reviewer; the list hides the owner's reviews but the average doesn't.
13. **Sort comparators return an array** (Store:609, 625) → NaN; price sorting uses `price[0]`, which isn't always QORT.
14. **The mail HTML** embeds buyer-typed text (name, address, note) and seller-typed product titles unescaped; Q-Mail sanitises on display, but the + app should not write markup it didn't mean.
15. **Physical checkout has no confirmation** (Cart:1316–1328): "Purchase" pays straight away (Hub's own dialog still asks).
16. **`ProductNotFound`** shows "Product ID ${productID} Not Found" (template text outside a template).
17. Session 1: `includes("Android" || "iOS")` only matched Android (fixed then).

### Missing features (most valuable first)

1. Search: shops by title, description and owner (Core's `query`), products within a shop, and a cross-shop product search over the catalogues already loaded.
2. Sort and filters on the home page (newest, recently active, most products, top rated, accepted coin) and in a shop (price, newest, rating, category, in stock).
3. A cart that survives a reload, reachable from every page, with all shops' carts.
4. Clear order status for buyers and sellers, with counts, read in one search per list.
5. A seller dashboard: orders to handle, products (with stock status), reviews.
6. Prices in the buyer's chosen coin everywhere, from one shared, cached rate per coin.
7. Product image galleries (swipe, thumbnails, full screen).
8. Share links `qortal://APP/Q-Shop+/<owner>/<shop>[/<product>/<catalogue>]`.
9. More payment coins (BTC, LTC, DOGE, DGB, RVN through Hub's SEND_COIN) and Q-Assets (`TRANSFER_ASSET`), configured per shop.
10. Batched publishing for big product uploads (Core's 25-unconfirmed limit).
11. Trusted reviews: one per reviewer (latest), "verified buyer" when the reviewer has an order with the shop, the owner's own excluded.

## Plan

Night 1 (2026-10-21/22), in commit order. Money and data code first, alone; then disjoint areas in parallel worktrees; then quality.

**Round 1 (lead):**
1. ✅ Main merged, ESLint 9, dead code, `constants/plus.ts`.
2. ✅ Pin today's writes with tests (checkout, order read, status, products, reviews).
3. Data layer `src/qdn/`: identifiers, pure payload builders (pinned by the same expectations), a paged/deduped/cached search helper (Q-Share+'s `qdnSearch.ts`), one shared coin-rate cache, Q-Share+'s `hubErrors`/`qortalLinks`.
4. Money layer `src/money/`: pricing per coin (today's float behaviour kept, pinned), the order payload, a checkout service; **fix bug 1** (a paid order is kept locally and finished without paying again; Hub's 30-minute budget; QDN checked before a retry), bugs 3, 4, 5, 7, 8.
5. Efficiency: no `limit: 0`; `identifier`+`prefix`+`name` instead of `query=`; parallel catalogue and order fetches (5 at a time); one rate fetch per coin per few minutes; **fix bug 2** (never publish a data container at boot).
6. Shell: the phone shell parts from Q-Share+ (bottom nav, sheets, full-screen dialogs, hooks, frame height), header, routes code-split.

**Round 2 (agents in worktrees, disjoint files, integrated one at a time):** discovery (home: search, sort, filters, shop cards); shop and product pages (filters, sort, gallery, share links, reviews); cart and checkout UI (persistent cart, coins, keyboard-safe, full-screen); orders (buyer orders, seller dashboard, status counts); seller tools (product manager, shop create/edit, coins and assets, batched publish); theme colours in each area; screenshot config.

**Round 3:** axe and contrast in four themes, Settings sync, changelog, README, a review workflow over the whole diff with adversarial verification.

**Round 4 (if time allows):** read-only Hub check on the test Hub (port 9223, dev server 5174).

Deferred, with reasons: qapp-core (not needed for this app's data), react-router 7, i18n (upstream has none), per-product QDN resources or thumbnails (would change the data model; images stay inside catalogues).

## Done

### Session 1 (2026-09-29, branch `q-shop-plus/pass-1`, PR #8), stopped at the overnight checkpoint

- Upgrade: TS 5.9 + Vite 8 + plugin-react 6 → React 18.3 + RTK 2 + react-redux 9.3 + RR 6.30 (v7 flags) + MUI 5.18 → React 19.3 → MUI 9.4. tsc 0 → 27 → 0. Unused and dead packages removed (13 packages, 26 files).
- Harness: 24 tests (checkStructure validators, base64 round trip, the mock itself, Settings page).
- Theme kit installed; four themes switch live and persist; boot snippet in `index.html`; Inter from the kit; hard-coded `fontFamily` removed from 21 files; seven unused font files deleted (dist 2.9 → 2.1 MB, zip 1.1 MB).
- Settings page with Account, Appearance, Shop (preferred coin persisted in `qshopplus-settings`, blocked names) and About (version, changelog dialog). README added; package renamed `q-shop-plus`.

### Night 1 (2026-10-21/22), branch `q-shop-plus/1.0.0`, PR #32

_In progress._

- `main` merged (the branch now carries #8's commits plus the current kit); ESLint 9 with the Q-Share+ config: 278 → 0 problems, with the hooks findings of 22 upstream files listed in a per-file header that each rewrite removes; 19 dead files removed; `constants/plus.ts`.
- Money and data writes pinned before any change: 10 tests over the untouched upstream components (34 tests in all).
- Data layer `src/qdn/` (identifiers, paged/deduped/cached search and JSON reads keyed by name + identifier, links with a literal `+`, Hub error shapes, pure payload builders) and money layer `src/money/` (coins, pricing, one cached rate per coin, order and mail builders, the checkout service, pending orders). The product manager, order status, review and shop create/edit publishes go through the builders; the pins pass unchanged.
- Foundation for the parallel round: the Q-Share+ phone parts, the account hook (names and primary name from Hub), own shops in one search, carts that survive a reload, code-split routes behind an error boundary, a `/cart` page, `Page`/`PageHeader`, `PriceTag`/`CoinIcon`/`useShopCoin`, a mock node with first-load call counts, and `e2e/screens.config.mjs`.

#### Money code changes (each a fix, each tested)

Pinned first by `Cart.pin.test.tsx`, `ShowOrder.pin.test.tsx`, `ProductManager.pin.test.tsx` and `AddReview.pin.test.tsx` on the untouched upstream code; the same expectations pass on the new code. What the checkout sends is unchanged: `GET_NAME_DATA` → `GET_ACCOUNT_DATA` → `SEND_COIN {coin, destinationAddress, amount: total.toFixed(8)}` → one encrypted `PUBLISH_MULTIPLE_QDN_RESOURCES [order, mail]` to `[seller, buyer]`, with the same identifiers and order JSON.

| Change | Why | Test |
|---|---|---|
| The paid order is saved locally (`qshopplus-pending-orders`, without the delivery address) the moment Hub confirms the payment, and the cart is emptied; a declined, failed or timed-out order publish is finished later from the cart with the same identifiers and payment signature | Bug 1: the original lost the order and invited a second payment | checkout.test.ts "keeps a paid order…" |
| Before publishing a pending order again, QDN is checked for it (fresh, by name + exact identifier) | A publish that timed out may still have landed; publishing twice would duplicate the order and the mail | checkout.test.ts "doesn't publish again…" |
| The order publish gets Hub's 30-minute budget (`qortalRequestWithTimeout`), not 30 s per resource | Hub allows 30 minutes; the shorter budget declared live publishes failed (pitfall 10) | checkout.test.ts |
| A payment request Hub doesn't answer in time is kept as "unconfirmed"; for QORT and assets the buyer's latest transactions are searched for a matching payment (recipient, amount, after the checkout started) | Hub applies a late Accept after its 30 s answer timeout | checkout.test.ts "marks a payment…" |
| No price is shown or charged in a coin until its rate is known | Bug 6: the original showed (and could charge) the QORT number as ARRR | money.test.ts |
| A missing price or a missing coin address stops the checkout before anything is paid, with a message | Bugs 7 and 8: an unhandled rejection or a crash | checkout.test.ts |
| Typed text (shop and product titles, the buyer's name and address) is HTML-escaped in the seller's order mail | Bug 14 | money.test.ts, Cart.pin (`Seller&#39;s Shop`) |

New and additive: BTC, LTC, DOGE, DGB and RVN through Hub's `SEND_COIN` to the shop's address for that coin (`payment.foreignAddressUsed`, `foreignTxid`), Qortal assets through Hub's `TRANSFER_ASSET` to the seller's address (`payment.assetId`, `assetName`); ARRR's payment block is written exactly as before.

## Follow-ups

**Questions for Simon**

1. Q-Shop Classic uses Raleway as its base font (most original components forced Raleway; un-styled text used Cambon Light). Check the Classic theme in Hub looks right to you.
