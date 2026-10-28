/**
 * Finding a product's category from words (constants/categoryTerms.ts):
 * - `suggestCategory(title)`: the category a product title most likely
 *   belongs to ("Blue Light Blocking Glasses | Night" → Health & Beauty,
 *   "Icelandic Grass-Fed Ghee | 800g" → Food & Drink), or null;
 * - `searchCategories(text)`: the categories a seller or buyer means by what
 *   they type ("glasses" → Health & Beauty, then Clothing for
 *   "sunglasses"), each with the word that matched.
 *
 * A title is read in words; the longest known phrase wins its words
 * ("wine glass" before "wine"), plurals count ("melons" is "melon"), and
 * the main part of the title (before "|", " - ", ",", "(", ":" or ". ") weighs
 * more, its last match (the head noun: "Blue Light Blocking *Glasses*")
 * most of all. The category names themselves count too, a little.
 */
import { SHOP_CATEGORIES, type ShopCategory } from "../constants/categories";
import { CATEGORY_TERMS } from "../constants/categoryTerms";

/** Lower case, accents off, "&" as "and", anything else between words a space. */
export function normalizeWords(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A word's possible singulars, as shop titles spell plurals: "berries" →
 * berry or berrie, "hoodies" → hoodie, "boxes" → box or boxe, "melons" →
 * melon. None for a word that isn't a plural ("glass"); "glasses" is a term
 * of its own, found before any of these is tried.
 */
export function singulars(word: string): string[] {
  const out: string[] = [];
  if (word.length > 4 && word.endsWith("ies")) out.push(`${word.slice(0, -3)}y`);
  if (word.length > 4 && /(ses|xes|zes|ches|shes)$/.test(word)) out.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) out.push(word.slice(0, -1));
  return out;
}

/** The likeliest singular ("berries" → "berry"), or the word itself. */
export function singular(word: string): string {
  return singulars(word)[0] ?? word;
}

interface TermIndex {
  terms: Map<string, ShopCategory>;
  /** Every term, for prefix search: [term, category]. */
  list: [string, ShopCategory][];
  /** The longest term, in words. */
  maxWords: number;
}

let index: TermIndex | null = null;

/** Category names as weak terms: "music", "toys", "home and garden"… */
const NAME_WEIGHT = 0.5;
const nameTerms = new Map<string, ShopCategory>();

function buildIndex(): TermIndex {
  const terms = new Map<string, ShopCategory>();
  const list: [string, ShopCategory][] = [];
  let maxWords = 1;
  for (const category of SHOP_CATEGORIES) {
    for (const raw of CATEGORY_TERMS[category].split(",")) {
      const term = normalizeWords(raw);
      if (!term || terms.has(term)) continue;
      terms.set(term, category);
      list.push([term, category]);
      maxWords = Math.max(maxWords, term.split(" ").length);
    }
    const name = normalizeWords(category);
    nameTerms.set(name, category);
    for (const part of name.split(" and ")) for (const word of part.split(" ")) if (word.length > 2) nameTerms.set(word, category);
  }
  return { terms, list, maxWords };
}

function getIndex(): TermIndex {
  if (!index) index = buildIndex();
  return index;
}

/** The category a phrase names: as written, or with its last word singular. */
function lookUp(words: string[]): { category: ShopCategory; weak: boolean } | null {
  const { terms } = getIndex();
  const phrase = words.join(" ");
  const exact = terms.get(phrase);
  if (exact) return { category: exact, weak: false };
  const forms = singulars(words[words.length - 1]).map((single) => [...words.slice(0, -1), single].join(" "));
  for (const form of forms) {
    const hit = terms.get(form);
    if (hit) return { category: hit, weak: false };
  }
  for (const form of [phrase, ...forms]) {
    const name = nameTerms.get(form);
    if (name) return { category: name, weak: true };
  }
  return null;
}

/** Each category's score for a title, highest first (zero scores left out). */
export function rankCategories(title: string): { category: ShopCategory; score: number }[] {
  const { maxWords } = getIndex();
  // The title's parts: the first is its main part.
  const parts = title.split(/\s[|\-–—:]\s|[|,(:/]|\.\s/);
  const scores = new Map<ShopCategory, number>();
  parts.forEach((part, partIndex) => {
    const words = normalizeWords(part).split(" ").filter(Boolean);
    const matches: { category: ShopCategory; weight: number }[] = [];
    let i = 0;
    while (i < words.length) {
      let found = false;
      for (let n = Math.min(maxWords, words.length - i); n >= 1; n--) {
        const hit = lookUp(words.slice(i, i + n));
        if (!hit) continue;
        matches.push({ category: hit.category, weight: (1 + (n - 1) * 1.5) * (hit.weak ? NAME_WEIGHT : 1) });
        i += n;
        found = true;
        break;
      }
      if (!found) i += 1;
    }
    const partWeight = partIndex === 0 ? 2 : 1;
    matches.forEach((m, k) => {
      // The head noun: the main part's last match.
      const head = partIndex === 0 && k === matches.length - 1 ? 2 : 0;
      scores.set(m.category, (scores.get(m.category) ?? 0) + m.weight * partWeight + head);
    });
  });
  return [...scores.entries()]
    .map(([category, score]) => ({ category, score }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || SHOP_CATEGORIES.indexOf(a.category) - SHOP_CATEGORIES.indexOf(b.category));
}

/** The category a product title most likely belongs to, or null when no word of it is known. */
export function suggestCategory(title: string): ShopCategory | null {
  return rankCategories(title)[0]?.category ?? null;
}

export interface CategoryHit {
  category: ShopCategory;
  /** The known word that matched, when it isn't the category's own name ("glasses"). */
  via?: string;
}

/**
 * The categories meant by what is typed, best first: those with a term
 * that is it exactly (or its singular), then categories whose name starts
 * with it (or a word of it does), then terms starting with it, then names
 * containing it, then terms containing it (4 letters or more). Empty: every
 * category, in the list's order.
 */
export function searchCategories(text: string): CategoryHit[] {
  const q = normalizeWords(text);
  if (!q) return SHOP_CATEGORIES.map((category) => ({ category }));
  const { list } = getIndex();
  const qs = q.split(" ");
  const qForms = new Set(singulars(qs[qs.length - 1]).map((single) => [...qs.slice(0, -1), single].join(" ")));
  const best = new Map<ShopCategory, { rank: number; via?: string }>();
  const offer = (category: ShopCategory, rank: number, via?: string) => {
    const prev = best.get(category);
    if (!prev || rank < prev.rank || (rank === prev.rank && via && prev.via && via.length < prev.via.length)) best.set(category, { rank, via });
  };
  for (const [term, category] of list) {
    if (term === q || qForms.has(term)) offer(category, 0, term);
    else if (term.startsWith(q)) offer(category, 2, term);
    else if (q.length >= 4 && term.includes(q)) offer(category, 4, term);
  }
  for (const category of SHOP_CATEGORIES) {
    const name = normalizeWords(category);
    if (name.startsWith(q) || name.split(" ").some((word) => word.startsWith(q))) offer(category, 1);
    else if (name.includes(q)) offer(category, 3);
  }
  return [...best.entries()]
    .sort((a, b) => a[1].rank - b[1].rank || SHOP_CATEGORIES.indexOf(a[0]) - SHOP_CATEGORIES.indexOf(b[0]))
    .map(([category, { rank, via }]) => (rank === 1 || rank === 3 ? { category } : { category, via }));
}

/** How many terms the list holds (for the brief and tests). */
export function termCount(): number {
  return getIndex().terms.size;
}
