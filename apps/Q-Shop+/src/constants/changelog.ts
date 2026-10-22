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
    date: "2026-10-22",
    title: "Q-Shop+ 1.0",
    notes: [
      "Same QDN data as Q-Shop: your shops, products, orders and reviews show here, and what you publish here still opens in the original.",
      "Find things: search shops by name, title and description; sort by newest, recently active, most products, top rated or A–Z; filter by the coins a shop takes; a New products strip.",
      "Shop pages filter and sort every product (category, in stock, newest, price) and search within the shop; product pages have a picture gallery and share links.",
      "Pay in more coins: QORT and ARRR as before, plus BTC, LTC, DOGE, DGB and RVN, and Qortal assets (Q-Assets) when the shop takes them.",
      "A safer checkout: review, delivery and confirm steps with the amount fixed before you pay, and a payment that went through is never lost: if the order can't be recorded, it is kept so you can finish it without paying again.",
      "Your cart survives a reload, keeps every shop's items apart, and the cart button counts them.",
      "Orders: My orders with status filters and counts; for sellers, an overview, orders to handle, status updates and payment checks against the chain.",
      "Selling: a seller page with products, orders, reviews and shop settings, product prices per coin and asset, and big catalogues published in batches.",
      "Trusted reviews: one per reviewer, the shop owner's own left out, and an \"Ordered here\" badge.",
      "Built for phones and GO: a bottom bar with Shops, Cart, Orders, Sell and Settings, a header that hides as you scroll, and dialogs that fill the screen.",
      "Four themes (Hub 3.0, Q-Shop Classic, Black and White) that follow Hub's light and dark mode, all readable at 4.5:1 contrast.",
      "Settings: a name switcher, your preferred coin, blocked names, and Sync to save and restore your settings on QDN.",
      "Lighter on Qortal: nothing is published at start-up, searches are paged and cached, pictures load only on screen, and each page loads only when you open it.",
    ],
  },
];
