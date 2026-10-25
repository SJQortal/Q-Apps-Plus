/**
 * The version shown in Settings → About and the changelog dialog. Keep it in
 * step with package.json's "version" (a test checks).
 */
export const APP_VERSION = "1.0.0";

export interface Release {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

/** Newest first. */
export const CHANGELOG: Release[] = [
  {
    version: "1.0.0",
    date: "2026-10-25",
    title: "Q-Shop+ 1.0",
    notes: [
      "Same QDN data as Q-Shop: your shops, products, orders and reviews show here, and what you publish here still opens in the original.",
      "Find things: search shops by name, title and description; sort by newest, recently active, most products, top rated (weighted by how many reviews) or A–Z; filter by the coins a shop takes; stars on every shop; a New products strip.",
      "Products: every shop's products in one place, newest first, with search, sorts, one or several categories, a price range and in stock only.",
      "One list of categories for every shop (based on eBay's and Amazon's), each with its icon, so the same kind of product is found together. Sellers find a category by typing what the product is (\"glasses\", \"ghee\"), and the title suggests one; products saved before keep theirs until the seller picks one.",
      "Shop pages filter and sort every product (category, price range, in stock, newest, price) and search within the shop, as a grid or a list; they open on Featured, the seller's own order, and say how many orders the shop has received. Product pages have a gallery of up to 10 pictures that zoom in full screen (pinch, wheel, double tap), share links and the collections the product is in.",
      "Descriptions with formatting (headings, bold, lists, quotes, links), kept when you paste formatted text, and Qortal links that open in Hub. Add videos (a Q-Tube link, one of your videos on Qortal, or one you upload) and PDFs (a Q-Share link, or one you upload, published to Q-Share too); they show under the product's pictures, videos in their own shape (with a thumbnail you can add) and PDFs in a preview with full screen and Light, Dim and Smart pages.",
      "A meta description for your shop (up to 70 characters, with a preview): the two lines under it in the Shops list, and what its search finds.",
      "Shop logos show whole, never cut to a square; a logo or product picture with a transparent background shows without a backdrop, and a product cut-out fits whole in its square. Shop pages put where the shop is, where it ships and what it takes beside its rating, and its description in larger text.",
      "Auctions: sell a product to the highest bidder, in QORT, with a starting bid, when it runs, an optional reserve and buy-now price, and late bids that extend it. Bidders bid on its page and see the bids so far; the winner pays the winning bid through the usual checkout, and the seller can void an absurd bid or one whose winner didn't pay. Auctions are marked on their cards with the time left, and an Auctions toggle lists them, ending soonest first.",
      "Check out several shops at once: one review, one delivery address and one confirmation, then each shop paid and its order recorded in turn. A cart with several shops shows a summary with each shop's subtotal and the total.",
      "Shops pick the countries they ship to: tick a region (Europe, North America, Asia…) for all its countries, then untick the ones you don't ship to, or the USA at a tap; within the United States, every state, the lower 48 and DC, or the states you choose. Checkout tells a buyer before paying when a shop doesn't ship to their country or state.",
      "Checkout can remember your delivery address in this browser for next time (never published; Settings shows it and forgets it).",
      "Delivery prices: in the seller page's Delivery tab, sellers price delivery by zone (countries, regions and US states): the first item, each extra item, and free delivery from an amount, in the shop's currency (USD…) with QORT and ARRR from its rates, or in QORT. Shipping profiles give some products their own prices (heavy items, say). Checkout adds the fee for the buyer's address as one more line of the order, paid with it.",
      "Variants: a product can come in variants of your own (Round, Square…), each with its own values (Pale, Orange…, with a colour circle if you like), and each with its own price, stock and picture; drag to put them in order. List them as one product buyers choose from, or each on its own. Each is a product of its own, so Q-Shop lists them too. Its page shows every item's picture, and choosing a picture chooses its item. Editing any item edits the whole product: add or take out values, rename and reorder them, and set each item's stock.",
      "A wider product form, in panels: pictures beside what it is and its price. Pictures in Shops and Products come a little closer when you point at them.",
      "Favourites: keep shops and products with the heart on their pages (or a shop card's menu), find them under the heart beside your name, and sort Shops and Products by Most loved. Hide a shop you don't want to see (Settings shows it again).",
      "Collections: sellers group their products into collections, each with a picture and a description, in the order they choose; buyers browse them at the top of a shop, switching between them smoothly, and can share a collection's link.",
      "Arrange: sellers set the order their shop's products show in, and each collection's.",
      "Prices in USD (or another currency, PLN and ISK among them, or a ticker of your own): sellers type their own exchange rates for QORT and ARRR, and every product's QORT and ARRR price follows from them; change a rate and they all change. The QORT rate sits beside Manage Shop, to change in a tap. Nothing is fetched from outside Qortal.",
      "Pay in Qortal assets (Q-Assets) as well as QORT and ARRR, when the shop takes them. Sellers find an asset as they type its name or id; an asset that can't be split is priced and paid in whole units.",
      "A safer checkout: review, delivery and confirm steps with the amount fixed before you pay, and a payment that went through is never lost: if the order can't be recorded, it is kept so you can finish it without paying again.",
      "Sellers get a clear order mail in Q-Mail: who ordered, the items with prices and the total, the payment, and where to ship it.",
      "Your cart survives a reload, keeps every shop's items apart, shows each item on one row where there's room, and the cart button counts them.",
      "Orders: My orders with status filters and counts; once an order has shipped, mark it delivered and review the shop. For sellers, an overview, orders to handle, status updates and payment checks against the chain.",
      "Selling: Create Shop until you have one, then Manage Shop (Manage on phones) opens a seller page with products, collections, orders (opening on the ones to handle), reviews, delivery and shop settings, product prices per coin and asset, new products physical unless you pick digital, and big catalogues published in batches.",
      "Delete products, one or several at once, or close your shop for good: they leave your shop here and in Q-Shop, and orders keep their own copy. A deleted shop's id can be used again.",
      "Trusted reviews: one per reviewer, the shop owner's own left out, and an \"Ordered here\" badge.",
      "Delivery options: sellers add Express, Local pickup, Tracked or their own, each priced in the zones that offer it, and buyers pick one at checkout; for a pickup, checkout asks only who collects it and how to reach them. Product pages show what delivery costs to your country, with each option, before anything goes in the cart; Shops and Products can show only what ships to your country.",
      "Shop policies: how soon an order is dispatched, whether the shop takes returns and within how long, its terms and the languages its seller answers in, shown on the shop, its products, checkout and your order; a seller away for a while says until when. Shipped orders can carry the carrier and tracking number, which the buyer copies from the order.",
      "Each shop's cart says what delivery adds before checkout, shop pages whether they ship to your country, and product pages show more from the same shop; Products keeps what you viewed lately (on this device).",
      "Sale prices: a product's price before the sale, crossed out with what buyers save, and On sale on the Products page.",
      "Prices in every coin a shop takes on its product pages (two or three side by side, more in a list), and stock counts: count a product's stock, or each variant's, and it sells out by itself.",
      "Names: buy and sell Qortal names with everything published under them, at a price or by auction, alongside the Names app's own marketplace (Settings can hide them).",
      "For sellers, the Overview shows recent activity (orders, reviews, favourites, deliveries) and a checkup that brings an older shop up to date: categories from the list, the countries it ships to, delivery prices, and products once used to charge delivery. Duplicate a product from its editor, and change several products' status at once.",
      "A walkthrough of what's new when you first open Q-Shop+, and a seller guide the first time you open your shop; both again from Settings, with Help: short answers on paying, delivery, safety, problems and selling.",
      "For sellers: products running low on the Overview, orders that say when they're due to leave, Copy address for shipping labels, and one price everywhere you ship as a first delivery zone.",
      "Built for phones and GO: a bottom bar with Shops, Products, Cart, Orders and Manage, a header that hides as you scroll, and dialogs that fill the screen.",
      "Four themes (Hub 3.0, Q-Shop Classic, Black and White) that follow Hub's light and dark mode, all readable at 4.5:1 contrast.",
      "Settings: a name switcher, your preferred coin, how shops show products (grid or list), blocked names, and Sync to save and restore your settings on QDN.",
      "Lighter on Qortal: nothing is published at start-up, searches are paged and cached, pictures load only on screen, and each page loads only when you open it.",
    ],
  },
];
