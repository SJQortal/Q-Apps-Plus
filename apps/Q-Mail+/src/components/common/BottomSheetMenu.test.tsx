import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { BottomSheetMenu } from './BottomSheetMenu'

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

const originalMatchMedia = window.matchMedia
const items = [{ id: 'a', label: 'Archive', onSelect: vi.fn() }]

const wrap = (ui: React.ReactElement) =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  )

describe('BottomSheetMenu mounts nothing until first opened (pitfall 4)', () => {
  beforeEach(() => mockMatchMedia(['max-width:599.95px']))
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia })
  })

  it('on a phone: no sheet in the DOM while closed, the sheet once opened, kept after closing', () => {
    const { rerender, baseElement } = wrap(<BottomSheetMenu open={false} onClose={() => {}} anchorEl={null} items={items} ariaLabel="Row actions" />)
    expect(screen.queryByText('Archive')).toBeNull()
    expect(baseElement.querySelector('.MuiDrawer-root')).toBeNull()
    rerender(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <BottomSheetMenu open onClose={() => {}} anchorEl={null} items={items} ariaLabel="Row actions" />
      </HubThemeProvider>
    )
    expect(screen.getByText('Archive')).toBeTruthy()
    rerender(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <BottomSheetMenu open={false} onClose={() => {}} anchorEl={null} items={items} ariaLabel="Row actions" />
      </HubThemeProvider>
    )
    // SwipeableDrawer keeps the closed sheet mounted; that is fine once it has been used.
    expect(baseElement.querySelector('.MuiDrawer-root')).toBeTruthy()
  })

  it('on desktop: no menu in the DOM while closed', () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia })
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    const { baseElement } = wrap(<BottomSheetMenu open={false} onClose={() => {}} anchorEl={anchor} items={items} ariaLabel="Row actions" />)
    expect(baseElement.querySelector('.MuiMenu-root, .MuiPopover-root')).toBeNull()
    anchor.remove()
  })
})
