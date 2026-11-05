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
 *
 * Within the United States a shop can ship to some states only (Simon,
 * 2026-10-23): `shippingStates`, codes of the delivery form's own state list
 * (constants/states.json: the 50 states, DC and the territories), next to
 * "US" in `shippingCountries`. Without it, every state.
 */
import COUNTRY_LIST from "./countries.json";
import STATE_LIST from "./states.json";

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

/**
 * Names to show where the delivery form's list has an official form that
 * reads badly in a list of countries ("Iran, Islamic Republic Of, Iraq,
 * Israel"; Simon, 2026-10-27): commas, brackets, odd capitals, old names.
 * Shown only: addresses keep the list's own names, as the original writes
 * them, and countryCode reads both.
 */
const PLAIN_NAMES: Record<string, string> = {
  IR: "Iran",
  PS: "Palestine",
  SY: "Syria",
  RU: "Russia",
  KR: "South Korea",
  KP: "North Korea",
  LA: "Laos",
  MK: "North Macedonia",
  FM: "Micronesia",
  MD: "Moldova",
  TW: "Taiwan",
  TZ: "Tanzania",
  CD: "DR Congo",
  VG: "British Virgin Islands",
  VI: "U.S. Virgin Islands",
  VA: "Vatican City",
  FK: "Falkland Islands",
  CC: "Cocos Islands",
  LY: "Libya",
  VN: "Vietnam",
  BN: "Brunei",
  CI: "Côte d'Ivoire",
  RW: "Rwanda",
};

/** The delivery form's own name for a country (as addresses carry it). */
const OFFICIAL_NAMES: Record<string, string> = Object.fromEntries((COUNTRY_LIST as { text: string; value: string }[]).map((c) => [c.value, c.text]));
const NAMES: Record<string, string> = { ...OFFICIAL_NAMES, ...PLAIN_NAMES };
const CODES_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(OFFICIAL_NAMES)
    .concat(Object.entries(PLAIN_NAMES))
    .map(([code, name]) => [name.toLowerCase(), code])
);

export const ALL_COUNTRY_CODES: readonly string[] = SHIPPING_REGIONS.flatMap((r) => r.codes);
const INHABITED = SHIPPING_REGIONS.filter((r) => r.id !== "remote").flatMap((r) => r.codes);

/** A country's name as the app shows it (the plain one where the list's reads badly). */
export function countryName(code: string): string {
  return NAMES[code] ?? code;
}

/** The delivery form's own name, when the app shows another (for search); else null. */
export function officialCountryName(code: string): string | null {
  return code in PLAIN_NAMES ? (OFFICIAL_NAMES[code] ?? null) : null;
}

/** A country's code from its name as the delivery form writes it, or as the app shows it (any case), or null. */
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

// ---------------------------------------------------------------- United States, by state

export const US = "US";

const STATE_NAMES: Record<string, string> = Object.fromEntries((STATE_LIST as { text: string; value: string }[]).map((st) => [st.value, st.text]));
const STATE_CODES_BY_NAME: Record<string, string> = Object.fromEntries((STATE_LIST as { text: string; value: string }[]).map((st) => [st.text.toLowerCase(), st.value]));

/** Territories in the delivery form's state list; the rest are the 50 states and DC. */
const TERRITORIES = new Set(["AS", "FM", "GU", "MH", "MP", "PW", "PR", "VI"]);

export interface StateGroup {
  id: string;
  label: string;
  codes: readonly string[];
}

/** The delivery form's states, in groups: every code is in exactly one (a test checks). */
export const US_STATE_GROUPS: readonly StateGroup[] = [
  { id: "states", label: "States", codes: Object.keys(STATE_NAMES).filter((c) => c !== "DC" && !TERRITORIES.has(c)) },
  { id: "dc", label: "District of Columbia", codes: ["DC"] },
  { id: "territories", label: "Territories", codes: Object.keys(STATE_NAMES).filter((c) => TERRITORIES.has(c)) },
];

export const ALL_STATE_CODES: readonly string[] = US_STATE_GROUPS.flatMap((g) => g.codes);

/** The contiguous states and DC: everywhere on the mainland, a common shipping zone. */
export const LOWER_48: readonly string[] = ALL_STATE_CODES.filter((c) => !TERRITORIES.has(c) && c !== "AK" && c !== "HI");

export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}

/** A state's code from its name as the delivery form writes it (any case), or null. */
export function stateCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return STATE_CODES_BY_NAME[name.trim().toLowerCase()] ?? null;
}

/** The US states the shop ships to, when it ships to some only (well-formed codes, each once, in the list's order); null: every state. */
export function shippingStatesOf(shop: { shippingStates?: unknown } | null | undefined): string[] | null {
  const list = shop?.shippingStates;
  if (!Array.isArray(list)) return null;
  const known = new Set(list.filter((c): c is string => typeof c === "string" && c in STATE_NAMES));
  if (known.size === 0) return null;
  return ALL_STATE_CODES.filter((c) => known.has(c));
}

/**
 * Whether a shop ships to the delivery address: its country (shipsToCountry),
 * then, in the United States, its state when the shop ships to some only.
 * An unknown country or state never blocks.
 */
export function shipsToAddress(
  shop: { shippingCountries?: unknown; shippingStates?: unknown } | null | undefined,
  country: string | null | undefined,
  state: string | null | undefined
): boolean {
  if (!shipsToCountry(shop, country)) return false;
  if (countryCode(country) !== US || !shippingCountriesOf(shop)) return true;
  const states = shippingStatesOf(shop);
  const code = stateCode(state);
  return !states || !code || states.includes(code);
}

/**
 * The states in words: "every state", "the lower 48 and DC", "every state
 * and territory except Alaska and Hawaii", "every state except Texas, no
 * territories", "California, Oregon and Washington", "12 states"…
 */
export function statesSummary(codes: readonly string[] | null): string {
  if (!codes) return "every state";
  const chosen = new Set(codes);
  if (ALL_STATE_CODES.every((c) => chosen.has(c))) return "every state";
  if (LOWER_48.length === chosen.size && LOWER_48.every((c) => chosen.has(c))) return "the lower 48 and DC";
  const territories = [...TERRITORIES].filter((c) => chosen.has(c)).length;
  const mainMissing = ALL_STATE_CODES.filter((c) => !TERRITORIES.has(c) && !chosen.has(c));
  const some = territories === 1 ? "1 territory" : `${territories} territories`;
  const noTerritories = territories === 0 ? ", no territories" : territories < TERRITORIES.size ? ` and ${some}` : "";
  if (mainMissing.length === 0) return territories === 0 ? "every state, no territories" : `every state and ${some}`;
  if (mainMissing.length <= 3 && chosen.size > 3) {
    const except = listWords(mainMissing.map(stateName));
    return territories === TERRITORIES.size ? `every state and territory except ${except}` : `every state except ${except}${noTerritories}`;
  }
  if (chosen.size <= 4) return listWords(codes.map(stateName));
  return territories > 0 ? `${chosen.size} states and territories` : `${chosen.size} states`;
}

/** The shop's places in words for `shipsTo`, with the US states when it ships to some only. */
export function shippingSummaryWithStates(codes: readonly string[], states: readonly string[] | null): string {
  const summary = shippingSummary(codes);
  if (!summary || !states || !codes.includes(US)) return summary;
  if (codes.length === 1) return `the United States: ${statesSummary(states)}`;
  return `${summary}; in the United States, ${statesSummary(states)}`;
}

/** The place an address is, as a shop's "doesn't ship to …" names it: "Germany", or "Alaska, United States" when only its state is out. */
export function placeNotShipped(
  shop: { shippingCountries?: unknown; shippingStates?: unknown } | null | undefined,
  country: string,
  state: string | null | undefined
): string | null {
  if (shipsToAddress(shop, country, state)) return null;
  const code = countryCode(country);
  const name = code ? countryName(code) : country;
  return shipsToCountry(shop, country) && state ? `${state}, ${name}` : name;
}

// ---------------------------------------------------------------- ships-to as region tags

/** A country's name as a tag writes it: "Antigua and Barbuda" → "antigua-and-barbuda", "Åland Islands" → "aland-islands". */
function nameSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CODES_BY_SLUG: Record<string, string> = Object.fromEntries((COUNTRY_LIST as { text: string; value: string }[]).map((c) => [nameSlug(c.text), c.value]));

/**
 * `shipsTo` as a list of region tags instead of text, as another Q-Shop build
 * writes it (seen on QDN, 2026-10-27): `["country:canada", "state:us-al", …]`,
 * a country by its slugged name in the delivery form's list, a US state by
 * its code. The original only checks that `shipsTo` is there, so it lists
 * such a shop; the + app reads the tags as countries and states, with the
 * summary in words for `shipsTo`. Null when it isn't such a list, or a tag
 * isn't one of the lists' (then nothing is checked against it).
 */
export function shippingFromTags(value: unknown): { countries: string[]; states: string[] | null; text: string } | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const countries = new Set<string>();
  const states = new Set<string>();
  for (const tag of value) {
    if (typeof tag !== "string") return null;
    const [kind, place = ""] = tag.trim().toLowerCase().split(":", 2);
    if (kind === "country" && CODES_BY_SLUG[place]) {
      countries.add(CODES_BY_SLUG[place]);
    } else if (kind === "state" && place.startsWith("us-") && place.slice(3).toUpperCase() in STATE_NAMES) {
      states.add(place.slice(3).toUpperCase());
      countries.add(US);
    } else {
      return null;
    }
  }
  const codes = ALL_COUNTRY_CODES.filter((c) => countries.has(c));
  // Every state, or the United States without a state named: the whole country.
  const someStates = states.size > 0 && ALL_STATE_CODES.some((c) => !states.has(c)) ? ALL_STATE_CODES.filter((c) => states.has(c)) : null;
  return { countries: codes, states: someStates, text: shippingSummaryWithStates(codes, someStates) };
}

/**
 * A shop's JSON with region-tag `shipsTo` (shippingFromTags) read: `shipsTo`
 * in words, and `shippingCountries` / `shippingStates` from the tags unless
 * the shop keeps its own. Anything else comes back as it is. The seller's
 * edit form reads it too, so a save from the + app writes `shipsTo` as text,
 * as the original does.
 */
export function withShippingTags<T>(json: T): T {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const shop = json as Record<string, unknown>;
  const tags = shippingFromTags(shop.shipsTo);
  if (!tags) return json;
  const ownList = shippingCountriesOf(shop) !== null;
  return {
    ...shop,
    shipsTo: tags.text,
    ...(!ownList && { shippingCountries: tags.countries }),
    ...(!ownList && tags.states && { shippingStates: tags.states }),
  } as T;
}
