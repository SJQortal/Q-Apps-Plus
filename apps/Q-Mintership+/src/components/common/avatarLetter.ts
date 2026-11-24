/**
 * The letter an avatar shows for a name: its first visible grapheme,
 * upper-cased. Invisible characters (zero-width spaces, joiners, marks
 * of direction) and combining marks before it are skipped, and a letter
 * with its accents stays whole (Hub's Explorer port, 2026-11-22: a name
 * starting with U+200B got an empty circle). '?' when nothing is left.
 */
const INVISIBLE = /[\p{Cf}\p{Cc}\p{Z}ᅟᅠㅤﾠ]/gu;

export function avatarLetter(text: string): string {
  const visible = text.replace(INVISIBLE, '').replace(/^\p{M}+/u, '');
  if (!visible) return '?';
  let first: string | undefined;
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(visible);
    for (const segment of segments) {
      first = segment.segment;
      break;
    }
  } else first = [...visible][0];
  return (first ?? '?').toUpperCase();
}
