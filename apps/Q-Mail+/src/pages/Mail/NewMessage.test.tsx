import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import Quill from 'quill'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { mockQortalAction } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import { NewMessage } from './NewMessage'
import { getComposeDraftsStorageKey } from './composeDrafts'

const address = 'QmeAddress'
const original = {
  id: 'msg1',
  user: 'alice',
  subject: 'Lunch',
  createdAt: Date.now() - 60_000,
  textContentV2: '<p>See you at noon</p>',
  to: ['me', 'carl'],
  cc: ['dana'],
  attachments: [],
  generalData: { thread: [], threadV2: [] },
}

const storedDrafts = () => JSON.parse(localStorage.getItem(getComposeDraftsStorageKey(address)) || '{}')
const wait = (ms: number) => act(() => new Promise(resolve => setTimeout(resolve, ms)))

function renderComposer(props: { replyAll?: boolean; onRequestClose?: () => void } = {}) {
  const setReplyTo = vi.fn()
  const utils = render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <NewMessage
            inlineMode
            hideButton
            replyTo={original}
            replyAll={props.replyAll}
            setReplyTo={setReplyTo}
            setForwardInfo={vi.fn()}
            forwardInfo={null}
            onRequestClose={props.onRequestClose}
            ownedNames={['me']}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
  const quill = () => Quill.find(utils.container.querySelector('.ql-container') as HTMLElement) as Quill
  return { ...utils, quill }
}

describe('NewMessage replies and drafts', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [])
  })

  it('opens a reply (no render loop): the original shows above the editor, the body starts empty', async () => {
    const { quill } = renderComposer()
    const original = await screen.findByRole('region', { name: 'Original message' })
    expect(original.textContent).toContain('See you at noon')
    expect(screen.getByText(/not quoted in your reply/)).toBeTruthy()
    await wait(50)
    expect(quill().getText().trim()).toBe('')
    expect(quill().root.innerHTML).not.toContain('blockquote')
  })

  it('opening Reply saves nothing until the user writes, then saves under the reply key', async () => {
    const { quill } = renderComposer()
    await screen.findByRole('region', { name: 'Original message' })
    await wait(500)
    expect(storedDrafts()).toEqual({})

    act(() => {
      quill().insertText(0, 'Sounds good', 'user')
    })
    await waitFor(() => expect(Object.keys(storedDrafts())).toEqual(['me::alice::reply:msg1']))
    expect(storedDrafts()['me::alice::reply:msg1'].value).toContain('Sounds good')
  })

  it('opening Reply all fills Cc by itself, saves nothing, and Discard does not ask', async () => {
    const onRequestClose = vi.fn()
    const { quill } = renderComposer({ replyAll: true, onRequestClose })
    await waitFor(() => expect(screen.getByText('carl')).toBeTruthy())
    expect(screen.getByText('dana')).toBeTruthy()
    expect(screen.getByText(/Cc names are visible to every recipient/)).toBeTruthy()
    expect(quill().getText().trim()).toBe('')
    await wait(500)
    expect(storedDrafts()).toEqual({})

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(onRequestClose).toHaveBeenCalled())
    expect(screen.queryByText('Discard this message?')).toBeNull()
  })

  it('Reply all keeps its own draft key, apart from Reply', async () => {
    const { quill } = renderComposer({ replyAll: true })
    await waitFor(() => expect(screen.getByText('carl')).toBeTruthy())
    act(() => {
      quill().insertText(0, 'To everyone', 'user')
    })
    await waitFor(() => expect(Object.keys(storedDrafts())).toEqual(['me::alice::replyall:msg1']))
    const draft = storedDrafts()['me::alice::replyall:msg1']
    expect(draft.replyAll).toBe(true)
    expect(draft.ccNames.map((chip: any) => chip.name)).toEqual(['carl', 'dana'])
  })

  it('Discard asks once something was written', async () => {
    const onRequestClose = vi.fn()
    const { quill } = renderComposer({ onRequestClose })
    await screen.findByRole('region', { name: 'Original message' })
    act(() => {
      quill().insertText(0, 'Hi', 'user')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(await screen.findByText('Discard this message?')).toBeTruthy()
    expect(onRequestClose).not.toHaveBeenCalled()
  })
})
