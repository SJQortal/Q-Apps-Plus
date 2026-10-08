import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { addToHashMapMail, setReadState } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetEarlierMessagesCache } from './earlierMessages'
import { resetSubjectCache } from '../../utils/subjectCache'
import { GroupedMailboxList } from './GroupedMailboxList'

const attachment = { name: 'carol', service: 'ATTACHMENT_PRIVATE', identifier: 'att1', originalFilename: 'plan.txt', type: 'text/plain', size: 120 }
const row = { id: 'c1', user: 'carol', createdAt: 1_000 }

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  store.dispatch(setReadState({ address: 'QAlice', entries: {} }))
  return store
}

function renderList(store: ReturnType<typeof makeStore>, openMessage: (...args: any[]) => unknown = () => {}) {
  render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <GroupedMailboxList messages={[row]} mailboxType="inbox" openMessage={openMessage} />
      </HubThemeProvider>
    </Provider>
  )
}

describe('attachments from a list row', () => {
  beforeEach(() => {
    resetSubjectCache()
    resetEarlierMessagesCache()
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
  })

  it('a decrypted message: the paperclip lists its attachments with no request and no open', async () => {
    const store = makeStore()
    store.dispatch(addToHashMapMail({ id: 'c1', user: 'carol', isValid: true, subject: 'Plans', createdAt: 1_000, attachments: [attachment] }))
    renderList(store)
    fireEvent.click(screen.getByRole('button', { name: 'Attachments: Plans' }))
    expect(await screen.findByText('plan.txt')).toBeTruthy()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
    // Not marked read.
    expect(store.getState().mail.readState.c1).toBeUndefined()
  })

  it('a locked message: "Attachments" in its menu decrypts it first, without opening or marking it read', async () => {
    const store = makeStore()
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ owner: `Q${request.name}` }))
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PK' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', () =>
      btoa(JSON.stringify({ subject: 'Plans', createdAt: 1_000, version: 1, attachments: [attachment], textContentV2: '<p>x</p>', generalData: { thread: [], threadV2: [] } }))
    )
    renderList(store)
    fireEvent.contextMenu(document.querySelector('[data-message-row="c1"] button') as HTMLElement, { clientX: 20, clientY: 20 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Attachments' }))
    expect(await screen.findByText('plan.txt', {}, { timeout: 4000 })).toBeTruthy()
    // The real subject replaces "Locked · open to read".
    expect(screen.getByRole('dialog').textContent).toContain('Plans')
    expect(qortalCalls('FETCH_QDN_RESOURCE').map((request) => request.identifier)).toEqual(['c1'])
    expect(store.getState().mail.readState.c1).toBeUndefined()
    expect(store.getState().mail.hashMapMailMessages.c1).toBeUndefined()
  })

  it('"Open message" opens it with the copy decrypted here, so it is not fetched twice', async () => {
    const store = makeStore()
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ owner: `Q${request.name}` }))
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PK' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', () =>
      btoa(JSON.stringify({ subject: 'Plans', createdAt: 1_000, version: 1, attachments: [attachment], textContentV2: '<p>x</p>', generalData: { thread: [], threadV2: [] } }))
    )
    const openMessage = vi.fn()
    renderList(store, openMessage)
    fireEvent.contextMenu(document.querySelector('[data-message-row="c1"] button') as HTMLElement, { clientX: 20, clientY: 20 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Attachments' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open message' }, { timeout: 4000 }))
    expect(openMessage).toHaveBeenCalledWith('carol', 'c1', row, 'alice')
    expect(store.getState().mail.hashMapMailMessages.c1?.subject).toBe('Plans')
  })
})
