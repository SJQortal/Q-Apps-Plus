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
import { ALL_COUNTRY_CODES, EU_COUNTRIES, SHIPPING_REGIONS, US, countryCode, shippingCountriesOf } from "../constants/shipping";
import COUNTRY_LIST from "../constants/countries.json";
import { FOREIGN_TICKERS } from "../money/coins";
import type { SellerRow } from "./productList";

export type CheckupKey = "categories" | "shipsTo" | "delivery" | "feeProducts" | "payments" | "details";

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
    { key: "categories", done: oldCategories.length === 0, count: oldCategories.length },
    { key: "details", done: !!args.shop.logo && !!args.shop.description?.trim() && !!args.shop.location?.trim() },
    { key: "payments", done: !missingAddress },
  ];
  if (ships) {
    items.push({ key: "shipsTo", done: !!shippingCountriesOf(args.shop) });
    items.push({ key: "delivery", done: args.hasDelivery !== false });
  }
  if (fees.length > 0) items.push({ key: "feeProducts", done: false, count: fees.length });
  return items;
}

const INHABITED = SHIPPING_REGIONS.filter((r) => r.id !== "remote").flatMap((r) => r.codes);
const regionCodes = (id: string) => SHIPPING_REGIONS.find((r) => r.id === id)?.codes ?? [];

/** A whole word or phrase, any case, letters beyond ASCII included ("Ísland", "Üle Eesti"). */
const word = (source: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, "iu");

/** Words sellers typed for the whole world, a region, or a country under another name. */
const PHRASES: [RegExp, () => readonly string[]][] = [
  [word("world ?wide|world-wide|anywhere|everywhere|earth|global(?:ly)?|international(?:ly)?|all countries|most countries|planet|milky way"), () => INHABITED],
  [word("u\\.?s\\.?a\\.?|united states|america|stateside|50 states|lower 48"), () => [US]],
  [word("european union|eu"), () => EU_COUNTRIES],
  [word("europe"), () => regionCodes("europe")],
  [word("north america"), () => regionCodes("north-america")],
  [word("south america"), () => regionCodes("south-america")],
  [word("central america|caribbean"), () => regionCodes("central-america")],
  [word("asia"), () => regionCodes("asia")],
  [word("middle east"), () => regionCodes("middle-east")],
  [word("africa"), () => regionCodes("africa")],
  [word("oceania"), () => regionCodes("oceania")],
  [word("uk|u\\.k\\.|great britain|britain|england|scotland|wales"), () => ["GB"]],
  [word("eesti|estonia"), () => ["EE"]],
  [word("deutschland|germany"), () => ["DE"]],
  [word("österreich|osterreich|austria"), () => ["AT"]],
  [word("schweiz|suisse|switzerland"), () => ["CH"]],
  [word("ísland|island|iceland"), () => ["IS"]],
  [word("polska|poland"), () => ["PL"]],
  [word("canada"), () => ["CA"]],
  // The delivery form's list names some countries formally ("Russian Federation", "Viet Nam").
  [word("russia"), () => ["RU"]],
  [word("vietnam"), () => ["VN"]],
  [word("south korea|korea"), () => ["KR"]],
  [word("czechia|czech"), () => ["CZ"]],
  [word("holland|the netherlands"), () => ["NL"]],
  [word("iran"), () => ["IR"]],
  [word("taiwan"), () => ["TW"]],
  [word("moldova"), () => ["MD"]],
  [word("north macedonia|macedonia"), () => ["MK"]],
  [word("tanzania"), () => ["TZ"]],
];

const COUNTRY_NAMES = (COUNTRY_LIST as { text: string; value: string }[]).filter((c) => c.text.length > 3);

/**
 * The countries a shop's old typed "Ships to" names, as far as plain words
 * tell ("Worldwide", "USA (50 States)", "Europe, North America", "Üle
 * Eesti"), with the words that matched; none when nothing does ("Domestic").
 */
export function suggestShippingCountries(text: string): { codes: string[]; words: string[] } {
  const found = new Set<string>();
  const words: string[] = [];
  for (const [pattern, codes] of PHRASES) {
    const match = pattern.exec(text);
    if (!match) continue;
    words.push(match[0]);
    for (const code of codes()) found.add(code);
  }
  for (const country of COUNTRY_NAMES) {
    if (found.has(country.value)) continue;
    const pattern = word(country.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (pattern.test(text)) {
      words.push(country.text);
      found.add(country.value);
    }
  }
  const code = countryCode(text.trim());
  if (code) found.add(code);
  return { codes: ALL_COUNTRY_CODES.filter((c) => found.has(c)), words };
}
