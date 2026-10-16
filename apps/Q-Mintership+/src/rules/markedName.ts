/**
 * Names written with the blank Braille character (U+2800, "⠀"): it looks
 * like a space, so "Ada⠀" passes for "Ada" at a glance. The app crosses such
 * a name out in red wherever it shows it (components/common/MarkedName.tsx).
 */

/** U+2800, built from its code so no editor or tool swaps it for a space. */
const BRAILLE_BLANK = String.fromCharCode(0x2800);

/** Whether a name holds the blank Braille character. */
export function hasBrailleBlank(name: string | null | undefined): boolean {
  return !!name && name.includes(BRAILLE_BLANK);
}

/** The words a screen reader hears after a crossed-out name, and its tooltip. */
export const MARKED_NAME_NOTE = 'written with a blank Braille character';

/**
 * For a name where it can't be crossed out (a native select's option): the
 * note in words after it, or nothing for every other name.
 */
export function markedNameNote(name: string | null | undefined): string {
  return hasBrailleBlank(name) ? ` (${MARKED_NAME_NOTE})` : '';
}
