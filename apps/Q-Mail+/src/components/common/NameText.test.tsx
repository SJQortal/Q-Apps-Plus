import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useTheme } from '@mui/material/styles'
import { HubThemeProvider, useHubTheme, type UiThemeId } from '../../hub-theme'
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

  it('adds no element around an ordinary name unless it is styled', () => {
    wrap(
      <p data-testid="p">
        To: <NameText name="Simon James" />
      </p>
    )
    expect(screen.getByTestId('p').innerHTML).toBe('To: Simon James')
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

  it.each<UiThemeId>(['hub30', 'hub20', 'black', 'white'])(
    "uses Hub's 2px line in the %s theme's error colour",
    async (id) => {
      const seen: { errorMain?: string; setUiTheme?: (id: UiThemeId) => void } = {}
      function Probe() {
        seen.errorMain = useTheme().palette.error.main
        seen.setUiTheme = useHubTheme().setUiTheme
        return null
      }
      wrap(
        <>
          <Probe />
          <NameText name={`Simon${BLANK}James`} data-testid="n" />
          <span data-testid="ref" />
        </>
      )
      await act(async () => seen.setUiTheme!(id))
      const el = screen.getByTestId('n')
      const style = getComputedStyle(el)
      expect(style.textDecorationThickness).toBe('2px')
      // The theme's own error colour, normalised the same way as the strike's.
      const ref = screen.getByTestId('ref')
      ref.style.color = seen.errorMain!
      expect(style.textDecorationColor).toBe(getComputedStyle(ref).color)
      expect(style.textDecorationColor).not.toBe('')
    }
  )
})
