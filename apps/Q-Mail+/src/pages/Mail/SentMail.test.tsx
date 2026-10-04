import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { addToHashMapMail } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { fetchMock, fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from '../../test/setup'
import { resetSearchCache } from '../../utils/qdnSearch'
import { resetSubjectCache } from '../../utils/subjectCache'
import { resetNameCache } from '../../utils/nameCache'
import { resetSentRecipientCache } from '../../utils/sentRecipientCache'
import { getMailIndex, resetMailIndexStore, sentIndexKey } from './mailIndexStore'
import { SentMail } from './SentMail'

const SEARCH = '/arbitrary/resources/search?'

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  return store
}

function renderSent(store: ReturnType<typeof makeStore>, ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

const sentTo = (name: string, suffix: string, n: number) => ({
  identifier: `_mail_qortal_qmail_${name}_${suffix}_mail_${n}`,
  name: 'alice',
  created: 1_000 + n,
})

describe('SentMail', () => {
  beforeEach(() => {
    resetSearchCache()
    resetSubjectCache()
    resetNameCache()
    resetSentRecipientCache()
    resetMailIndexStore()
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
    mockQortalAction('DECRYPT_DATA', () => {
      throw new Error('no saved subjects')
    })
  })

  it('loads the index once, resolves one name per recipient group (not per row), and shares the index', async () => {
    const store = makeStore()
    mockFetchRoute(/query=_mail_qortal_qmail_/, [sentTo('bob', 'bbb111', 3), sentTo('bob', 'bbb111', 2), sentTo('carol', 'ccc222', 1)])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    mockQortalAction('GET_NAME_DATA', (request: any) => {
      if (request.name === 'bob') return { name: 'bobby', owner: 'QBobbbb111' }
      if (request.name === 'carol') return { name: 'carol', owner: 'QCarolccc222' }
      return {}
    })
    mockQortalAction('SEARCH_NAMES', [])

    renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
    await screen.findByText('To: bobby')
    await screen.findByText('To: carol')
    expect(fetchedUrls(SEARCH)).toHaveLength(2)
    // Two recipient groups → two lookups, never one per row, never SEARCH_NAMES for short names.
    await waitFor(() => expect(qortalCalls('GET_NAME_DATA')).toHaveLength(2))
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(0)
    expect(getMailIndex(sentIndexKey(['alice']))).toHaveLength(3)
    // Bob's group collapses two messages.
    expect(screen.getByRole('button', { name: /To: bobby.*2 messages/ })).toBeTruthy()
  })

  it('shows the decrypted recipient when the message was opened, with no lookup', async () => {
    const store = makeStore()
    mockFetchRoute(/query=_mail_qortal_qmail_/, [sentTo('dav', 'ddd333', 1)])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    mockQortalAction('GET_NAME_DATA', {})
    mockQortalAction('SEARCH_NAMES', [])
    store.dispatch(
      addToHashMapMail({
        id: sentTo('dav', 'ddd333', 1).identifier,
        isValid: true,
        recipient: 'david-the-long-name-here',
        subject: 'Hi',
      })
    )
    renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} />)
    await screen.findByText('To: david-the-long-name-here')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(0)
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(0)
  })

  it('asks before deleting, as a sheet, and publishes nothing on Keep', async () => {
    const store = makeStore()
    mockFetchRoute(/query=_mail_qortal_qmail_/, [sentTo('bob', 'bbb111', 1)])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    mockQortalAction('GET_NAME_DATA', { name: 'bob', owner: 'QBobbbb111' })
    mockQortalAction('SEARCH_NAMES', [])
    const publish = vi.fn()
    mockQortalAction('PUBLISH_MULTIPLE_QDN_RESOURCES', publish)
    renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} />)
    await screen.findByText('To: bob')
    fireEvent.click(screen.getByRole('button', { name: 'Delete sent message' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Delete this sent message?')
    expect(dialog.textContent).toContain('fee')
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(publish).not.toHaveBeenCalled()
    expect(screen.getByText('To: bob')).toBeTruthy()
  })

  it('shows the empty state with Compose', async () => {
    const store = makeStore()
    mockFetchRoute(/query=/, [])
    const onCompose = vi.fn()
    renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} onCompose={onCompose} />)
    await screen.findByText('No sent mail yet')
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }))
    expect(onCompose).toHaveBeenCalledTimes(1)
  })

  it('keeps the mailbox the user switched to when the earlier, slower load finishes last', async () => {
    const store = makeStore()
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}` }))
    mockQortalAction('SEARCH_NAMES', [])
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input: any) => {
      const url = String(input)
      const isLegacy = !url.includes('query=_mail_')
      if (url.includes('name=alice&')) {
        await gate
        const rows = isLegacy ? [] : [{ identifier: '_mail_qortal_qmail_bob_bbb111_mail_1', name: 'alice', created: 1_001 }]
        return new Response(JSON.stringify(rows), { status: 200 })
      }
      const rows = isLegacy ? [] : [{ identifier: '_mail_qortal_qmail_dave_ddd444_mail_2', name: 'carl', created: 1_002 }]
      return new Response(JSON.stringify(rows), { status: 200 })
    })
    try {
      const view = renderSent(store, <SentMail instanceNames={['alice', 'carl']} onOpen={async () => {}} />)
      view.rerender(
        <Provider store={store}>
          <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
            <SentMail instanceNames={['carl']} onOpen={async () => {}} />
          </HubThemeProvider>
        </Provider>
      )
      await screen.findByText('To: dave')
      release()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(screen.queryByText('To: bob')).toBeNull()
      expect(screen.getByText('To: dave')).toBeTruthy()
      expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
    } finally {
      fetchMock.mockImplementation(original)
    }
  })

  it('shows the stored index at once on a return to Sent and fetches only what is new', async () => {
    const store = makeStore()
    mockFetchRoute(/limit=20&.*query=_mail_qortal_qmail_/, [sentTo('erin', 'eee555', 9), sentTo('bob', 'bbb111', 3)])
    mockFetchRoute(/query=_mail_qortal_qmail_/, [sentTo('bob', 'bbb111', 3)])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}` }))
    mockQortalAction('SEARCH_NAMES', [])
    const first = renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} />)
    await screen.findByText('To: bob')
    const walk = fetchedUrls(SEARCH).length
    expect(walk).toBe(2)
    first.unmount()

    renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} />)
    // No loading state and no empty flash: the stored rows show straight away.
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
    expect(screen.getByText('To: bob')).toBeTruthy()
    await screen.findByText('To: erin')
    const delta = fetchedUrls(SEARCH).slice(walk)
    expect(delta).toHaveLength(2)
    expect(delta.every((url) => url.includes('limit=20'))).toBe(true)
  })

  it('keeps a single name\'s Sent view out of the all-names index', async () => {
    const store = makeStore()
    mockFetchRoute(/query=_mail_qortal_qmail_/, [sentTo('bob', 'bbb111', 3)])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}` }))
    mockQortalAction('SEARCH_NAMES', [])
    renderSent(store, <SentMail instanceNames={['alice']} onOpen={async () => {}} />)
    await screen.findByText('To: bob')
    expect(getMailIndex(sentIndexKey(['alice']))).toHaveLength(1)
    expect(getMailIndex(sentIndexKey(['alice', 'alice2']))).toBeUndefined()
  })
})
