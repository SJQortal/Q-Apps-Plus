import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog'

function renderDialog(hiddenActions?: Parameters<typeof ShortcutsHelpDialog>[0]['hiddenActions']) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <ShortcutsHelpDialog open onClose={vi.fn()} hiddenActions={hiddenActions} />
    </HubThemeProvider>
  )
}

describe('ShortcutsHelpDialog', () => {
  it('lists every shortcut by default', () => {
    renderDialog()
    expect(screen.getByText('Go to Threads')).toBeTruthy()
    expect(screen.getByText('Go to Inbox')).toBeTruthy()
  })

  it('leaves Go to Threads out while group threads are hidden', () => {
    renderDialog(['goThreads'])
    expect(screen.queryByText('Go to Threads')).toBeNull()
    expect(screen.getByText('Go to Inbox')).toBeTruthy()
  })
})
