/**
 * The shop checkup (Simon, 2026-10-25: "for each already existing shop to
 * have it updated with the new features and to change the category of the
 * products they have, and so on... so all the shops will be properly set
 * again"). The local node's shops (read-only, 2026-10-25): of 110, one used
 * the category list, one had picked shipping countries, and many listed
 * "Shipping" or "Postage" as products to charge delivery. Only a shop's
 * owner can change it, so the checkup is theirs, on the seller page's
 * Overview: what's missing, each with the way to fix it.
 *
 * Pure: it reads the shop's JSON, its product list and the catalogues loaded
 * so far (titles, types), and whether it has delivery prices.
 */
import { isListedCategory } from "../constants/categories";
import { shippingCountriesOf } from "../constants/shipping";
import { policiesOf } from "../shop/policies";
import { FOREIGN_TICKERS } from "../money/coins";
import type { SellerRow } from "./productList";

export type CheckupKey = "products" | "categories" | "shipsTo" | "delivery" | "feeProducts" | "payments" | "details" | "policies";

export interface CheckupItem {
  key: CheckupKey;
  done: boolean;
  /** How many products it concerns (categories, fee products). */
  count?: number;
}

/** A product used to charge delivery, from before delivery prices: its title or category says so. */
const FEE_WORDS = /\b(shipping|postage|porto|versand|delivery|frakt|env[ií]o|livraison|toimitus|saatmine|tarne|s&h|p&p)\b/i;

export function isFeeProduct(row: Pick<SellerRow, "category">, title: string | undefined): boolean {
  return FEE_WORDS.test(row.category ?? "") || FEE_WORDS.test(title ?? "");
}

export interface CheckupShop {
  title?: string;
  description?: string;
  logo?: string;
  location?: string;
  shipsTo?: string;
  shippingCountries?: unknown;
  supportedCoins?: string[];
  foreignCoins?: Record<string, string>;
  policies?: unknown;
}

/**
 * What the shop still needs. `detailsOf` gives a product's catalogue entry
 * when it's loaded (its title and type); `hasDelivery` is null while the
 * delivery prices are being read.
 */
export function shopCheckup(args: {
  shop: CheckupShop;
  rows: readonly SellerRow[];
  detailsOf: (row: SellerRow) => { title?: unknown; type?: unknown } | undefined;
  hasDelivery: boolean | null;
  /** The product list has been read (until then a new shop isn't told to add products). */
  listLoaded?: boolean;
}): CheckupItem[] {
  const listed = args.rows.filter((row) => row.status !== "RETIRED");
  const titleOf = (row: SellerRow) => {
    const t = args.detailsOf(row)?.title;
    return typeof t === "string" ? t : undefined;
  };
  const oldCategories = listed.filter((row) => !isListedCategory(row.category));
  const fees = listed.filter((row) => isFeeProduct(row, titleOf(row)));
  // Physical unless every loaded product says digital (a shop whose catalogues aren't in counts as shipping).
  const loaded = listed.map((row) => args.detailsOf(row)).filter((d) => d !== undefined);
  const ships = loaded.length === 0 || loaded.some((d) => d?.type !== "digital");
  const missingAddress = FOREIGN_TICKERS.some((t) => args.shop.supportedCoins?.includes(t) && !args.shop.foreignCoins?.[t]?.trim());
  const items: CheckupItem[] = [
    // A new shop's first step.
    { key: "products", done: args.listLoaded === false || listed.length > 0 },
    { key: "categories", done: oldCategories.length === 0, count: oldCategories.length },
    { key: "details", done: !!args.shop.logo && !!args.shop.description?.trim() && !!args.shop.location?.trim() },
    { key: "payments", done: !missingAddress },
  ];
  if (ships) {
    items.push({ key: "shipsTo", done: !!shippingCountriesOf(args.shop) });
    items.push({ key: "delivery", done: args.hasDelivery !== false });
  }
  // Dispatch time and returns (shop/policies.ts): buyers far away decide on them.
  const policies = policiesOf(args.shop);
  items.push({ key: "policies", done: policies?.returnDays !== undefined && (!ships || policies.dispatchDays !== undefined) });
  if (fees.length > 0) items.push({ key: "feeProducts", done: false, count: fees.length });
  return items;
}

// Kept with the other shipping words, for the home page's Ships to filter too.
export { suggestShippingCountries } from "../constants/shippingText";

/**
 * What an owner's own shop page can tell without reading more: steps of the
 * checkup still open among the shop's details, its categories (from its
 * product list), where it ships and its policies. The page then points to
 * the full checkup in Manage Shop.
 */
export function openShopSteps(shop: CheckupShop, rows: readonly { category?: string; status?: string }[]): number {
  const listed = rows.filter((row) => row.status !== "RETIRED");
  let open = 0;
  if (listed.some((row) => !isListedCategory(row.category))) open++;
  if (!shop.logo || !shop.description?.trim() || !shop.location?.trim()) open++;
  if (listed.length > 0 && !shippingCountriesOf(shop)) open++;
  if (policiesOf(shop)?.returnDays === undefined) open++;
  return open;
}
