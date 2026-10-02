import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    mailSync: null,
    registerMailSync: vi.fn(),
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
  it('shows the Account, Appearance, Mail, Sync and About sections', () => {
    renderSettings()
    for (const title of ['Account', 'Appearance', 'Mail', 'Sync', 'About']) {
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

  it('saves the "always fetch and apply" preference under the existing key', () => {
    renderSettings()
    const toggle = screen.getByRole('switch', { name: 'Always fetch and apply published mail state' })
    expect((toggle as HTMLInputElement).checked).toBe(false)
    fireEvent.click(toggle)
    expect(window.localStorage.getItem('qmail_auto_apply_qdn_state_qaddress1')).toBe('true')
    fireEvent.click(toggle)
    expect(window.localStorage.getItem('qmail_auto_apply_qdn_state_qaddress1')).toBe('false')
  })

  it('publishes the mail state only after confirming, through the mail page\'s publish path', async () => {
    const publishMailState = vi.fn(async () => {})
    renderSettings({
      mailSync: { publishMailState, isPublishing: false, hasPendingChanges: true, publishedAppearance: null },
    })
    expect(screen.getByText('Unpublished changes. Costs one QDN publish.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(publishMailState).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Publish mail state?' })
    expect(dialog.textContent).toContain('one QDN publish')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    expect(publishMailState).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Publish mail state?' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    })
    expect(publishMailState).toHaveBeenCalledTimes(1)
  })

  it('disables Publish until the mail page has registered its publish path', () => {
    renderSettings()
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Open your mailbox first.')).toBeTruthy()
  })

  it('restores the published appearance only when asked', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '"hub30"')
    const { controller } = renderSettings({
      mailSync: {
        publishMailState: vi.fn(async () => {}),
        isPublishing: false,
        hasPendingChanges: false,
        publishedAppearance: { uiTheme: 'hub20', textSize: 'large' },
      },
    })
    // Loading the document changes nothing by itself.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"hub30"')
    expect(controller.setTextSize).not.toHaveBeenCalled()
    expect(screen.getByText('Theme: Q-Mail Classic · Text size: large')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"hub20"')
    expect(document.documentElement.getAttribute('data-ui-theme')).toBe('hub20')
    expect(controller.setTextSize).toHaveBeenCalledWith('large')
  })

  it('disables Restore when the published state has no appearance', () => {
    renderSettings({
      mailSync: {
        publishMailState: vi.fn(async () => {}),
        isPublishing: false,
        hasPendingChanges: false,
        publishedAppearance: null,
      },
    })
    expect((screen.getByRole('button', { name: 'Restore' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('The published state carries no theme or text size yet.')).toBeTruthy()
  })

  it('offers Authenticate when signed out', () => {
    const { value } = renderSettings({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Authenticate' }))
    expect(value.authenticate).toHaveBeenCalled()
  })
})
