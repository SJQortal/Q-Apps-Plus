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
      "Four themes (Hub 3.0, Q-Shop Classic, Black and White) that follow Hub's light and dark mode, all readable at 4.5:1 contrast.",
      "Built for phones and GO: a bottom bar with Shops, Cart, Orders, Sell and Settings, a header that hides as you scroll, and dialogs that fill the screen.",
      "Your cart survives a reload, and the cart button counts the items in every shop's cart.",
      "A payment that went through is never lost: if the order can't be recorded, it is kept so you can finish it without paying again.",
      "Settings: a name switcher, your preferred coin (QORT, ARRR, BTC, LTC, DOGE, DGB or RVN), blocked names, and Sync to save and restore your settings on QDN.",
      "Lighter on Qortal: nothing is published at start-up, searches are paged and cached, and each page loads only when you open it.",
    ],
  },
];
