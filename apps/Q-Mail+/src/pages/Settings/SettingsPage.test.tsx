import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { AppShellContext, type AppShellContextValue } from '../../app-shell/AppShellContext'
import { APP_VERSION, SettingsPage } from './SettingsPage'

function renderSettings(overrides: Partial<AppShellContextValue> = {}) {
  const controller = {
    setTextSize: vi.fn(),
    setAuthOnStartup: vi.fn(),
    submitRating: vi.fn(async () => {}),
    authenticate: vi.fn(async () => {}),
  }
  const value: AppShellContextValue = {
    user: {
      address: 'QAddress1',
      name: 'alice',
      names: [{ name: 'alice' }, { name: 'alice-work' }],
    },
    userAvatar: '',
    setActiveName: vi.fn(),
    authenticate: vi.fn(async () => {}),
    controller: controller as unknown as AppShellContextValue['controller'],
    state: {
      ui: { menuOpen: false, busy: false, error: null },
      auth: { authenticated: true, identity: { name: 'alice' } },
      settings: { textSize: 'medium', authOnStartup: true, themeMode: 'hub', resolvedTheme: 'dark' },
      rating: { enabled: true, average: null, count: 0, userVote: null, loading: false },
    } as AppShellContextValue['state'],
    ...overrides,
  }
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <AppShellContext.Provider value={value}>
          <SettingsPage />
        </AppShellContext.Provider>
      </HubThemeProvider>
    </MemoryRouter>
  )
  return { value, controller }
}

describe('SettingsPage', () => {
  it('shows the Account, Appearance, Mail and About sections', () => {
    renderSettings()
    for (const title of ['Account', 'Appearance', 'Mail', 'About']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
    expect(screen.getByText(`Q-Mail+ ${APP_VERSION}`)).toBeTruthy()
  })

  it('switches the theme and saves it under the app key', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('radio', { name: /Black/ }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"black"')
    expect(document.documentElement.getAttribute('data-ui-theme')).toBe('black')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    fireEvent.click(screen.getByRole('radio', { name: /Q-Mail Classic/ }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"hub20"')
  })

  it('switches the active name and text size', () => {
    const { value, controller } = renderSettings()
    fireEvent.click(screen.getByRole('radio', { name: 'alice-work' }))
    expect(value.setActiveName).toHaveBeenCalledWith('alice-work')
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    expect(controller.setTextSize).toHaveBeenCalledWith('large')
  })

  it('opens the changelog dialog from About', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: "What's new" }))
    expect(screen.getByRole('dialog', { name: "What's new" })).toBeTruthy()
  })

  it('offers Authenticate when signed out', () => {
    const { value } = renderSettings({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Authenticate' }))
    expect(value.authenticate).toHaveBeenCalled()
  })
})
