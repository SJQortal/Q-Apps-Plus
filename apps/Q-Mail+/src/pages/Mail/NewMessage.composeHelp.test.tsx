/**
 * "Send to alias", "Cc" and "Bcc" say what they do: a tooltip on hover,
 * keyboard focus or a long press, describing the button (its name stays
 * short).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { mockQortalAction } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import { resetAvatarCache } from '../../utils/avatarCache'
import { COMPOSE_TOGGLE_HELP, NewMessage } from './NewMessage'

const address = 'QmeAddress'
const wait = (ms: number) => act(() => new Promise(resolve => setTimeout(resolve, ms)))

function renderComposer() {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <NewMessage
            inlineMode
            hideButton
            replyTo={null}
            setReplyTo={vi.fn()}
            setForwardInfo={vi.fn()}
            forwardInfo={null}
            ownedNames={['me']}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
}

const toggles = [
  { label: 'Send to alias', help: COMPOSE_TOGGLE_HELP.alias },
  { label: 'Cc', help: COMPOSE_TOGGLE_HELP.cc },
  { label: 'Bcc', help: COMPOSE_TOGGLE_HELP.bcc },
] as const

describe('Compose: what Send to alias, Cc and Bcc mean', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    resetAvatarCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [])
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
  })

  it('says what each copy is, honestly: encrypted, Cc visible, Bcc only hidden in the mail', () => {
    expect(COMPOSE_TOGGLE_HELP.alias).toMatch(/alias inbox/)
    expect(COMPOSE_TOGGLE_HELP.alias).toMatch(/still encrypted to the recipient, and you stay the sender/)
    expect(COMPOSE_TOGGLE_HELP.cc).toMatch(/own encrypted copy.*can see the Cc names/)
    expect(COMPOSE_TOGGLE_HELP.bcc).toMatch(/doesn't list Bcc names/)
    expect(COMPOSE_TOGGLE_HELP.bcc).toMatch(/public QDN record under your name.*one send id/)
    // Short: one to three sentences each.
    for (const text of Object.values(COMPOSE_TOGGLE_HELP)) {
      expect(text.split(/[.!?](\s|$)/).filter(part => part.trim()).length).toBeLessThanOrEqual(3)
    }
  })

  it.each(toggles)('$label: the tooltip opens on hover and describes the button', async ({ label, help }) => {
    renderComposer()
    const button = screen.getByRole('button', { name: label })
    // Closed, the help is the button's description (describeChild), not its name.
    expect(button.getAttribute('title')).toBe(help)
    fireEvent.mouseOver(button)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toBe(help)
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id)
    expect(screen.getByRole('button', { name: label })).toBe(button)
    // 14 px text (docs/DESIGN.md: nothing smaller).
    expect(getComputedStyle(tooltip.querySelector('.MuiTooltip-tooltip')!).fontSize).toBe('14px')
  })

  it.each(toggles)('$label: the tooltip opens on keyboard focus', async ({ label, help }) => {
    renderComposer()
    const button = screen.getByRole('button', { name: label })
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => button.focus())
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toBe(help)
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id)
  })

  it('opens on a long press on touch, not on a tap', async () => {
    renderComposer()
    const button = screen.getByRole('button', { name: 'Bcc' })
    fireEvent.touchStart(button)
    await wait(300)
    expect(screen.queryByRole('tooltip')).toBeNull()
    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2000 })
    expect(tooltip.textContent).toBe(COMPOSE_TOGGLE_HELP.bcc)
    fireEvent.touchEnd(button)
  })
})
