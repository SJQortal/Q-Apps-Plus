# Q-Shop+

This is the **+** version of [Qortal's Q-Shop](https://github.com/Qortal/q-shop), the decentralised marketplace Q-App, maintained in [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). It reads and writes the same QDN data as the original: shops, products, catalogues, orders, order statuses and reviews made in either app show up in both, and anything published here still opens in Q-Shop.

What it adds:

- **Finding things:** search across shops (owner, title, description), sorts (Newest, Recently active, Most products, Top rated, A–Z), filters by coin, shop pages that filter and sort every product without downloading the catalogues first, search within a shop, products as a grid or a list, product galleries of up to 10 pictures that zoom in full screen, shop logos shown whole and transparent pictures without a backdrop, share links (`qortal://APP/Q-Shop+/…`).
- **Products:** every shop's products on one page, newest first, with search, sorts, one or several categories across every shop, a price range and in stock only; it reads the shops' small product lists, and pictures only for the products on screen.
- **Auctions:** a seller can sell a product to the highest bidder, in QORT: a starting bid, when it runs, an optional reserve and buy-now price, and late bids that extend it. Bids are small QDN documents the bidders publish, and every viewer works out the same result from them (`src/auctions/rules.ts`); the winner pays the winning bid through the usual checkout. Cards show the time left, and an Auctions toggle lists them, ending soonest first. The original Q-Shop lists an auction as out of stock.
- **One category list:** sellers pick a product's category from one list for every shop (eBay's top level with Amazon's names, plus Digital Goods & Software, Services and Coins & Bullion), so the Products page groups them; older products keep their own until edited.
- **Rich descriptions:** formatting (also when pasted), Qortal links, and videos and PDFs from Qortal: Q-Tube and Q-Share links, the seller's own videos, or a video or PDF uploaded in the editor (a PDF is published to Q-Share in its own format). Videos (in their own shape) and attachments show under the product's pictures; PDFs preview with pdf.js as Torq does in Hub, with full screen and Light, Dim and Smart pages; the original Q-Shop shows the same description as plain text.
- **Collections:** sellers group products into collections with a picture and a description, in an order they choose; buyers browse them at the top of a shop, each has its own link (`…?collection=<id>`), and product pages name the collections they are in.
- **Featured order:** sellers arrange their shop's products; shop pages open on that order, and buyers can still sort.
- **Order count:** a shop page says how many orders the shop has received (from the order ids buyers publish; not shown when another name has a shop with the same id, as their orders can't be told apart).
- **Prices in a currency:** sellers set prices in USD (or another currency) and type their own QORT and ARRR exchange rates; the app works out and publishes every product's QORT and ARRR price, and reprices them all when a rate changes (the QORT rate is beside Manage Shop in the header, to change quickly). Buyers pay those prices as before; nothing is fetched from outside Qortal.
- **Buying safely:** a cart for every shop that survives a reload, a step-by-step checkout (review, delivery, confirm) with the amount frozen at Confirm, and paid orders kept until they are recorded on QDN, so a declined or timed-out recording is finished later without paying again. Several shops can be checked out at once (one review, one address, then each shop paid and recorded in turn), and the delivery address can be remembered on the device.
- **Shipping countries:** shops tick the countries they ship to, a whole region at a time with exceptions (or the USA at a tap, and within it every state, the lower 48 and DC, or single states); checkout stops an order to a country or US state the shop doesn't ship to before anything is paid.
- **Variants:** a new product can come in up to 24 variants (up to 3 options of the seller's own, Size, Colour…), each with its own price and picture, listed as one product buyers choose from or each on its own. Each variant is a product of its own (additive `variant` fields and `variantGroups` on the product list), so the cart, checkout and orders don't change and the original Q-Shop lists each as an item for sale.
- **Favourites:** a heart on every shop and product page and in a shop card's menu keeps it as a favourite (one small public DOCUMENT per favourite under the buyer's name, `q-store-favs-…` / `q-store-favp-…`); the heart beside the name opens Favourites (Shops and Products apart), and Shops and Products sort by Most loved. Hide shop leaves a shop out of the lists on this device.
- **Delivery prices:** a Delivery tab on the seller page prices delivery by zone (regions, countries and US states): the first item, each extra item, and free delivery from an amount, in the shop's currency with QORT and ARRR from its rates, or in QORT; shipping profiles give chosen products their own zones and prices. Checkout adds the fee for the address as one more order line (`q-store-delivery`), which the original Q-Shop shows as a line of the total; an address a product isn't delivered to stops before paying.
- **Pay in Q-Assets:** QORT and ARRR as before, and Qortal assets (Q-Assets) through Hub's asset transfer, set per shop by the seller.
- **Orders and selling:** My orders with status filters and counts; a seller page with an overview, products (physical unless the seller picks digital), collections, orders, reviews, delivery and shop settings (with a meta description of up to 70 characters, the two lines under the shop in the list), opened from Manage Shop; payment details checked against the chain; batched publishing for big catalogues (Core allows 25 unconfirmed transactions per account); deleting products (one or several at once) and whole shops.
- **Trusted reviews:** one per reviewer, the owner's own left out, a badge for reviewers who ordered at the shop.
- **Phones and GO:** a bottom bar (Shops, Products, Cart, Orders, Manage), a header that hides on scroll, full-screen dialogs with buttons above the keyboard, 44 px targets, a compact landscape layout.
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
- shops may list the countries they ship to in `shippingCountries` (ISO codes; `shipsTo` is written from them in words), and the US states in `shippingStates` when they ship to some only;
- an auction's terms are an `auction` field on the product (stored out of stock at its starting bid, so the original can't sell it), its times an `auction` field in its product-list row, and bids are DOCUMENTs `q-store-bid-<shortStoreId>-<productUid>-<uid>` under each bidder's name; a won auction's order is the original's shape at the winning bid, with an added `auctionWin`;
- settings sync is a DOCUMENT `qshopplus_settings` under the user's name (theme, preferred coin, product view);
- deletes publish over each part, since QDN can't erase anything: a deleted shop's STORE, product list, catalogues and collections become empty JSON in the original's shapes marked `deleted: true` (titled and tagged `deleted`), which the original also leaves out; deleted products leave the product list and their catalogues, which keep the original's shapes. Q-Shop+ also reads the `"D"` marker other Qortal apps write as deleted.

Browser storage uses the `qshopplus-` prefix (`src/constants/plus.ts`), so it never mixes with the original app's.

## Merging this back into Q-Shop

Q-Shop+ was imported into the monorepo with `git subtree`, so this folder's history still sits on top of Q-Shop's own: the 18 commits of [Qortal/q-shop](https://github.com/Qortal/q-shop) `main` up to `0738e27`, with their original hashes, then the Q-Shop+ commits. Everything that makes this build "Q-Shop+" rather than Q-Shop (its name, the name in copied links, the storage prefix, the settings-sync identifier, the repo links) is in `src/constants/plus.ts`, so the "Ship as Q-Shop" commit stays small. The monorepo's `scripts/upstream-pr.sh Q-Shop+` prepares the branch (docs/RELEASE.md, stage 4).
