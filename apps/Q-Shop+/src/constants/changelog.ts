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
      "Find things: search shops by name, title and description; sort by newest, recently active, most products, top rated (weighted by how many reviews) or A–Z; filter by the coins a shop takes; stars on every shop; a New products strip.",
      "Products: every shop's products in one place, newest first, with search, sorts, one or several categories and in stock only.",
      "Shop pages filter and sort every product (category, in stock, newest, price) and search within the shop, as a grid or a list; product pages have a picture gallery and share links.",
      "Collections: sellers group their products into collections, each with a picture and a description; buyers browse them at the top of a shop and can share a collection's link.",
      "Pay in Qortal assets (Q-Assets) as well as QORT and ARRR, when the shop takes them.",
      "A safer checkout: review, delivery and confirm steps with the amount fixed before you pay, and a payment that went through is never lost: if the order can't be recorded, it is kept so you can finish it without paying again.",
      "Your cart survives a reload, keeps every shop's items apart, and the cart button counts them.",
      "Orders: My orders with status filters and counts; for sellers, an overview, orders to handle, status updates and payment checks against the chain.",
      "Selling: a seller page with products, orders (opening on the ones to handle), reviews and shop settings, product prices per coin and asset, and big catalogues published in batches.",
      "Delete products, one or several at once, or close your shop for good: they leave your shop here and in Q-Shop, and orders keep their own copy. A deleted shop's id can be used again.",
      "Trusted reviews: one per reviewer, the shop owner's own left out, and an \"Ordered here\" badge.",
      "Built for phones and GO: a bottom bar with Shops, Products, Cart, Orders and Sell, a header that hides as you scroll, and dialogs that fill the screen.",
      "Four themes (Hub 3.0, Q-Shop Classic, Black and White) that follow Hub's light and dark mode, all readable at 4.5:1 contrast.",
      "Settings: a name switcher, your preferred coin, how shops show products (grid or list), blocked names, and Sync to save and restore your settings on QDN.",
      "Lighter on Qortal: nothing is published at start-up, searches are paged and cached, pictures load only on screen, and each page loads only when you open it.",
    ],
  },
];
