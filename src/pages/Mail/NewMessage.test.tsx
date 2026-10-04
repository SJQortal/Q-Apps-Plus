import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
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

function renderComposer(props: { replyAll?: boolean; onRequestClose?: () => void } = {}) {
  const utils = render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <NewMessage
            inlineMode
            hideButton
            replyTo={original}
            replyAll={props.replyAll}
            setReplyTo={vi.fn()}
            setForwardInfo={vi.fn()}
            forwardInfo={null}
            onRequestClose={props.onRequestClose}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
  const quill = () => Quill.find(utils.container.querySelector('.ql-container') as HTMLElement) as Quill
  return { ...utils, quill }
}

describe('NewMessage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [])
  })

  it('opens a reply with the default props (no render loop) and quotes the original', async () => {
    const { quill } = renderComposer()
    await waitFor(() => expect(quill().getText()).toContain('alice wrote:'))
    expect(quill().getText()).toContain('See you at noon')
  })
})
