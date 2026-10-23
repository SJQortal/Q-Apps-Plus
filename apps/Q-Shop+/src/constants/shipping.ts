/**
 * Where a shop ships (Simon, 2026-10-23): the seller ticks regions (Europe,
 * North America, Asia…), each with every country in it, and can leave out
 * single countries. Countries are the delivery form's own list
 * (constants/countries.json, the original's 243, ISO codes), so a buyer's
 * country always matches one of them.
 *
 * Stored in the shop's JSON (additive) as `shippingCountries`, the codes; the
 * original's free-text `shipsTo` gets a summary in words ("Europe (except
 * Russia) and North America"), which both apps show. A shop without the list
 * keeps its typed `shipsTo`, and nothing is checked against it.
 */
import COUNTRY_LIST from "./countries.json";

export interface ShippingRegion {
  id: string;
  label: string;
  codes: readonly string[];
}

/** Every country is in exactly one region (a test checks), "remote" ones in the last, which isn't offered as a whole. */
export const SHIPPING_REGIONS: readonly ShippingRegion[] = [
  {
    id: "europe",
    label: "Europe",
    codes: ["AX", "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FO", "FI", "FR", "DE", "GI", "GR", "GG", "VA", "HU", "IS", "IE", "IM", "IT", "JE", "LV", "LI", "LT", "LU", "MK", "MT", "MD", "MC", "NL", "NO", "PL", "PT", "RO", "RU", "SM", "CS", "SK", "SI", "ES", "SJ", "SE", "CH", "TR", "UA", "GB"],
  },
  { id: "north-america", label: "North America", codes: ["US", "CA", "MX", "GL", "BM", "PM"] },
  {
    id: "central-america",
    label: "Central America and the Caribbean",
    codes: ["BZ", "CR", "SV", "GT", "HN", "NI", "PA", "AI", "AG", "AW", "BS", "BB", "VG", "KY", "CU", "DM", "DO", "GD", "GP", "HT", "JM", "MQ", "MS", "AN", "PR", "KN", "LC", "VC", "TT", "TC", "VI"],
  },
  { id: "south-america", label: "South America", codes: ["AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PY", "PE", "SR", "UY", "VE"] },
  {
    id: "asia",
    label: "Asia",
    codes: ["AF", "AM", "AZ", "BD", "BT", "IO", "BN", "KH", "CN", "GE", "HK", "IN", "ID", "JP", "KZ", "KP", "KR", "KG", "LA", "MO", "MY", "MV", "MN", "MM", "NP", "PK", "PH", "SG", "LK", "TW", "TJ", "TH", "TL", "TM", "UZ", "VN"],
  },
  { id: "middle-east", label: "Middle East", codes: ["AE", "BH", "IQ", "IR", "IL", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "YE"] },
  {
    id: "africa",
    label: "Africa",
    codes: ["DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "YT", "MA", "MZ", "NA", "NE", "NG", "RE", "RW", "SH", "ST", "SN", "SC", "SL", "SO", "ZA", "SD", "SZ", "TZ", "TG", "TN", "UG", "EH", "ZM", "ZW"],
  },
  {
    id: "oceania",
    label: "Oceania",
    codes: ["AS", "AU", "CK", "FJ", "PF", "GU", "KI", "MH", "FM", "NR", "NC", "NZ", "NU", "NF", "MP", "PW", "PG", "PN", "WS", "SB", "TK", "TO", "TV", "VU", "WF", "UM", "CX", "CC"],
  },
  { id: "remote", label: "Antarctica and remote islands", codes: ["AQ", "BV", "TF", "HM", "GS"] },
];

/** The European Union (27), a quick pick. */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

const NAMES: Record<string, string> = Object.fromEntries((COUNTRY_LIST as { text: string; value: string }[]).map((c) => [c.value, c.text]));
const CODES_BY_NAME: Record<string, string> = Object.fromEntries((COUNTRY_LIST as { text: string; value: string }[]).map((c) => [c.text.toLowerCase(), c.value]));

export const ALL_COUNTRY_CODES: readonly string[] = SHIPPING_REGIONS.flatMap((r) => r.codes);
const INHABITED = SHIPPING_REGIONS.filter((r) => r.id !== "remote").flatMap((r) => r.codes);

export function countryName(code: string): string {
  return NAMES[code] ?? code;
}

/** A country's code from its name as the delivery form writes it (any case), or null. */
export function countryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return CODES_BY_NAME[name.trim().toLowerCase()] ?? null;
}

/** The shop's list of countries, when it has one (well-formed codes only, each once, in the regions' order). */
export function shippingCountriesOf(shop: { shippingCountries?: unknown } | null | undefined): string[] | null {
  const list = shop?.shippingCountries;
  if (!Array.isArray(list)) return null;
  const known = new Set(list.filter((c): c is string => typeof c === "string" && c in NAMES));
  if (known.size === 0) return null;
  return ALL_COUNTRY_CODES.filter((c) => known.has(c));
}

/** Whether a shop ships to the delivery country: true when it keeps no list (nothing to check), or the country is unknown to the list. */
export function shipsToCountry(shop: { shippingCountries?: unknown } | null | undefined, country: string | null | undefined): boolean {
  const list = shippingCountriesOf(shop);
  if (!list) return true;
  const code = countryCode(country);
  if (!code) return true;
  return list.includes(code);
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function some(names: string[], max: number): string {
  if (names.length <= max) return listWords(names);
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/**
 * The list in words, for `shipsTo`: "Worldwide", "Worldwide except Russia",
 * "the European Union", "Europe (except Russia and Belarus) and North
 * America", "Iceland, Norway and Sweden"…
 */
export function shippingSummary(codes: readonly string[]): string {
  const chosen = new Set(codes);
  if (chosen.size === 0) return "";
  const missingInhabited = INHABITED.filter((c) => !chosen.has(c));
  if (missingInhabited.length === 0) return "Worldwide";
  if (missingInhabited.length <= 4) return `Worldwide except ${listWords(missingInhabited.map(countryName))}`;
  if (chosen.size === EU_COUNTRIES.length && EU_COUNTRIES.every((c) => chosen.has(c))) return "the European Union";
  const parts: string[] = [];
  for (const region of SHIPPING_REGIONS) {
    const inside = region.codes.filter((c) => chosen.has(c));
    if (inside.length === 0) continue;
    if (inside.length === region.codes.length) {
      parts.push(region.label);
    } else if (region.id === "europe" && EU_COUNTRIES.every((c) => chosen.has(c)) && inside.length === EU_COUNTRIES.length) {
      parts.push("the European Union");
    } else if (inside.length * 2 >= region.codes.length) {
      const out = region.codes.filter((c) => !chosen.has(c)).map(countryName);
      parts.push(`${region.label} (except ${some(out, 3)})`);
    } else if (inside.length <= 4) {
      parts.push(...inside.map(countryName));
    } else {
      parts.push(`${inside.length} countries in ${region.label}`);
    }
  }
  return listWords(parts);
}
