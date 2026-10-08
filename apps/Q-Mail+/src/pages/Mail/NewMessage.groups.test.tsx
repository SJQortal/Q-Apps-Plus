/**
 * Joined groups as compose targets (a new group thread), and how they go
 * away while group threads are hidden in Settings (offerGroups).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { mockQortalAction } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import { NewMessage } from './NewMessage'

const GROUPS = [{ id: 7, name: 'Builders' }]

function renderComposer(offerGroups?: boolean) {
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
            joinedGroups={GROUPS as any}
            offerGroups={offerGroups}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
}

describe('NewMessage and joined groups', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    store.dispatch(addUser({ name: 'me', address: 'QmeAddress' } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [])
  })

  it('offers a joined group as a target and takes its name for the group', async () => {
    renderComposer()
    const to = screen.getByPlaceholderText('Type a name or joined group') as HTMLInputElement
    fireEvent.change(to, { target: { value: 'Build' } })
    expect(await screen.findByRole('option', { name: /Builders/ }, { timeout: 4000 })).toBeTruthy()
    fireEvent.change(to, { target: { value: 'Builders' } })
    expect(await screen.findByText(/Group selected: this will publish a new thread/, {}, { timeout: 4000 })).toBeTruthy()
  })

  it('with group threads hidden: no group suggestions, and a typed group name is just a name', async () => {
    renderComposer(false)
    const to = screen.getByPlaceholderText('Type a name') as HTMLInputElement
    fireEvent.change(to, { target: { value: 'Build' } })
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(screen.queryByRole('option', { name: /Builders/ })).toBeNull()
    fireEvent.change(to, { target: { value: 'Builders' } })
    // Checked as a registered name, the way any typed name is.
    expect(await screen.findByText(/Builders is a registered name/, {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText(/Group selected/)).toBeNull()
  })
})
