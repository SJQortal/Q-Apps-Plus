import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { HIDDEN_CHARACTERS_SR, HIDDEN_CHARACTERS_TITLE, NameText } from './NameText'

const BLANK = String.fromCharCode(0x2800)
const struck = (el: Element) => getComputedStyle(el).textDecorationLine === 'line-through'

const wrap = (ui: React.ReactElement) =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  )

describe('NameText', () => {
  it('strikes a name with a hidden character through, with a tooltip and a screen-reader note', () => {
    wrap(<NameText name={`Simon${BLANK}James`} data-testid="n" />)
    const el = screen.getByTestId('n')
    expect(el.tagName).toBe('SPAN')
    expect(struck(el)).toBe(true)
    expect(el.getAttribute('title')).toBe(HIDDEN_CHARACTERS_TITLE)
    expect(el.textContent).toBe(`Simon${BLANK}James${HIDDEN_CHARACTERS_SR}`)
  })

  it('leaves an ordinary name alone', () => {
    wrap(<NameText name="Simon James" data-testid="n" />)
    const el = screen.getByTestId('n')
    expect(struck(el)).toBe(false)
    expect(el.hasAttribute('title')).toBe(false)
    expect(el.textContent).toBe('Simon James')
  })

  it('does not strike an address (callers pass names only)', () => {
    // An address has no invisible characters, so even a wrong call is harmless.
    wrap(<NameText name="QbpZL12lh1mXhN5YqPmEq6G4h3ws4R2mDR" data-testid="n" />)
    expect(struck(screen.getByTestId('n'))).toBe(false)
  })

  it('keeps the name byte-for-byte and lets children replace the visible text', () => {
    wrap(
      <NameText name={`bob${BLANK}`} data-testid="n" component="strong" sx={{ fontWeight: 700 }}>
        <mark>bo</mark>b{BLANK}
      </NameText>
    )
    const el = screen.getByTestId('n')
    expect(el.tagName).toBe('STRONG')
    expect(el.querySelector('mark')?.textContent).toBe('bo')
    expect(struck(el)).toBe(true)
    expect(getComputedStyle(el).fontWeight).toBe('700')
  })
})
