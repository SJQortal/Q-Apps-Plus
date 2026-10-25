/**
 * The countries a shop's typed "Ships to" names (the original's free text,
 * and every shop from before Q-Shop+'s list), as far as plain words tell:
 * for the shop checkup's suggestion (seller/checkup.ts) and the home page's
 * Ships to filter, for shops without a list of countries.
 */
import { ALL_COUNTRY_CODES, EU_COUNTRIES, SHIPPING_REGIONS, US, countryCode } from "./shipping";
import COUNTRY_LIST from "./countries.json";
import STATE_LIST from "./states.json";

const INHABITED = SHIPPING_REGIONS.filter((r) => r.id !== "remote").flatMap((r) => r.codes);
const regionCodes = (id: string) => SHIPPING_REGIONS.find((r) => r.id === id)?.codes ?? [];

/** A whole word or phrase, any case, letters beyond ASCII included ("Ísland", "Üle Eesti"). */
const word = (source: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, "iu");

/** Words sellers typed for the whole world, a region, or a country under another name. */
const PHRASES: [RegExp, () => readonly string[]][] = [
  [word("world ?wide|world-wide|world|anywhere|everywhere|earth|global(?:ly)?|international(?:ly)?|all countries|any country|every country|most countries|planet|milky way"), () => INHABITED],
  // "America" alone is the United States; South, Latin and Central America aren't (their regions match below).
  [word("u\\.?s\\.?a\\.?|united states|(?<!(?:south|latin|central|north)\\s)america|stateside|50 states|lower 48|conus"), () => [US]],
  // "US" and "U.S." in capitals only: "us" is also "ship to us".
  [new RegExp("(?<![\\p{L}\\p{N}])U\\.?S\\.?(?![\\p{L}\\p{N}])", "u"), () => [US]],
  [word("european union|eu"), () => EU_COUNTRIES],
  [word("europe"), () => regionCodes("europe")],
  [word("north america"), () => regionCodes("north-america")],
  [word("south america"), () => regionCodes("south-america")],
  [word("central america|caribbean"), () => regionCodes("central-america")],
  [word("latin america"), () => [...regionCodes("south-america"), ...regionCodes("central-america")]],
  [word("asia"), () => regionCodes("asia")],
  [word("middle east"), () => regionCodes("middle-east")],
  [word("africa"), () => regionCodes("africa")],
  [word("oceania"), () => regionCodes("oceania")],
  [word("uk|u\\.k\\.|great britain|britain|england|scotland|wales"), () => ["GB"]],
  [word("eesti|estonia"), () => ["EE"]],
  [word("deutschland|germany"), () => ["DE"]],
  [word("österreich|osterreich|austria"), () => ["AT"]],
  [word("schweiz|suisse|switzerland"), () => ["CH"]],
  // Not "island": "any island", "Rhode Island".
  [word("ísland|iceland"), () => ["IS"]],
  [word("polska|poland"), () => ["PL"]],
  [word("canada"), () => ["CA"]],
  // Countries in their own words.
  [word("españa"), () => ["ES"]],
  [word("italia"), () => ["IT"]],
  [word("brasil"), () => ["BR"]],
  [word("méxico"), () => ["MX"]],
  [word("nederland"), () => ["NL"]],
  [word("belgique|belgië"), () => ["BE"]],
  [word("sverige"), () => ["SE"]],
  [word("norge"), () => ["NO"]],
  [word("danmark"), () => ["DK"]],
  [word("suomi"), () => ["FI"]],
  [word("česko|česká republika"), () => ["CZ"]],
  [word("magyarország"), () => ["HU"]],
  [word("ελλάδα"), () => ["GR"]],
  [word("україна"), () => ["UA"]],
  [word("россия"), () => ["RU"]],
  [word("日本"), () => ["JP"]],
  [word("中国"), () => ["CN"]],
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
/** A US state named on its own ("Northern Colorado", "Texas only") means the United States. */
const STATE_SOURCE = (STATE_LIST as { text: string }[]).map((st) => st.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const STATE_WORDS = word(STATE_SOURCE);
const STATE_WORDS_ALL = new RegExp(`(?<![\\p{L}\\p{N}])(?:${STATE_SOURCE})(?![\\p{L}\\p{N}])`, "giu");

/**
 * The countries a shop's old typed "Ships to" names, as far as plain words
 * tell ("Worldwide", "USA (50 States)", "Europe, North America", "Üle
 * Eesti"), with the words that matched; none when nothing does ("Domestic").
 */
export function suggestShippingCountries(text: string): { codes: string[]; words: string[] } {
  const known = memo.get(text);
  if (known) return known;
  const result = suggest(text);
  if (memo.size > 500) memo.clear();
  memo.set(text, result);
  return result;
}

/** Shops repeat their text on every check: each one is worked out once. */
const memo = new Map<string, { codes: string[]; words: string[] }>();

function suggest(text: string): { codes: string[]; words: string[] } {
  const found = new Set<string>();
  const words: string[] = [];
  for (const [pattern, codes] of PHRASES) {
    const match = pattern.exec(text);
    if (!match) continue;
    words.push(match[0]);
    for (const code of codes()) found.add(code);
  }
  // Country names, outside US state names ("New Jersey" isn't Jersey).
  const outsideStates = text.replace(STATE_WORDS_ALL, " ");
  for (const country of COUNTRY_NAMES) {
    if (found.has(country.value)) continue;
    const pattern = word(country.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (pattern.test(outsideStates)) {
      words.push(country.text);
      found.add(country.value);
    }
  }
  const state = STATE_WORDS.exec(text);
  if (state && !found.has(US)) {
    words.push(state[0]);
    found.add(US);
  }
  const code = countryCode(text.trim());
  if (code) found.add(code);
  return { codes: ALL_COUNTRY_CODES.filter((c) => found.has(c)), words };
}
