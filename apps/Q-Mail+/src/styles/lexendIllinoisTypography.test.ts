import { afterEach, describe, expect, it } from 'vitest'
import { ensureLexendIllinoisTypographyStyle } from './lexendIllinoisTypography'

afterEach(() => {
  document.getElementById('qmail-typography-test')?.remove()
})

describe('ensureLexendIllinoisTypographyStyle', () => {
  it('loads Classic Roboto from the bundled WOFF2 subsets (400 and 500 only)', () => {
    const css = ensureLexendIllinoisTypographyStyle({ id: 'qmail-typography-test' }).textContent || ''
    const faces = css.match(/@font-face\s*{[^}]*}/g) || []
    expect(faces).toHaveLength(2)
    expect(css).not.toMatch(/truetype|\.ttf/)
    for (const [face, weight] of faces.map((f, i) => [f, i === 0 ? '400' : '500'] as const)) {
      expect(face).toMatch(/url\('[^']*Roboto-(Regular|Medium)[^']*\.woff2'\) format\('woff2'\)/)
      expect(face).toContain(`font-weight: ${weight};`)
      expect(face).toContain('unicode-range: U+0000-024F, U+2000-206F, U+20AC, U+2122;')
    }
  })
})
