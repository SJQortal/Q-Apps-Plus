/**
 * The composer strikes names hiding invisible characters (NameText) in the
 * From choices, the To suggestions and field, Cc chips and "Replying to",
 * and still sends to the name exactly as it is.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { mockQortalAction } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import { BLANK, IMPOSTOR, REAL, isStruck, struckNames } from '../../test/hiddenNames'
import { HIDDEN_CHARACTERS_TITLE } from '../../components/common/NameText'
import { NewMessage } from './NewMessage'

const address = 'QmeAddress'
const CARL_FAKE = `carl${BLANK}`

function renderComposer(replyTo: any, replyAll = false) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <NewMessage
            inlineMode
            hideButton
            replyTo={replyTo}
            replyAll={replyAll}
            setReplyTo={vi.fn()}
            setForwardInfo={vi.fn()}
            forwardInfo={null}
            ownedNames={['me', IMPOSTOR]}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
}

describe('NewMessage and names with hidden characters', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name.length}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [{ name: IMPOSTOR }, { name: REAL }])
  })

  it('a reply all to an impostor strikes "Replying to", the To field and the impostor Cc chip', async () => {
    const original = {
      id: 'msg1',
      user: IMPOSTOR,
      subject: 'Lunch',
      createdAt: Date.now() - 60_000,
      textContentV2: '<p>hi</p>',
      to: ['me', CARL_FAKE],
      cc: ['dana'],
      attachments: [],
      generalData: { thread: [], threadV2: [] },
    }
    const { container } = renderComposer(original, true)
    await waitFor(() => expect(screen.getByText('dana')).toBeTruthy())
    await waitFor(() => expect(struckNames(container)).toContain(CARL_FAKE))
    const chip = container.querySelector('.MuiChip-root [data-hidden-characters]') as HTMLElement
    expect(isStruck(chip)).toBe(true)
    expect(screen.getByText('dana').closest('[data-hidden-characters]')).toBeNull()
    expect(struckNames(container)).toContain(IMPOSTOR) // Replying to
    const to = screen.getByPlaceholderText('Type a name or joined group') as HTMLInputElement
    expect(to.value).toBe(IMPOSTOR) // the name itself is never changed
    expect(to.getAttribute('title')).toBe(HIDDEN_CHARACTERS_TITLE)
    expect(getComputedStyle(to).textDecorationLine).toBe('line-through')
  })

  it('strikes the impostor in the From choices and To suggestions, not the real name', async () => {
    renderComposer(null)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /From/ }))
    const fromList = await screen.findByRole('listbox')
    const fromOptions = within(fromList).getAllByRole('option')
    const fromRows = fromOptions.map((o) => [struckNames(o)[0] ?? o.textContent, o.querySelector('[data-hidden-characters]') !== null])
    expect(fromRows).toContainEqual([IMPOSTOR, true])
    expect(fromRows).toContainEqual(['me', false])
    fireEvent.keyDown(fromList, { key: 'Escape' })

    const to = screen.getByPlaceholderText('Type a name or joined group') as HTMLInputElement
    fireEvent.change(to, { target: { value: 'simon' } })
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(2), { timeout: 2000 })
    const [fake, real] = screen.getAllByRole('option')
    expect(isStruck(fake.querySelector('[data-hidden-characters]')!)).toBe(true)
    expect(real.querySelector('[data-hidden-characters]')).toBeNull()
    expect(real.textContent).toContain(REAL)
    expect(getComputedStyle(to).textDecorationLine).not.toBe('line-through')
  })
})
