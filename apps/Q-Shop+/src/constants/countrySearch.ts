/**
 * Finding a country by what people call it (Simon, 2026-10-26: "when user
 * types us, usa, states and similar show United States … polska would show
 * Poland"): its name in each of the app's 40 languages (shop/languages.ts,
 * from the browser's own Intl.DisplayNames, so nothing is bundled), plus
 * the nicknames below. Accents and case don't count ("Ísland", "island").
 */
import { LANGUAGES } from "../shop/languages";
import { officialCountryName } from "./shipping";

/** Short and everyday names the delivery form's list doesn't use. */
const NICKNAMES: Record<string, string[]> = {
  US: ["us", "usa", "u.s.", "u.s.a.", "states", "america", "united states of america", "stateside"],
  GB: ["uk", "u.k.", "britain", "great britain", "england", "scotland", "wales", "northern ireland"],
  AE: ["uae", "emirates"],
  NL: ["holland", "the netherlands"],
  KR: ["korea", "south korea"],
  KP: ["north korea", "dprk"],
  RU: ["russia"],
  VN: ["vietnam"],
  CZ: ["czechia", "czech"],
  IR: ["iran"],
  SY: ["syria"],
  LA: ["laos"],
  BO: ["bolivia"],
  VE: ["venezuela"],
  TZ: ["tanzania"],
  MD: ["moldova"],
  MK: ["macedonia", "north macedonia"],
  CD: ["drc", "dr congo", "congo kinshasa"],
  CG: ["congo brazzaville"],
  CI: ["ivory coast"],
  TW: ["taiwan"],
  VA: ["vatican", "holy see"],
  FM: ["micronesia"],
  PS: ["palestine"],
  BN: ["brunei"],
  CV: ["cape verde"],
  SZ: ["swaziland", "eswatini"],
  MM: ["burma"],
  TR: ["turkey", "turkiye"],
  CN: ["prc"],
  NZ: ["aotearoa"],
};

export function searchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

const names = new Map<string, string[]>();
let languages: Intl.DisplayNames[] | null = null;
const displayNames = () =>
  LANGUAGES.flatMap(({ code }) => {
    try {
      return [new Intl.DisplayNames([code], { type: "region", fallback: "none" })];
    } catch {
      return [];
    }
  });

/** Every other name a country goes by, for search (worked out once, when first searched). */
export function countryOtherNames(code: string): string[] {
  let known = names.get(code);
  if (!known) {
    const found = new Set<string>(NICKNAMES[code] ?? []);
    // The delivery form's own name, where the app shows a plain one ("Syrian Arab Republic").
    const official = officialCountryName(code);
    if (official) found.add(searchText(official));
    for (const display of (languages ??= displayNames())) {
      try {
        const name = display.of(code);
        if (name) found.add(searchText(name));
      } catch {
        // a code this browser doesn't know: its list name still matches
      }
    }
    known = [...found];
    names.set(code, known);
  }
  return known;
}

/**
 * The items that match `query`, best first: a name, code or nickname that
 * is exactly it ("us", "america"), then names that start with it, then
 * other names that do ("polska"), then a word inside a name ("Tanzania,
 * United Republic of"), then names that contain it.
 */
export function matchCountries<T>(items: readonly T[], query: string, nameOf: (item: T) => string, codeOf: (item: T) => string | null): T[] {
  const q = searchText(query);
  if (!q) return [...items];
  const ranks: [T, number][] = [];
  for (const item of items) {
    const name = searchText(nameOf(item));
    const code = codeOf(item);
    const other = code ? countryOtherNames(code) : [];
    const words = (text: string) => text.split(/[\s,()-]+/).some((w) => w.startsWith(q));
    const rank =
      name === q || code?.toLowerCase() === q || other.includes(q)
        ? 0
        : name.startsWith(q)
          ? 1
          : other.some((n) => n.startsWith(q))
            ? 2
            : words(name) || other.some(words)
              ? 3
              : name.includes(q) || (q.length >= 3 && other.some((n) => n.includes(q)))
                ? 4
                : -1;
    if (rank >= 0) ranks.push([item, rank]);
  }
  // A stable sort keeps the list's own order within each rank.
  return ranks.sort((a, b) => a[1] - b[1]).map(([item]) => item);
}
