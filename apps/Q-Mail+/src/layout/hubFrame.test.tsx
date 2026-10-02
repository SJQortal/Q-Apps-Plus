import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme'
import { LANDSCAPE_FRAME_MEDIA, isLandscapeFrame } from '../utils/hubFrame'
import { PaneHeader, PANE_HEADER_HEIGHT, PANE_HEADER_HEIGHT_COMPACT, nextHiddenState } from './PaneHeader'
import { MailShell, PaneScroll, LIST_CLEARANCE_VAR } from './MailShell'
import { ComposeFab } from './ComposeFab'

/** matchMedia that answers true for the media queries in `matching`. */
function mockMatchMedia(matching: string[]) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matching.some((m) => query.includes(m)),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    }),
  })
}

const wrap = (ui: React.ReactElement) =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  )

const originalMatchMedia = window.matchMedia

describe('a landscape frame (844×390 in Hub is 703×201 CSS px)', () => {
  beforeEach(() => mockMatchMedia([LANDSCAPE_FRAME_MEDIA]))
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia })
  })

  it('is a short, wide frame', () => {
    expect(isLandscapeFrame(703, 201)).toBe(true)
    expect(isLandscapeFrame(360, 320)).toBe(false) // portrait with the keyboard open
    expect(isLandscapeFrame(1440, 900)).toBe(false)
    expect(LANDSCAPE_FRAME_MEDIA).toBe('(max-height: 500px) and (min-width: 600px)')
  })

  it('gives the pane header a compact bar without the subtitle', () => {
    wrap(<PaneHeader title="Inbox" subtitle="alice" />)
    const header = screen.getByRole('banner')
    expect(header.getAttribute('data-compact')).toBe('true')
    expect(screen.queryByText('alice')).toBeNull()
    expect(PANE_HEADER_HEIGHT_COMPACT).toBe(48)
    expect(PANE_HEADER_HEIGHT).toBe(56)
    // Hide-on-scroll measures from the compact height.
    expect(nextHiddenState(false, 0, 50, PANE_HEADER_HEIGHT_COMPACT)).toBe(true)
    expect(nextHiddenState(false, 0, 50, PANE_HEADER_HEIGHT)).toBe(false)
  })

  it('shows the medium layout one pane at a time: the list, or the message when one is open', () => {
    const props = {
      rail: <div>rail</div>,
      railOpen: false,
      onRailOpenChange: () => {},
      list: <div>the list</div>,
      reading: <div>the message</div>,
      readingPlaceholder: <div>pick one</div>,
      bottomNav: <nav>bottom nav</nav>,
      fab: <button>fab</button>,
    }
    const { rerender } = wrap(<MailShell mode="medium" {...props} readingOpen={false} />)
    expect(screen.getByText('the list')).toBeTruthy()
    expect(screen.queryByText('pick one')).toBeNull()
    expect(screen.queryByText('the message')).toBeNull()
    // Medium keeps its rail drawer and no phone chrome.
    expect(screen.queryByText('bottom nav')).toBeNull()
    expect(screen.queryByText('fab')).toBeNull()
    rerender(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MailShell mode="medium" {...props} readingOpen />
      </HubThemeProvider>
    )
    expect(screen.getByText('the message')).toBeTruthy()
    expect(screen.queryByText('the list')).toBeNull()
    expect(screen.getByLabelText('Reading pane')).toBeTruthy()
  })

  it('hides the floating button through its media query', () => {
    wrap(<ComposeFab onClick={() => {}} />)
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n')
    expect(css).toMatch(/@media \(max-height: ?500px\) and \(min-width: ?600px\)\{[^}]*display:none/)
  })
})

describe('the floating button never covers the last row', () => {
  it('gives the list scroller clearance on phones only while the button shows', () => {
    const props = {
      rail: <div>rail</div>,
      railOpen: false,
      onRailOpenChange: () => {},
      list: <PaneScroll data-testid="scroll">rows</PaneScroll>,
      bottomNav: <nav>bottom nav</nav>,
      fab: <button>fab</button>,
    }
    wrap(<MailShell mode="phone" {...props} />)
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n')
    expect(css).toContain(`padding-bottom:var(${LIST_CLEARANCE_VAR}, 0px)`)
    expect(css).toContain(`${LIST_CLEARANCE_VAR}:88px`)
  })
})
