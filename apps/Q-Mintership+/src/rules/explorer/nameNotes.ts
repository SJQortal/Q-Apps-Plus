/**
 * Plain notes about how a name is written, for the Explorer: a name that
 * looks like an address, starts or ends like its owner's address, or holds
 * characters a reader can't see. Facts about the spelling, never a judgement
 * of the person (the words are the app's, not Dodgers' "exercise caution").
 */
export type NameNoteKind = 'addressLike' | 'ownerPrefix' | 'ownerSuffix' | 'invisible';

export interface NameNote {
  kind: NameNoteKind;
  text: string;
}

const ADDRESS_LIKE = /^[QA][1-9A-HJ-NP-Za-km-z]{25,34}$/;
/** Written as a shortened address: "Qabc…xyz" or "Qabc...xyz". */
const SHORT_ADDRESS_LIKE = /^[QA][1-9A-HJ-NP-Za-km-z]{2,10}(\.{2,}|…)[1-9A-HJ-NP-Za-km-z]{2,10}$/;
/**
 * Characters that show as nothing or as blank space: format controls,
 * zero-width characters, the Braille blank (U+2800), Hangul fillers and
 * odd spaces. An ordinary space between words is not counted.
 */
const INVISIBLE = /[\p{Cf}\u2800\u3164\uFFA0\u115F\u1160\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu;

/** How many characters of the name a reader can't see. */
export function invisibleCount(name: string): number {
  return name.match(INVISIBLE)?.length ?? 0;
}

/** The notes for one name owned by `owner` (empty for an ordinary name). */
export function nameNotes(name: string, owner: string): NameNote[] {
  const notes: NameNote[] = [];
  const trimmed = name.trim();
  if (ADDRESS_LIKE.test(trimmed) || SHORT_ADDRESS_LIKE.test(trimmed)) {
    notes.push({ kind: 'addressLike', text: 'This name is written like an address.' });
  } else if (owner.length > 10) {
    const head = owner.slice(0, 5);
    const tail = owner.slice(-5);
    if (trimmed.length >= 5 && trimmed.toLowerCase().startsWith(head.toLowerCase()))
      notes.push({
        kind: 'ownerPrefix',
        text: `This name starts with the same characters as its owner's address (${head}…).`,
      });
    if (trimmed.length >= 5 && trimmed.toLowerCase().endsWith(tail.toLowerCase()))
      notes.push({
        kind: 'ownerSuffix',
        text: `This name ends with the same characters as its owner's address (…${tail}).`,
      });
  }
  const hidden = invisibleCount(name);
  if (hidden > 0 || (name.length > 0 && trimmed.length === 0))
    notes.push({
      kind: 'invisible',
      text:
        hidden === 1
          ? 'This name contains an invisible or blank character.'
          : `This name contains ${Math.max(hidden, 1)} invisible or blank characters.`,
    });
  return notes;
}

/**
 * The name as it can be read on screen: invisible characters shown as "·"
 * inside the quotes the caller adds, so a blank name never looks empty.
 */
export function visibleName(name: string): string {
  const shown = name.replace(INVISIBLE, '·');
  return shown.trim() ? shown : '(blank name)';
}
