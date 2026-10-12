/**
 * Names that hide invisible characters.
 *
 * Impostors register a developer's or a friend's name with an invisible
 * character added (most often U+2800 BRAILLE PATTERN BLANK), so the
 * name looks the same as the real one. Qortal Hub strikes such names through
 * in red wherever it shows them; Q-Mail+ does the same (NameText).
 *
 * `hasInvisibleCharacters` is copied exactly (same regex, same NFKC step)
 * from Qortal Hub's src/utils/hasInvisibleCharacters.ts, so both apps flag
 * the same names.
 * Only ever test names with it, never addresses.
 */

// Intentionally matches invisible and combining security-risk characters.
// (The disable comment sits one line lower than in Hub, where ESLint reports it.)
const INVISIBLE_CHARACTERS_REGEX = new RegExp(
  // eslint-disable-next-line no-misleading-character-class
  String.raw`[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u2800\u3164\uFEFF\uFFA0]`,
  'u'
);

export function hasInvisibleCharacters(str: string) {
  const normalized = str.normalize('NFKC');

  return INVISIBLE_CHARACTERS_REGEX.test(normalized);
}

/**
 * The first character of a name that can be seen, for an avatar's letter:
 * skips whitespace and the invisible characters above, so U+2800 then "Simon"
 * gives "S", not a blank avatar. Returns '' when there is none. Not upper-cased:
 * callers do that, as before.
 */
export function firstVisibleChar(name: string | null | undefined): string {
  if (!name) return '';
  for (const ch of name) {
    if (/\s/u.test(ch)) continue;
    if (INVISIBLE_CHARACTERS_REGEX.test(ch.normalize('NFKC'))) continue;
    return ch;
  }
  return '';
}
