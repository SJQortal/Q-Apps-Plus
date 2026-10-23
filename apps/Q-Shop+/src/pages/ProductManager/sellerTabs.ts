/**
 * The seller page's tabs, in their order: the tab bar and the Overview's
 * links at its foot both list them from here.
 */
export const SELLER_TABS = ["overview", "products", "collections", "orders", "reviews", "shop"] as const;
export type SellerTab = (typeof SELLER_TABS)[number];
export const TAB_LABEL: Record<SellerTab, string> = {
  overview: "Overview",
  products: "Products",
  collections: "Collections",
  orders: "Orders",
  reviews: "Reviews",
  shop: "Shop",
};

export function isSellerTab(value: string | null): value is SellerTab {
  return !!value && (SELLER_TABS as readonly string[]).includes(value);
}
