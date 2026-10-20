/**
 * Search that forgives (Simon, 2026-10-17: "typing something not fully I
 * want it to also find similar"). Pure.
 *
 * Text is folded first: any case, accents and look-alike forms (NFKD),
 * invisible characters left out (a name written with a blank Braille
 * character is found by its letters), digit groups joined ("1,371,641"
 * is found as 1371641 too). Every word typed must be found, in any order:
 *
 * - a **match**: the word appears in the text, whole or in part ("crow"
 *   in "crowetic", part of an address); a number from the start of a
 *   number ("120" in "120 QORT" and "1,206", not in "1,120"); one or two
 *   letters from the start of a word ("ma" in "maps", not inside an
 *   address);
 * - **similar**: no exact place, but a word of the text is one letter
 *   off (two from 8 letters on), whole or as its start ("crowtic",
 *   "crowetik", "crwet…"), or holds the typed letters in order from its
 *   first ("crwtc" in "crowetic"). Only for words of 4 letters or more
 *   that aren't numbers: a number is found exactly or not at all.
 */

export type MatchStrength = 'match' | 'similar';

export interface SearchQuery {
  /** What was typed, trimmed. */
  text: string;
  /** Its words, folded. */
  words: string[];
}

// Characters that show nothing: zero-width and joiners, direction marks,
// the blank Braille character, Hangul fillers, BOM. (Variation selectors
// and other combining characters are marks: MARKS takes them.)
const INVISIBLE =
  /[\u00ad\u061c\u115f\u1160\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u2800\u3164\ufeff\uffa0]/g;
const MARKS = /\p{M}/gu;
// A thousands separator between digits ("1,371,641"; a no-break or thin space).
const DIGIT_GROUP = /(\d)[,\u00a0\u202f'\u2019](?=\d{3}(?!\d))/g;

/** Text made comparable: lower case, no accents or invisible characters, digit groups joined. */
export function foldText(text: string): string {
  // Digit groups first: NFKD turns a no-break space into a plain one.
  return text
    .replace(DIGIT_GROUP, '$1')
    .normalize('NFKD')
    .replace(MARKS, '')
    .replace(INVISIBLE, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words typed, or null when nothing is. */
export function parseQuery(text: string): SearchQuery | null {
  const words = foldText(text)
    .split(' ')
    .filter((word) => word !== '');
  return words.length ? { text: text.trim(), words } : null;
}

const WORD = /[\p{L}\p{N}]+/gu;

/** A folded text's words, for "similar" (letters and digits; anything else divides them). */
export function wordsOf(folded: string): string[] {
  return folded.match(WORD) ?? [];
}

/**
 * The optimal string alignment distance (Damerau–Levenshtein with adjacent
 * swaps), or `max + 1` as soon as it must exceed `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let before = new Array<number>(cols).fill(0);
  let previous = Array.from({ length: cols }, (_, j) => j);
  let current = new Array<number>(cols).fill(0);
  for (let i = 1; i < rows; i++) {
    current[0] = i;
    let best = current[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, before[j - 2] + 1);
      current[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[cols - 1];
}

function inOrder(typed: string, word: string): boolean {
  let at = 0;
  for (const char of word) if (char === typed[at] && ++at === typed.length) return true;
  return false;
}

/** Whether a typed word (folded, of letters) is close to one word of the text. */
function similarTo(typed: string, word: string): boolean {
  if (word.length < 3) return false;
  const max = typed.length >= 8 ? 2 : 1;
  if (editDistance(typed, word, max) <= max) return true;
  // The word's start, a letter more or less: a word typed only in part, with a slip.
  for (let length = typed.length - 1; length <= typed.length + 1; length++)
    if (
      length >= 3 &&
      length < word.length &&
      editDistance(typed, word.slice(0, length), max) <= max
    )
      return true;
  // Its letters in order, from the word's first, covering at least half of it.
  return (
    typed[0] === word[0] &&
    typed.length * 2 >= word.length &&
    inOrder(typed.slice(1), word.slice(1))
  );
}

/** Words that may be found as "similar": 4 letters or more, not a number. */
function forgiving(word: string): boolean {
  return word.length >= 4 && word.length <= 32 && /\p{L}/u.test(word) && !/^\d+$/.test(word);
}

/** A number typed is found from the start of a number only ("60" in "60 qort", not in "1364600"). */
function numberAt(typed: string, folded: string): boolean {
  for (let at = folded.indexOf(typed); at >= 0; at = folded.indexOf(typed, at + 1))
    if (at === 0 || !/[\d.]/.test(folded[at - 1])) return true;
  return false;
}

/** A word of one or two letters is found at the start of a word only ("ma" in "maps", not in "qmar…"). */
function wordStartAt(typed: string, folded: string): boolean {
  for (let at = folded.indexOf(typed); at >= 0; at = folded.indexOf(typed, at + 1))
    if (at === 0 || !/[\p{L}\p{N}]/u.test(folded[at - 1])) return true;
  return false;
}

/** How a typed word is found in a folded text, or null. */
function matchWord(typed: string, folded: string, words: () => string[]): MatchStrength | null {
  if (/^\d[\d.]*$/.test(typed)) return numberAt(typed, folded) ? 'match' : null;
  if (typed.length <= 2) return wordStartAt(typed, folded) ? 'match' : null;
  if (folded.includes(typed)) return 'match';
  if (!forgiving(typed)) return null;
  // Only its letters and digits count for "similar" ("crow-tic" is "crowtic").
  const bare = wordsOf(typed).join('');
  if (bare.length < 4) return null;
  return words().some((word) => similarTo(bare, word)) ? 'similar' : null;
}

/**
 * How `query` is found in `text`: 'match' when every word typed appears in
 * it, 'similar' when every word does or is close to one of its words, else
 * null. `text` may be folded already (`folded: true`) for speed.
 */
export function matchQuery(
  query: SearchQuery,
  text: string,
  options: { folded?: boolean } = {}
): MatchStrength | null {
  const folded = options.folded ? text : foldText(text);
  let words: string[] | null = null;
  const lazyWords = () => (words ??= wordsOf(folded));
  let strength: MatchStrength = 'match';
  for (const typed of query.words) {
    const found = matchWord(typed, folded, lazyWords);
    if (!found) return null;
    if (found === 'similar') strength = 'similar';
  }
  return strength;
}
