/**
 * The seller page's tabs, in their order: the tab bar and the Overview's
 * links at its foot both list them from here.
 */
export const SELLER_TABS = ["overview", "products", "collections", "orders", "reviews", "delivery", "shop"] as const;
export type SellerTab = (typeof SELLER_TABS)[number];
export const TAB_LABEL: Record<SellerTab, string> = {
  overview: "Overview",
  products: "Products",
  collections: "Collections",
  orders: "Orders",
  reviews: "Reviews",
  delivery: "Delivery",
  shop: "Shop Settings",
};

/**
 * Tabs read as one column in the middle of the page (Simon, 2026-10-23: the
 * Shop tab "could be nicely centered", Reviews "too wide"); the lists and
 * grids of the others use the page's width.
 */
export const CENTRED_TABS: ReadonlySet<SellerTab> = new Set(["reviews", "delivery", "shop"]);
export const CENTRED_WIDTH = 880;

export function isSellerTab(value: string | null): value is SellerTab {
  return !!value && (SELLER_TABS as readonly string[]).includes(value);
}
