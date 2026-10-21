import { describe, expect, it } from 'vitest'
import { firstVisibleChar, hasInvisibleCharacters } from './invisibleCharacters'

/** Built from code points so no invisible character hides in this file. */
const ch = (code: number) => String.fromCharCode(code)
const BLANK = ch(0x2800) // BRAILLE PATTERN BLANK, the impostors' favourite

describe('hasInvisibleCharacters (Qortal Hub rule)', () => {
  it.each([
    ['U+2800 alone', BLANK],
    ['U+2800 inside', `Simon${BLANK}James`],
    ['U+2800 at the end', `crowetic${BLANK}`],
    ['U+2800 at the start', `${BLANK}crowetic`],
    ['U+200B zero-width space', `alice${ch(0x200b)}bob`],
    ['U+3164 Hangul filler', `alice${ch(0x3164)}`],
    ['U+00AD soft hyphen', `al${ch(0xad)}ice`],
    ['U+FEFF byte-order mark', `${ch(0xfeff)}alice`],
    ['U+FFA0 halfwidth Hangul filler', `alice${ch(0xffa0)}`],
    ['U+2060 word joiner', `alice${ch(0x2060)}bob`],
  ])('flags %s', (_label, name) => {
    expect(hasInvisibleCharacters(name)).toBe(true)
  })

  it.each([
    ['plain', 'simon'],
    ['normal space', 'Simon James'],
    ['plus', 'Q-Mail+'],
    ['accent', 'Café'],
    ['umlauts', 'Jörg Müller'],
    ['apostrophe', "O'Brien"],
    ['dot and bar', 'a.b|c'],
    ['Greek', 'Ωmega'],
    ['emoji', 'name 🚀'],
    ['CJK', '山田太郎'],
    ['Hangul syllables', '한글이름'],
    // NFKC turns these into plain spaces, so Hub does not flag them either.
    ['U+00A0 no-break space', `alice${ch(0xa0)}bob`],
    ['U+202F narrow no-break space', `alice${ch(0x202f)}bob`],
  ])('leaves a name with %s alone', (_label, name) => {
    expect(hasInvisibleCharacters(name)).toBe(false)
  })

  // Hub parity, kept on purpose: U+200D ZERO WIDTH JOINER is in Hub's range
  // (U+2000-U+200F), so a name with a joined emoji (family, profession) is
  // struck in Hub and here. Don't "fix" this into a difference from Hub.
  it('flags a joined (ZWJ) emoji sequence, exactly as Hub does', () => {
    const family = `${String.fromCodePoint(0x1f468)}${ch(0x200d)}${String.fromCodePoint(0x1f469)}${ch(0x200d)}${String.fromCodePoint(0x1f467)} Family`
    expect(hasInvisibleCharacters(family)).toBe(true)
    expect(firstVisibleChar(family)).toBe(String.fromCodePoint(0x1f468))
  })

  it('leaves U+2000-U+200A spaces alone, as NFKC makes them plain spaces (as in Hub)', () => {
    for (let code = 0x2000; code <= 0x200a; code++) {
      expect(hasInvisibleCharacters(`alice${ch(code)}bob`)).toBe(false)
    }
  })
})

describe('firstVisibleChar', () => {
  it('skips invisible characters and whitespace', () => {
    expect(firstVisibleChar(`${BLANK}Simon`)).toBe('S')
    expect(firstVisibleChar(` ${ch(0x200b)}${ch(0x3164)}bob`)).toBe('b')
    expect(firstVisibleChar(`Simon${BLANK}`)).toBe('S')
  })

  it('keeps accents, emoji and CJK whole', () => {
    expect(firstVisibleChar('élodie')).toBe('é')
    expect(firstVisibleChar('🚀rocket')).toBe('🚀')
    expect(firstVisibleChar('山田')).toBe('山')
  })

  it('returns an empty string when nothing can be seen', () => {
    expect(firstVisibleChar(`${BLANK}${BLANK}`)).toBe('')
    expect(firstVisibleChar('')).toBe('')
    expect(firstVisibleChar(undefined)).toBe('')
    expect(firstVisibleChar(null)).toBe('')
  })
})
