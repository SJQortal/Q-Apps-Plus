# Q-Shop+

This is the **+** version of [Qortal's Q-Shop](https://github.com/Qortal/q-shop), the decentralised marketplace Q-App, maintained in [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). It reads and writes the same QDN data as the original: shops, products, catalogues, orders, order statuses and reviews made in either app show up in both, and anything published here still opens in Q-Shop.

What it adds:

- **Finding things:** search across shops (owner, title, description), sorts (Newest, Recently active, Most products, Top rated, A–Z), filters by coin, shop pages that filter and sort every product without downloading the catalogues first, search within a shop, products as a grid or a list, product galleries, shop logos shown whole and transparent pictures without a backdrop, share links (`qortal://APP/Q-Shop+/…`).
- **Products:** every shop's products on one page, newest first, with search, sorts, one or several categories across every shop and in stock only; it reads the shops' small product lists, and pictures only for the products on screen.
- **One category list:** sellers pick a product's category from one list for every shop (eBay's top level with Amazon's names, plus Digital Goods & Software, Services and Coins & Bullion), so the Products page groups them; older products keep their own until edited.
- **Collections:** sellers group products into collections with a picture and a description, in an order they choose; buyers browse them at the top of a shop, each has its own link (`…?collection=<id>`), and product pages name the collections they are in.
- **Featured order:** sellers arrange their shop's products; shop pages open on that order, and buyers can still sort.
- **Order count:** a shop page says how many orders the shop has received (from the order ids buyers publish; not shown when another name has a shop with the same id, as their orders can't be told apart).
- **Prices in a currency:** sellers set prices in USD (or another currency) and type their own QORT and ARRR exchange rates; the app works out and publishes every product's QORT and ARRR price, and reprices them all when a rate changes. Buyers pay those prices as before; nothing is fetched from outside Qortal.
- **Buying safely:** a cart for every shop that survives a reload, a step-by-step checkout (review, delivery, confirm) with the amount frozen at Confirm, and paid orders kept until they are recorded on QDN, so a declined or timed-out recording is finished later without paying again.
- **Pay in Q-Assets:** QORT and ARRR as before, and Qortal assets (Q-Assets) through Hub's asset transfer, set per shop by the seller.
- **Orders and selling:** My orders with status filters and counts; a seller page with an overview, products (physical unless the seller picks digital), orders, reviews and shop settings; payment details checked against the chain; batched publishing for big catalogues (Core allows 25 unconfirmed transactions per account); deleting products (one or several at once) and whole shops.
- **Trusted reviews:** one per reviewer, the owner's own left out, a badge for reviewers who ordered at the shop.
- **Phones and GO:** a bottom bar (Shops, Products, Cart, Orders, Sell), a header that hides on scroll, full-screen dialogs with buttons above the keyboard, 44 px targets, a compact landscape layout.
- **The Hub 3.0 look** with four themes (Hub 3.0, Q-Shop Classic, Black, White) and a Settings page (name switcher, preferred coin, blocked names, settings sync to QDN, changelog).
- **Lighter on Qortal:** no unlimited searches, paged and cached searches, images loaded only on screen, every screen code-split (biggest chunk 342 kB, was 1,030 kB), and nothing published at start-up (the original could publish an empty product index over a shop's real one).

See `src/constants/changelog.ts` (Settings → About → What's new) for versions, and `docs/apps/Q-Shop+.md` in the monorepo for the audit, the data contract, the money-code changes and the test records.

## Develop

```bash
npm ci
npm run dev        # Qortal calls need Hub; tests use the mocks in src/test
npm test           # vitest: money and data writes are pinned by *.pin.test.tsx
npm run lint
npm run build
../../scripts/screens.mjs Q-Shop+   # every screen at five sizes in four themes, with axe (config: e2e/screens.config.mjs)
../../scripts/screens.mjs Q-Shop+ --config e2e/screens.realnode.config.mjs --themes hub30   # real data from the local node, read-only
```

Publish zips are built from the monorepo root with `scripts/build-zip.sh Q-Shop+`.

## Data

The QDN identifiers and JSON shapes are the original's (`src/qdn/identifiers.ts`, `src/qdn/payloads.ts`, `src/money/order.ts`). New data is additive only:

- shops may list the Qortal assets they take in `acceptedAssets`;
- products may carry their own price per asset (`{currency: "ASSET:<id>", value}`);
- orders paid in an asset add `payment.assetId`/`assetName`;
- collections are a DOCUMENT `q-store-collections-<shortStoreId>` under the seller's name, and the product index gains a `collectionsId` field pointing at it (both apps' product publishes keep it);
- the product index may carry `productOrder` (product ids in the seller's order) and `fiatPricing` (`{currency, rates: {QORT, ARRR?}, updated}`, or `null` once stopped); a product priced in a currency carries `fiatPrice` (`{currency, value, qort}`); its `price` list keeps the original's shape;
- settings sync is a DOCUMENT `qshopplus_settings` under the user's name (theme, preferred coin, product view);
- deletes publish over each part, since QDN can't erase anything: a deleted shop's STORE, product list, catalogues and collections become empty JSON in the original's shapes marked `deleted: true` (titled and tagged `deleted`), which the original also leaves out; deleted products leave the product list and their catalogues, which keep the original's shapes. Q-Shop+ also reads the `"D"` marker other Qortal apps write as deleted.

Browser storage uses the `qshopplus-` prefix (`src/constants/plus.ts`), so it never mixes with the original app's.

## Merging this back into Q-Shop

Q-Shop+ was imported into the monorepo with `git subtree`, so this folder's history still sits on top of Q-Shop's own: the 18 commits of [Qortal/q-shop](https://github.com/Qortal/q-shop) `main` up to `0738e27`, with their original hashes, then the Q-Shop+ commits. Everything that makes this build "Q-Shop+" rather than Q-Shop (its name, the name in copied links, the storage prefix, the settings-sync identifier, the repo links) is in `src/constants/plus.ts`, so the "Ship as Q-Shop" commit stays small. The monorepo's `scripts/upstream-pr.sh Q-Shop+` prepares the branch (docs/RELEASE.md, stage 4).
