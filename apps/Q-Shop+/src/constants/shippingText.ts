/**
 * The countries a shop's typed "Ships to" names (the original's free text,
 * and every shop from before Q-Shop+'s list), as far as plain words tell:
 * for the shop checkup's suggestion (seller/checkup.ts) and the home page's
 * Ships to filter, for shops without a list of countries.
 */
import { ALL_COUNTRY_CODES, EU_COUNTRIES, SHIPPING_REGIONS, US, countryCode } from "./shipping";
import COUNTRY_LIST from "./countries.json";

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
