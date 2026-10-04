/**
 * Test helpers for names hiding invisible characters (NameText).
 * The impostor name is built from a code point so nothing invisible hides
 * in the source.
 */
import { HIDDEN_CHARACTERS_SR, HIDDEN_CHARACTERS_TITLE } from '../components/common/NameText'

export const BLANK = String.fromCharCode(0x2800)
export const IMPOSTOR = `Simon${BLANK}James`
export const REAL = 'Simon James'

/** The innermost element that shows `name` (with or without the screen-reader note). */
export function nameElement(container: HTMLElement, name: string): HTMLElement {
  const match = Array.from(container.querySelectorAll<HTMLElement>('span, strong, p'))
    .filter((el) => el.textContent === name || el.textContent === `${name}${HIDDEN_CHARACTERS_SR}`)
    .pop()
  if (!match) throw new Error(`no element shows ${JSON.stringify(name)}`)
  return match
}

/** Struck through, with Hub's tooltip and the screen-reader note. */
export const isStruck = (el: Element) =>
  getComputedStyle(el).textDecorationLine === 'line-through' &&
  el.getAttribute('title') === HIDDEN_CHARACTERS_TITLE &&
  (el.textContent || '').endsWith(HIDDEN_CHARACTERS_SR)
