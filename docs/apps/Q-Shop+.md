# Q-Shop+

Decentralised shops: sellers publish a store and products; buyers order and pay in QORT, ARRR or Qortal assets.

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
| DOCUMENT | `<storeId>-datacontainer` | seller | R/W | JSON `{storeId, shortStoreId, owner, products: {<productId>: {created, priceQort, category, catalogueId, status}}, catalogues: [{id, products: {<productId>: true}}], id: "<storeId>-datacontainer"}` (the first publish has no `catalogues` and no `id`), `filename: "datacontainer.json"` (the boot-time and "Recreate shop data" publishes send no filename). **+ app, additive** (both apps' publishes spread the index and keep them; "Recreate shop data" drops them): `collectionsId`, `deletedProducts`, `productOrder: [productId…]` (round 5, the seller's order; `[]` = newest first again) and `fiatPricing: {currency, rates: {QORT, ARRR?}, updated}` (round 5, prices in a currency; `null` once stopped) | ProductManager.pin, productOrder.test, fiatPricing.test |
| DOCUMENT | `q-store-catalogue-<shortStoreId>-<uid10>` | seller | R/W | JSON `{id, products: {<productId>: Product}}`, at most 10 products; `filename: "catalogue.json"`. New products fill the last catalogue to 10, then new catalogues open; edits replace the product in its catalogue. The catalogues and the data container go in one PUBLISH_MULTIPLE, data container last | ProductManager.pin |
| (inside a catalogue) | Product id `q-store-product-<shortStoreId>-<uid10>` | seller | R/W | `{title, description, created, version: 1, images: [data URL…] (≤3), mainImageIndex: 0, type: "digital"/"physical", price: [{currency: "qort", value: number}, {currency: "ARRR", value: number}?], storeId, shortStoreId, category, id, status: "AVAILABLE"/"OUT_OF_STOCK"/"RETIRED", user, catalogueId}`; an edit adds `isUpdate: true`. `category` is free text in the original; the + app's form offers only its fixed list (round 5). **+ app, additive:** `fiatPrice: {currency, value, qort}` on a product priced in a currency (round 5), after the original's keys | ProductManager.pin, productDraft.test |
| DOCUMENT_PRIVATE | `q-store-order-<shortStoreId>-<uid10>` | **buyer** | R/W | encrypted to `[sellerPublicKey, buyerPublicKey]`; JSON `{created, version: 1, details: {totalPrice: "<total>.toFixed(8)", <productId>: {product: Product, catalogueId, quantity, pricePerUnit (float), totalProductPrice (float)}}, storeName, sellerName, delivery: {customerName, shippingAddress: {streetAddress, city, region (or state for "United States"), country, zipCode, deliveryNote}}, payment: {total: "<toFixed(8)>", currency: "QORT"/"ARRR", transactionSignature: <QORT signature or null>, arrrAddressUsed: "<address>" or ""}, communicationMethod: ["Q-Mail"]}`; no filename | Cart.pin |
| MAIL_PRIVATE | `qortal_qmail_<seller.slice(0,20)>_<sellerAddress.slice(-6)>_mail_<uid6>` | buyer | W | Q-Mail message `{title: "Order for shop <shortStoreId> from <buyer>", subject: "New order", createdAt, version: 1, attachments: [], textContent: "", htmlContent: <order summary HTML>, generalData: {thread: []}, recipient: <seller>}`; published in the same encrypted PUBLISH_MULTIPLE as the order | Cart.pin |
| DOCUMENT_PRIVATE | `q-store-status-order-<shortStoreId>-<uid10>` (the order id with `q-store-order` → `q-store-status-order`) | **seller** | R/W | encrypted to `[buyerPublicKey, sellerPublicKey]`; JSON `{status: "Received"/"Shipped"/"Refunded", note}`, `filename: "<orderId>_status.json"`; read with `DECRYPT_DATA {encryptedData, publicKey: <buyer's key>}` | ShowOrder.pin |
| DOCUMENT | `q-store-review-<shortStoreId>-<uid10>-<rating×10>` | buyer with an order | R/W | JSON `{title, description, rating (0.5 steps), created}`, `filename: "review.json"`, metadata `title.slice(0,60)`, `description.slice(0,150)`. Lists read the rating from the identifier and the text from the metadata | AddReview.pin |
| DOCUMENT | `q-store-collections-<shortStoreId>` (**+ app only**, round 5) | seller | R/W | JSON `{storeId, collections: [{id, title (≤60), description (≤500), image? (WebP data URL, 640 px wide), products: [productId…], created, updated}]}` in the seller's order, at most 24, `filename: "collections.json"`; the product index points at it with an added `collectionsId` field. The original never reads either | collections.test.ts |
| THUMBNAIL | `qortal_avatar` | any name | R | avatar image | |
| Hub list | `blockedNames_q-blog` | user | R/W | names, shared with the original (Simon, night 1) | |
| localStorage | `qshopplus-ui-theme`, `qshopplus-settings` (session 1); `qshopplus-cart` (carts per owner and shop: the first cart for a shop id keeps the plain id as its key, another owner's cart for that id is keyed `owner\nshopId`), `qshopplus-pending-orders` (paid orders not yet recorded, without the delivery address; optional `published`, `imagesStripped`), `qshopplus-used-payments` (payment signatures of orders recorded from this device), `qshopplus-active-name` (night 1), `qshopplus-deleted-shops` (shops this browser deleted in the last hour, round 5; all additive) | | R/W | browser only | |
| localforage | `general-consent` | | R/W | welcome notice | |

**Searches the original makes** (what the + app must keep finding): shops `service=STORE&query=q-store-general&prefix=true` (home), own shops by `name=` + `exactmatchnames`; a shop's orders `service=DOCUMENT_PRIVATE&query=q-store-order-<shortStoreId>` (all names); a buyer's orders `query=q-store-order-&name=<buyer>`; reviews `service=DOCUMENT&query=q-store-review-<shortStoreId>` with the exact prefix re-checked in code (Core's `query` is a case-insensitive substring).

**New data in the + app (additive only):**
- Other payment coins: none (round 5). Round 2 added `BTC`, `LTC`, `DOGE`, `DGB` and `RVN` (more tickers in `supportedCoins`/`foreignCoins`, prices `{currency: "BTC", value}`, orders with `payment.foreignAddressUsed`/`foreignTxid`); Simon took them out before any release, so Q-Shop+ writes only the original's QORT and ARRR shapes plus Q-Assets. Should a shop, product or order from a test build still name one: the shop reads as without it and an edit saves it without it (as the original's edit does), a product's price in it is kept untouched, and the seller sees the order's coin as unknown.
- Q-Assets: a new store field `acceptedAssets: [{id, name}]` (Qortal assets the shop accepts, paid with `TRANSFER_ASSET` to the seller's Qortal address) and product prices `{currency: "ASSET:<id>", value}`; orders paid in an asset write `payment.currency: "ASSET:<id>"`, `payment.assetId`, `payment.assetName` and the transfer's `transactionSignature`. The original ignores all of these.
- Deletes (round 5): QDN can't erase anything, so a delete publishes over each part. Other apps publish `"D"` (qapp-core, Torq), which Q-Shop+ reads as deleted, but it never writes it: the original runs `response.json()` on its seller's oldest shop at start-up, and a `"D"` there throws before its "My Stores" menu (and with it Create store) appears; and a `"D"` catalogue a product list still names crashes its shop page (`.products` of a string). So a deleted shop's parts become **tombstones**, JSON in the original's shapes marked `deleted: true` and empty: STORE `{deleted: true, title: "Deleted shop"}` (fails the original's `checkStructureStore`, so its home leaves it out), product list `{storeId, shortStoreId, owner, products: {}, deleted: true}`, catalogues `{id, products: {}, deleted: true}`, collections `{storeId, collections: [], deleted: true}`, each with metadata `title: "deleted"`, `description: "deleted"`, `tags: ["deleted"]` so searches can leave them out; the shop goes first. Deleted products leave the product list and their catalogues, which are republished in the original's shapes (an emptied catalogue stays `{id, products: {}}`, which both apps read). Creating a shop over a deleted one's id publishes the original's STORE and empty product list as usual.
- Collections (round 5): a new DOCUMENT `q-store-collections-<shortStoreId>` (row above) and one new field in the product index, `collectionsId`, that names it, so shop pages read it only for shops that have one. Both apps' product publishes spread the index and keep the field; the original's "Recreate shop data" drops it (the next save of the collections puts it back). Settings sync adds `productView` to its snapshot (older saves without it still restore).
- Categories (round 5, Follow-up 19 and Simon's follow-up): the product form offers one fixed list of 20 (constants/categories.ts) instead of free text. `category` stays the original's plain text field; products saved before keep their own words (shown in both apps, listed under "Other categories" on the Products page) until the seller picks one from the list.
- Product order (round 5, community request): `productOrder` in the product index, the seller's order of the shop's products (shop pages' "Featured"). Going back to newest first writes `[]`, so a copy loaded before can't bring the old order back; a collection's order is its own `products` array (already in the collections document).
- Prices in a currency (round 5, community request): `fiatPricing` in the product index (the seller's rates; `null` once stopped) and `fiatPrice` on each product priced that way, with `qort`, the QORT price it gave. The original's form keeps unknown product fields, so a product repriced there keeps a `fiatPrice` whose `qort` no longer matches: the + app then treats it as priced in QORT (it no longer follows the rates) and says so. The `price` list keeps the original's shape (QORT first, ARRR when the shop takes it and has a rate, assets untouched), so buyers in either app pay the published QORT and ARRR prices.
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

**Real data on the local node (read-only GETs, 2026-10-22):** 115 shops by 101 names (57 accept ARRR; owners with spaces are common), shop JSON median 25 kB and up to 257 kB (the logo is inside); 131 catalogues, median 133 kB and up to 1.8 MB (product images are inside); 360 orders, median 90 kB (each order embeds its products' images) and up to 1.3 MB; 56 seller status notes; 44 reviews. So: a list must never fetch shop JSON it doesn't show, orders are opened only when needed, and one paged search of 100 covers today's whole shop index.

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
9. More payment coins (BTC, LTC, DOGE, DGB, RVN through Hub's SEND_COIN) and Q-Assets (`TRANSFER_ASSET`), configured per shop. (Round 5: Q-Assets kept, the other coins taken out.)
10. Batched publishing for big product uploads (Core's 25-unconfirmed limit).
11. Trusted reviews: one per reviewer (latest), "verified buyer" when the reviewer has an order with the shop, the owner's own excluded.

## Plan

Night 1 (2026-10-21/22), in commit order. Money and data code first, alone; then disjoint areas in parallel worktrees; then quality.

**Round 1 (lead):**
1. ✅ Main merged, ESLint 9, dead code, `constants/plus.ts`.
2. ✅ Pin today's writes with tests (checkout, order read, status, products, reviews).
3. ✅ Data layer `src/qdn/`: identifiers, pure payload builders (pinned by the same expectations), a paged/deduped/cached search helper (Q-Share+'s `qdnSearch.ts`), one shared coin-rate cache, Q-Share+'s `hubErrors`/`qortalLinks`.
4. ✅ Money layer `src/money/`: pricing per coin (today's float behaviour kept, pinned), the order payload, a checkout service; **fix bug 1** (a paid order is kept locally and finished without paying again; Hub's 30-minute budget; QDN checked before a retry), bugs 3, 4, 5, 7, 8.
5. ✅ Efficiency: no `limit: 0`; `identifier`+`prefix`+`name` instead of `query=`; parallel catalogue and order fetches (5 at a time); one rate fetch per coin per few minutes; **fix bug 2** (never publish a data container at boot).
6. ✅ Shell: the phone shell parts from Q-Share+ (bottom nav, sheets, full-screen dialogs, hooks, frame height), header, routes code-split.

**Round 2 ✅ (agents in worktrees, disjoint files, integrated one at a time):** discovery (home: search, sort, filters, shop cards); shop and product pages (filters, sort, gallery, share links, reviews); cart and checkout UI (persistent cart, coins, keyboard-safe, full-screen); orders (buyer orders, seller dashboard, status counts); seller tools (product manager, shop create/edit, coins and assets, batched publish); theme colours in each area; screenshot config.

**Round 3 ✅:** axe and contrast in four themes, Settings sync, changelog, README, a review workflow over the whole diff with adversarial verification.

**Round 4 (not possible: the test Hub was locked; real data checked read-only instead):** read-only Hub check on the test Hub (port 9223, dev server 5174).

Deferred, with reasons: qapp-core (not needed for this app's data), react-router 7, i18n (upstream has none), per-product QDN resources or thumbnails (would change the data model; images stay inside catalogues).

## Done

### Session 1 (2026-09-29, branch `q-shop-plus/pass-1`, PR #8), stopped at the overnight checkpoint

- Upgrade: TS 5.9 + Vite 8 + plugin-react 6 → React 18.3 + RTK 2 + react-redux 9.3 + RR 6.30 (v7 flags) + MUI 5.18 → React 19.3 → MUI 9.4. tsc 0 → 27 → 0. Unused and dead packages removed (13 packages, 26 files).
- Harness: 24 tests (checkStructure validators, base64 round trip, the mock itself, Settings page).
- Theme kit installed; four themes switch live and persist; boot snippet in `index.html`; Inter from the kit; hard-coded `fontFamily` removed from 21 files; seven unused font files deleted (dist 2.9 → 2.1 MB, zip 1.1 MB).
- Settings page with Account, Appearance, Shop (preferred coin persisted in `qshopplus-settings`, blocked names) and About (version, changelog dialog). README added; package renamed `q-shop-plus`.

### Night 1 (2026-10-21/22), branch `q-shop-plus/1.0.0`, PR #32

Every commit builds, lints and passes its tests, with one exception: the three round-3 merge commits after the shop-pages fixes carry one failing assertion (a test that documented the old `shopCoins` crash, which the money-cart fixes removed), fixed in the next commit (`544bd743`). 559 tests at the end (24 at the start of the night). `release/Q-Shop+.zip` 1.2 MB.

| | Start of night 1 | End of night 1 |
|---|---|---|
| Tests | 24 | 559 (pins of every money and data write, a mock node, first-load counts) |
| Lint | no script (ESLint 9: 278 problems) | 0 problems, no disable headers left |
| Biggest JS chunk | 1,030 kB (gzip 319 kB), one chunk | 341 kB (gzip 108 kB); every screen code-split |
| Home, first load (mock node, buyer) | 3 searches + 20 shop JSONs (logos inside) + a names fetch | 2 searches + the shop JSONs of the cards on screen (6) |
| Home, shop owner | 3 searches + 22 shop JSONs (own shop twice) + 1 product index | 2 searches + 7 shop JSONs + 1 product index |
| A shop page | 5 searches, 2 of them unlimited (`limit 0`, no limit) + shop + index + catalogues | 2 searches, 0 unlimited + shop + index + one fetch per catalogue on screen |
| My orders (25 orders) | 1 search + every order opened one after another, the first broken one stopping the rest; statuses only when an order was opened (1 search + 4 calls each) | 3 searches (own shops, orders, statuses) + 20 orders opened 5 at a time + the 3 statuses that exist |
| Unlimited searches in the code | 3 (plus 1 search without a limit) | 0 |
| Start-up publishes | an empty product index whenever the shop's couldn't be read | none |

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

New and additive: Qortal assets through Hub's `TRANSFER_ASSET` to the seller's address (`payment.assetId`, `assetName`); ARRR's payment block is written exactly as before. (Round 2 also paid BTC, LTC, DOGE, DGB and RVN through `SEND_COIN`; round 5 took them out.)

#### Round 2: features and the phone shell

Six agents built disjoint areas in their own worktrees on local branches `q-shop-plus/feat-<area>` (from the foundation, `83252d55`); the lead merged them one at a time (merge commits), checking typecheck, lint, the tests and the build at each merge, then fixed what crossed areas. Only one file was touched by two branches (the first-load test). 454 tests after integration (83 before).

- **Shell** (`components/layout`, `wrappers`, Settings): a sticky translucent header that hides on scroll on phones, the logo mark in the theme's colour, Shops / Orders / Sell on desktop, a cart button with the item count and a dot while a paid order waits to be recorded, an account menu (lazy) with Q-Share+'s name switcher, My shops, Open a new shop, Blocked names, Settings; on phones a bottom bar with Shops, Cart, Orders, Sell, Settings, a 52 px landscape bar, toasts above the bar, the page in `<main>`, the frame height from Hub, `overflow-x: clip`, reduced motion. The full-screen loader that blanked every page is a thin progress bar. Settings: Account, Appearance, Shopping (preferred coin of seven, two since round 5; blocked names with Unblock, quiet on public nodes), Sync (Save to QDN / Restore, DOCUMENT `qshopplus_settings`, explicit buttons only), About (1.0.0, changelog, links). Q-Shop Classic keeps its look with its blue as primary (the original used white and navy, its surface colours, as "primary", which made every primary control invisible on Classic), 4.5:1 in light and dark. Sign in works in Hub and GO on an https node (the original showed "Download Qortal" on any https page).
- **Home** (`pages/StoreList`, `discovery/`): search by owner, title and description (in the URL, the last results stay while the next load), one cached index search of every shop with titles at once, sorts Newest / Recently active / Most products / Top rated / A–Z (the product-index and review indexes load only when a sort needs them), filters by coin and My shops (a sheet on phones, chips), shop cards as real links with a Copy-link menu, logos fetched only when a card nears the screen, "Fetching from peers…" retries, a "New products" strip that reads nothing until it scrolls into view, pull to refresh, every empty and error state. Ratings count one review per reviewer (the latest) and leave out the owner's own.
- **Shop and product pages**: header with logo, owner, ★ average (n), accepted coins, location and ships-to, Message seller (Q-Mail+), Copy link, details; for the owner Edit shop and Seller page. Products filter and sort over the whole product index (category, in stock, newest/oldest/price) without fetching catalogues; catalogues are read only for the products on screen (5 at a time, cached); text search loads the rest progressively (capped at 30). Product cards with Add to cart and a "View cart" snackbar. The product page has a swipeable gallery with thumbnails and a full-screen viewer, a 1–99 quantity, Copy link, plain-text descriptions. Reviews: summary with a distribution, one per reviewer, "Verified buyer" from one search per page, Read more, and the original's rule that only names with an order can review. Fixed: share links (the original copied `Q-Store`, or your own shop id), sort comparators, price sort by `price[0]`, the shop page failing for owners with `+` in their name, two unlimited searches per shop page.
- **Cart and checkout**: every shop's cart on `/cart`, steppers, remove with Undo, the shop's coin picker, flagged unavailable items; "Orders to finish" first (paid but not recorded: Finish order; unconfirmed: Check again / I paid / I wasn't charged — never pay again). Checkout is a full-screen dialog in steps (Review → Delivery for physical items → Confirm → progress → result), the coin and rate frozen at Confirm so the amount shown is the amount sent, Back hidden while paying, countries and states loaded only there.
- **Orders**: My orders with order cards, status filters with counts, a banner for orders to finish, pull to refresh; the seller's Orders tab with "To handle" first and a buyer search; an Overview tab (to handle, shipped, refunded, products, latest orders); the order dialog with items, amounts in the order's coin, payment details checked on demand against the chain (amount, recipient, sender, a signature reused by another order), the delivery address, Message buyer/seller, and the seller's status update (optimistic, quiet on decline). Orders open 5 at a time and a broken one becomes a row instead of stopping the list (bug 4); statuses come from one search per list (seller) or per page (buyer) instead of one per opened order, and only from the order's seller (bug 11); paging fixed (bug 5); the " Refunded" colour (bug 10).
- **Seller tools**: the seller page with Overview, Products, Orders, Reviews and Shop tabs; products as cards/rows with search and filters; the product form in a full-screen dialog (≤3 images, several at once, QORT price plus an own price per accepted coin and asset), drafts per shop, batched publishing above 20 resources (Q-Share+'s `publishBatches`: batches of ≤20, a wait for room in the 25-unconfirmed limit, the product index last); the Shop tab with payments (QORT, and ARRR, BTC, LTC, DOGE, DGB, RVN with a payout address and "Use my wallet address"; ARRR only since round 5), Q-Assets by id or name (Core's read-only `/assets`), Recreate shop data behind a strong confirmation; "Create product list" when the index is missing (never automatic); the create-shop dialog. Fixed: an edit kept only the QORT price (bug 3), "creating" stuck after a validation error, drafts of one shop publishable into another.

**Data decisions in round 2** (all additive or display-only; the pinned writes are unchanged):
- The seller's status for an order is read only from the order's seller; the status search is by name and exact identifier (one pinned URL updated accordingly, `ShowOrder.pin`).
- Shop edits trim payout addresses and text fields, keep an `ARRR` key in `foreignCoins` as the original did, and save `supportedCoins` as QORT then ARRR, BTC, LTC, DOGE, DGB, RVN (Follow-up 3; QORT then ARRR since round 5).
- The review rule ("an order at this shop") re-checks the exact shop id, so an order at `my-shop-2` no longer unlocks reviews of `my-shop`.
- Catalogues on the shop and product pages are read with a direct, cached `/arbitrary/DOCUMENT/…` fetch instead of Hub's `FETCH_QDN_RESOURCE` (same JSON), keyed by the publisher's name.
- `resourceExists` now asks Core for the identifier as a prefix and compares exactly, because Core matches a non-prefix identifier anywhere in the id (`HSQLDBCacheUtils.filterTerm`).

#### Round 3: quality

- **Review of the whole diff** (a workflow: one reviewer per dimension — money safety, data compatibility, efficiency, phone/UX and accessibility, security — each followed by an independent verifier told to refute every finding): 43 findings, **41 confirmed**, 2 refuted. Four agents fixed them in worktrees (`q-shop-plus/fix-*`, one commit and one test per finding, the pins unchanged), merged one at a time; the lead fixed the cross-area remainder. The ones that mattered most:
  - *Money/security:* a buyer could transfer a worthless asset named "QORT" and the seller's screens showed "100 QORT" with no warning — asset names now come from the shop's accepted assets or Core's `/assets/info`, and a coin the shop doesn't take is flagged; "Check again" could attach a payment that belonged to another order — only payments signed after the checkout started, never one another order uses, and the buyer picks when several fit; one pending order could be recorded twice at once — one recording per order; a partly recorded order never sent the seller's mail — Finish sends only the missing part; carts of two owners with the same shop id merged (and paid the wrong owner) — carts are per owner and shop; a second tab wrote paid items back into the cart — carts follow other tabs; a missing rate silently switched the buyer to QORT — the coin stays, converted prices say there's no rate.
  - *Crashes:* one shop JSON with mistyped coin fields, or one catalogue product with a non-string title, crashed the home page for every visitor — shop JSON is normalised where it is read, `shopCoins`/`coinLabel` are defensive, and cards and the strip have their own error boundaries.
  - *Data:* the shop and product pages trusted a catalogue another name published under the same id (pitfall 15) — they check the publisher; publishing products rebuilt the product index from the copy loaded with the page, dropping products added from another device — it is read fresh first; in a batched publish the index could land with a missing catalogue — it is its own final batch; the seller's lists counted orders of another owner's shop with the same short id — shown apart as "Orders not counted"; an unreadable status pre-selected "Received" and let one tap overwrite a real "Shipped".
  - *UX:* "Verified buyer" is "Ordered here" (anyone can publish an order id for a fee); Hub's Back and `qortal://` links into an open tab now navigate (`useIframe`); a `Q-Shop%2B` link opens the app (`routerBase`); My orders re-reads after a checkout; dialogs can't be walked away from while publishing; the seller page follows shop switches.
- **Accessibility:** axe in `scripts/screens.mjs` (axe-core as a dev dependency). Fixed from its findings: shop cards are now a stretched title link (their name was only the title while they showed more), "Add to cart: <title>", product status chips readable in the light themes, focusable scroll regions in dialogs, a `<main>` landmark (shell). Results in the screenshot matrix below.
- **Settings sync** (Save to QDN / Restore, DOCUMENT `qshopplus_settings`), the changelog dialog and the README's + section are done.

#### Screenshot matrix (round 3, final code)

`scripts/screens.mjs Q-Shop+` against the production build with `e2e/screens.config.mjs` (14 shops with owners that have a space, a `+` and non-ASCII letters, the signed-in name's own shop, orders both ways with statuses, reviews, a two-shop cart; every write declined). Screens: home, search, the filter sheet (phones), a shop as a buyer and as its owner, a product, the cart, checkout, My orders, the seller page with its Orders and Products tabs, Settings, the account menu and a missing shop; at 360×740, 390×844 and 844×390 (touch, with a scrolled landscape shot), 700 and 1280.

| Run | Captures | Console errors | Sideways overflow | Unlabelled buttons | axe violations |
|---|---|---|---|---|---|
| Four themes, Hub dark | 292 | 0 | 0 | 0 | 0 after the last fix (the coin chips' names; home, search and filters re-run in all four themes at every size: 52 captures, 0) |
| Hub 3.0 and Q-Shop Classic, Hub light (8 main screens) | 80 | 0 | 0 | 0 | 0 |
| Real node, read-only, Hub 3.0 (9 screens) | 45 | 1 (404s for missing avatars) | 0 | 0 | fixed in the same commits as above |

axe found and the fixes removed, over the night: shop-card links named only by their title, "Add <title> to cart", the bottom bar's Cart label against its badge, New products tiles, the coin chips (all label-content-name-mismatch), and orange/blue status text on white (color-contrast). Buttons under 40 px on phones: 0.

#### Round 4: the Hub check — not possible tonight; real data checked instead

A test Hub was started next to Simon's normal Hub (`--remote-debugging-port=9223`): it opened on the **WALLET PASSWORD** lock screen for "Tester Hub". Agents never type passwords, so it was closed again (only its own processes) and the in-Hub check is left for a session with Simon (Follow-ups).

Instead, `e2e/screens.realnode.config.mjs` ran the app against **real data from the local node, read-only**: every Core GET answered by the node, Hub's reads emulated over the same GETs, every write, payment and decrypt refused. Screens: home, search ("gold"), Top rated, the largest shop (2r0y's Qortal Goldback Store, 45 products in 6 catalogues), a shop whose owner has a space and whose short id (`store`) other shops share, a real product, its reviews, the cart and Settings, at 1280, 700, 390×844, 360×740 and 844×390 (45 captures): **0 sideways overflow, 0 unlabelled buttons**, the only console errors 404s for reviewers without an avatar; a shop page made 1 search + 7 fetches, a product page 0 searches + 2 fetches, home 2 searches + the logos on screen. Checked by eye: real logos and product pictures, prices, a long plain-text description with line breaks, the gallery.

### Round 5: Simon's requests (2026-10-22)

Simon answered the night's questions (Follow-ups below) and asked for deletes. Every change below has its own commit, builds, lints and passes the whole suite (606 tests, from 559); `release/Q-Shop+.zip` rebuilt after each.

| Question | Answer | Change |
|---|---|---|
| 1. Classic text on phones | Smaller on phones | Q-Shop Classic body text is 16 px (body2 14 px) on phones; desktop keeps the original's 23 px (`1ba20cb2`) |
| 2. Trimmed shop fields, fixed coin order | Keep | none |
| 3. "Ordered here" badge | Keep | none |
| 4. Ratings on home | Stars always, Top rated weighted | Every shop card shows its stars once the shop index is in (one more search, cached); Top rated sorts by a Bayesian average with a neutral prior (3 stars, weight 3), so one 5-star review no longer beats twenty 4.8s (`87bef2be`) |
| 5. Node-blocked names hidden on home | Keep hidden | none |
| 6. One preferred coin for the app | One for the app | none |
| 7. Unconfirmed payments: 30 minutes, per device | Keep | none |
| 8. Hide a paid order that won't record | No hide | none |
| 9. Seller payment checks | Keep the address check, soften the sender one | A payment from another account than the one that owns the buyer's name now is a plain note, not a warning (names can be sold) (`ff8ec711`) |
| 10. Seller's Orders tab | Open on To handle | It opens on To handle while there are orders to handle, else All (`ad204e58`); other owners' same-id orders stay apart |
| 11. Publish needs the fresh product list | Keep the safety check | none |
| 12. Q-Assets in the official Hub | (checked) | Qortal-Hub `develop` has `TRANSFER_ASSET`, and `GET_USER_WALLET` returns an address for BTC, LTC, DOGE, DGB and RVN as for ARRR: nothing to change (those coins were then taken out, below) |
| 13. Order lists re-read after 2 minutes | Keep 2 minutes | none |

The same-identifier question ("can another name's shop with the same id get mixed up?"): fixed everywhere the app can tell the two apart (catalogues, carts, statuses, orders and review bodies are all matched by name as well as id). One limit stays, in the data itself: review identifiers carry only the short shop id, so two names' shops with the same id share their review count, as in the original.

**Deleting products and shops** (Simon: "the abilities for users that published shop or products to delete them"; his choices: delete the shop *and* its products; one or several products at once; a deleted shop's id can be used again):
- *Read side first* (`c2d943ab`): the delete marker (`"D"` or an empty body) now reads as deleted instead of a parse error retried as "not on the node yet". The shop and product pages say "This shop was deleted" from one read (no retries, no existence search), home leaves the shop out, the cart says its owner deleted it and offers Remove items, and a deleted catalogue reads as one with no products. A shop deleted and created again comes back on home once the index shows it changed.
- *Builders* (`a5430e3a`): `buildDeleteShopPublish` and `buildDeleteProductsPublish` in `qdn/payloads.ts`, pure and tested like every other write; the exact test for a shop's catalogue ids (`my-shop-2`'s aren't `my-shop`'s); the one-hour memory of this browser's deletes (the node lists a deleted shop with its old metadata until a block confirms the delete).
- *The publish dialog sends deletes* (`69da2d67`): `order="given"` (batches of 20 in order instead of the product list last) and `verb="delete"`; its QDN check after a timeout counts the marker as landed. A product publish is unchanged.
- *Products* (`36e0612d`): Select in the Products tab (tap products, Select all for what the filters show, Delete) and Delete in a published product's form; the seller page asks first, naming what goes and pointing to Retired for taking a product off sale. The product list is read fresh first (a change from another device is shown and nothing is deleted; right after this tab's own publish, while the node still serves the list from before it, it asks to try again in a minute, since the catalogues it serves could be older still), each catalogue holding one is read fresh, then one publish: the list without them first, then those catalogues without them. Their drafts go too, and a delete closed part-way leaves the page matching what landed. The fresh-list check moved to `seller/freshIndex.ts`, shared with publishing.
- *Shops* (`cff27759`): Shop tab → Advanced → Delete shop, with the shop id typed to confirm; it says what goes (the shop and its products, here and in Q-Shop), what stays (orders and reviews: buyers keep their orders, the seller keeps the order mails in Q-Mail) and that the shop's orders won't show on a seller page any more, so open orders come first. The shop, its product list and every catalogue of it (the list's, plus the seller's other catalogues of that id from one prefix search, exact ids only, already deleted ones left out) are replaced by tombstones (data contract above; the first version wrote `"D"`, which the review found breaks the original's seller menu), the shop first, in batches past 20. The shop then leaves the seller's shops, home and every list at once, its drafts go, and another of the seller's shops becomes current. Creating a shop under a deleted one's id is allowed and starts fresh (its old orders and reviews show there again, since they carry the short id).
- Tests: 44 new (the marker, the builders, the dialog's delete mode, both flows end to end against the mocked Hub and node, every stop before sending, a decline, a delete closed part-way, lists leaving a deleted shop out, creating over one).
- Screenshot check (`95cd9751`): select mode, the delete-products question and the delete-shop question in all four themes at all five sizes, Hub dark: 60 captures, 0 console errors, 0 sideways overflow, 0 unlabelled buttons, **0 axe violations**.
- Not checked in Hub yet (round 4): Hub's own confirmation for a delete's publish, and how fast the node serves a tombstone after a delete.

**Collections** (Simon, 2026-10-22: "shop owners can segregate their products into collections (with description and thumbnails)"):
- *Data* (`3130e4a8`): the collections document and the index's `collectionsId` pointer (data contract above); a reader that checks every field (any name can publish JSON under an id: text trimmed to its limit, pictures only as image data URLs, product ids once each); pure, tested builder: the document first, then the index with the pointer only when it doesn't point yet. Deleting a shop deletes its collections too.
- *Buyers* (`d0ae3dbe`): a shop with collections shows them as a row of cards above the products (picture, title, how many products; sideways scrolling). Each card is a link, `?collection=<id>`, that shows that collection's products under its picture, title and description, with the same search, filters and sorts, All products, and Share collection (`qortal://APP/Q-Shop+/<owner>/<shop>?collection=<id>`; Hub keeps the query). The document is read once, only when the index points at it, with the peer retries. A collection with none of the shop's listed products isn't offered; a link to one that's gone shows all products with a note.
- *Sellers* (`61de7c7f`): a Collections tab on the seller page (after Products): New collection opens an editor (title, description, a picture made 640 px wide, and the products from a searchable list with "Selected only"); each collection can be edited, moved up or down, or removed. Changes stay in a working copy until Publish (one publish: the document, and the first time the index's pointer, under the usual fresh-list rules); Discard drops them. Collections made on another device are never overwritten unseen: a document that exists but can't be read yet blocks editing, and it is read again just before publishing (a change since the page loaded is shown and nothing goes out; this tab's own last publish not served yet doesn't count as a change). Products the shop no longer lists are left out when publishing.
- Choices I made, open to change (Follow-ups 14–15): a product can be in several collections; inside a collection the shop's sorts apply (newest first by default), not the order the seller picked; at most 24 collections; the picture is optional (a placeholder shows without one).

**List or grid** (Simon: "the display of the products to be a list or grid"): shop pages (collections included) have a Grid / List toggle above the products, and Settings → Shopping has "Products in a shop: Automatic, Grid or List" (Automatic is today's behaviour: rows on phones, tiles elsewhere). Grid is tiles everywhere (two columns on a phone); List is one column of rows, with the start of each description on wider screens. The choice is kept with the other settings and saved by Settings → Sync (an added `productView` in the snapshot).


**Payments in QORT, ARRR and Q-Assets only** (Simon: "lets just leave QORT ARRR and Q-Assets"): BTC, LTC, DOGE, DGB and RVN are gone from every screen: the shop form (only ARRR has a payout address), the home page's "Pays in" filter (Any coin, ARRR, Qortal assets; an old `?pay=BTC` link shows every shop), the cart's coin picker and Settings → Preferred coin (QORT or ARRR, plus an asset picked in a cart). A money-code change, recorded here as round 2's were: `money/coins.ts` lists QORT and ARRR (assets as before), so `paymentRequest` refuses any other coin with "Currency not found" before anything is asked of Hub, and the rate lookup has none for them. Nothing in the pinned QORT, ARRR or asset flows changed (the pin tests pass untouched). Data compatibility: the shapes written are now only the original's plus Q-Assets; what a test build may have written is handled as in the data contract (shops read and saved without the coin, product prices kept, orders shown to the seller as an unknown coin; a saved preferred coin of BTC falls back to QORT, and Restore keeps the current coin). Tests: the BTC/LTC cases became ARRR or asset cases, plus new ones for each "no longer offered" path (a shop, an order, a saved setting, a checkout that must stop before paying).

**Products page** (Simon: "a new tab at the top to the right of Shops, called Products, which will display all products from the different sellers"; and "is there any categories for the products? I want the option to display by selected categories"):
- *Where:* `/products`. Desktop header: Shops, Products, Orders, Sell. Phone bottom bar: Shops, Products, Cart, Orders, Sell; five is the bar's most, so Settings moved to a gear in the phone header (it is also in the account menu). Home's New products strip links to it ("See all products").
- *Data* (`discovery/allProducts.ts`, `c4c65279`): every product of every listed shop, from the shops' product indexes, not their catalogues. On the local node (2026-10-22, read-only GETs): 115 shops, 113 product indexes holding 320 products in 52 kB, and 131 catalogues holding 39 MB (the pictures). Indexes are read most recently updated first, 8 at a time, only as far as the page needs: a product can't be newer than its index's last update, so one newer than every unread index's update is in its final place, and newest first needs no full read. Another sort, categories or a search read every index (one small read per shop). Catalogues are read by owner and id, only for the products on screen (or a search's, at most 30, as on a shop page). Trust as everywhere: only listed shops (deleted ones and the original's hidden test shop left out), every read under the owner's name.
- *The page* (`9945c019`): newest first in pages of 20 as you scroll, as a grid or a list (the Settings choice); each card names its shop (a link) and has Add to cart, which goes to that shop's own cart; "Your product" on your own. Search (products' title, description and category, and the shop's title and owner), sort (Newest, Oldest, Price both ways), **categories, one or several, across every shop**, and in stock only; the URL keeps them, so a link can open a filtered list, and Back from a product lands where the list was. Pull to refresh on phones. Prices are in QORT, the price every product has (a shop page shows the buyer's preferred coin).
- *Categories:* products have always had one: the seller types it (the form suggests the shop's earlier ones), so across shops they are free text: 155 different ones for those 320 products. The page groups them whatever their case and spaces ("Art" and "art " are one, shown with the spelling most products use), biggest first with their counts, with a box to find one. Desktop: a Categories button opens the list; phones: in the Filters sheet with In stock only. The chosen ones show as chips above the list (tap to remove).
- *Calls on first load* (mock node, 24 shops): 2 searches (the home page's own shop index and product-index search, cached for the session, so 0 more after home) + 8 product indexes + the catalogues of the 20 products on screen (4). Opening Categories, another sort or a search: the remaining indexes (16). No unlimited search.
- Tests: 21 new (the loader's order and frontier, the filters, categories and search across shops, one owner's catalogue never standing in for another's, and the page end to end on the mock node: what it reads, categories by case, a link with categories and a price sort, search, Add to cart, own products, deleted shops and retired products, the empty state and the phone's Filters sheet).


**Review of round 5** (deletes, collections, grid or list; three reviewers: data safety, React flows, phones and accessibility; each finding checked before it was fixed, one commit per area):
- *Deletes and the original* (`9f68990a`): a `"D"` shop breaks the original (its start-up runs `response.json()` on the seller's oldest shop, and the throw hides its "My Stores" menu, Create store included); a `"D"` catalogue crashes its shop page. Deletes now write tombstones in the original's shapes (data contract above).
- *Deleted products came back* (`e69e58dd`): a seller page loaded before a delete re-added them on its next publish. The list records `deletedProducts` and the merge drops them; the comparison and the merge keep `collectionsId`; this tab's own publishes are remembered as a chain.
- *Half-done product deletes* (`73cc7423`): catalogues now go first and the list last, a delete always waits for room in the 25 unconfirmed publishes, and Finish deleting takes out what a closed dialog left in catalogues; a catalogue this tab just sent and the node still serves differently counts as the node lagging (before, publishing twice in a row could drop the first product from its catalogue).
- *Two list writes at once* (`055033c6`): a publish and a delete started together undid each other; one product-list write at a time (`seller/listWrite.ts`).
- *Collections* (`940c3314`): a fresh read of the product list before every collections publish (a product added on another device was dropped); the working copy kept for the session; editing off while a publish prepares; Discard and the editor ask first, Remove has Undo, focus and announcements after Move.
- *Delete memory and own shops* (`0946be39`): this browser's one-hour memory of a delete only explains data older than the delete (it hid a shop created again elsewhere, and let Create shop skip reading QDN); a seller's own shop that turns out deleted drops out of their shops.
- *Cart* (`c1619ced`): the cart reads its shops fresh each visit (it offered to pay a shop deleted since, or an old payout address); a deleted shop's items say so, with Remove items.
- *Shop page* (`7ba9f938`): a collection link opens on the collection; unreadable collections say so with Retry; the Grid / List toggle sits beside the count and shows its choice in the primary colour; rows stay stacked on phones held sideways.

**Review follow-ups** (the rest of the round-5 review, and what the Products screenshots found):
- The screen-reader-only style was a page wide: in `sx` a width or height of 1 means 100 %, so each hidden span (the cards' "Shop:", the loading headings of the shop and product pages) stretched the page, and the Products page scrolled sideways at every size (2,314 px wide at 1,280). Found by the screenshot check; now 1 px (`2c944746`).
- Seller Products tab, select mode (`33378ca2`): the bar stays below the header while the list scrolls; it counts chosen products that a search or filter hides ("2 selected, 1 hidden by the search or filters", since they are deleted too); focus moves into the bar and back to Select, and Escape leaves it; "Select the products to delete" instead of "Tap…"; on phones the product count has its own line instead of squeezing beside the buttons.
- Settings (`45fabcd7`): "Product lists" (Automatic, Grid, List) moved from Shopping to Appearance, as it now covers the Products page too; the preferred coin says it is for shop pages.
- The picture uploader says "at most 640 px wide" (`d793259b`): smaller pictures aren't enlarged.

## Follow-ups

**Answered on 2026-10-22, second batch (14–20); three to build next:**
- **14 → build:** a collection opens in the order the seller picked its products (the collection's `products` array order), as the default sort inside a collection; buyers can still choose Newest, Oldest or a price sort. A product can stay in several collections.
- **15 → build:** the product page names the product's collections ("In: Gifts for friends"), each linked to `?collection=<id>`; one small read of the shop's collections document (cached; only when the product list points at one).
- **19 → build:** the product form offers a short shared category list first (e.g. Art, Books, Clothing, Digital, Electronics, Food & drink, Health & beauty, Home & garden, Services, Other), then the shop's own earlier categories; sellers can still type their own. Still the same plain-text `category` field, so the original keeps working; the Products page's categories then group better.
- **16, 17, 18, 20 → keep as built:** Automatic stays the default view; Products prices stay in QORT; Settings stays a gear in the phone header (bar: Shops, Products, Cart, Orders, Sell); the Products search keeps its cap of 30 catalogues.

**Round 5 questions, as they were asked**

14. **Collections:** a product can be in several collections, and inside a collection the products follow the shop's sort (newest first) rather than the order you picked them in. Keep, or show a collection in your picked order?
15. **Collections elsewhere:** they show on the shop page only. Also show them in the product page ("In collection: Gifts") or on the home page?
16. **List or grid:** Automatic means a list on phones and a grid on wider screens (as before). Is that the right default?
17. **Products page prices** are in QORT (every product has a QORT price). Show the buyer's preferred coin (ARRR) where the shop takes it? It costs one more read per shop on screen.
18. **Phone bottom bar:** Products took Settings' place (Shops, Products, Cart, Orders, Sell) and Settings is a gear in the header. OK, or another item out instead?
19. **Shared categories:** sellers type their own (155 different on your node, many used once), so the Products page groups only by spelling. Want a short shared list (e.g. Art, Books, Clothing, Electronics, Food, Health, Home, Services, Other) that the product form offers first? It stays a plain text field, so the original keeps working.
20. **Products search** reads at most 30 catalogues (the newest products' first), like a shop page's search, and says so when it stops short. OK?

**Answered on 2026-10-22** (see Round 5): 1 smaller Classic text on phones; 2 keep; 3 keep; 4 stars always, weighted; 5 keep hidden; 6 one for the app; 7 keep 30 minutes; 8 no hide; 9 keep the address check, soften the sender one; 10 open on To handle; 11 keep the check; 12 the official Hub has both; 13 keep 2 minutes. The questions as they were asked:

**Questions for Simon** (each is a one-line change either way)

1. **Q-Shop Classic** keeps the original's look: Raleway, 23 px body text, upper-case buttons, with its blue as the primary colour (the original used white and navy, its surfaces, as "primary", which hid every primary control). Smaller body text on phones?
2. **Shop edits** now trim payout addresses and text fields and save `supportedCoins` in a fixed order (QORT, ARRR, BTC, LTC, DOGE, DGB, RVN); the original saved them as typed. OK?
3. **Review badge:** "Ordered here" (anyone can publish an order id for one fee, so "Verified buyer" overclaimed). Keep, drop, or show it only when the seller has posted a status for that order?
4. **Home ratings** load only with the Top rated sort (one more search of up to 100 review ids). Show stars on every visit? Top rated uses the plain average with the count breaking ties: weight it by count?
5. **Blocked names on the home page:** searches use the node's `excludeblocked`, so names your node blocks are hidden (the original showed them). OK?
6. **Preferred coin** is one choice for the whole app: picking ARRR in one shop's cart switches every shop that takes ARRR. Keep, or one per shop?
7. **Unconfirmed payments:** "Check again" accepts payments signed up to 30 minutes after the checkout started, never one used by an order recorded on this device. Is 30 minutes right, and is a per-device memory enough?
8. **A paid order that keeps failing to record** can't be dismissed (only unconfirmed ones can). Add a "hide" with a strong warning?
9. **Seller payment checks** warn when a QORT payment's sender isn't the address that owns the buyer's name now (a false alarm after a name sale), and when a foreign-coin order paid an address that isn't the shop's current one. Keep both?
10. **Seller's Orders tab** opens on All with orders to handle first. Open on "To handle"? Orders of another owner's same-id shop are listed apart as "Orders not counted" and can't be opened: allow read-only?
11. **Publishing products** reads the product index fresh first; if the node answers but can't serve it, nothing is published ("try again in a minute") — also on a GO public node that may lag. When the node has products the page didn't show, the page updates and the seller presses Publish again. OK?
12. **Q-Assets:** `TRANSFER_ASSET` is in your Hub fork (qortal-requests.ts); check the official Hub has it, or asset payments fail (with a Hub error, before anything is paid). Also check that "Use my wallet address" returns an address for BTC, LTC, DOGE, DGB and RVN as it does for ARRR.
13. **Order lists** re-read when shown again after 2 minutes. Interval OK?

**Round 4 still needs a signed-in test Hub** (docs/HUB-TESTING.md; quit the normal Hub first or the test Hub can stall, and unlock it): every main screen with Tester GO's real orders (decrypting), Hub's light/dark switch, the pitfalls in docs/QORTAL.md (frame height in landscape, sticky header, toasts over the bottom bar, deep links with `+` from a chat message, Back), call counts with `hub-cdp.mjs requests`/`calls` against the original Q-Shop in a second tab, the publish and payment dialogs reached and **declined** (never confirmed), and the "Copy link" fallback on a LAN node.

**Needs a phone (GO):** the delivery form above the on-screen keyboard, gallery swipe, pull to refresh, safe areas, the 844×390 landscape layout with touch, GO's own Hub dialogs for payment and publish.

**Next pass ideas:** drafts that survive a reload (images are data URLs, so IndexedDB rather than localStorage); Hub's `SESSION_PERMISSIONS` for batched product publishing; reading orders only when they scroll into view (they are 90 kB each with pictures); a cross-shop product index (catalogues have no QDN metadata to search today).
