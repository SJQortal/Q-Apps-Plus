import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { markRead, markUnread, setReadState, upsertMessages } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { GroupedMailboxList } from './GroupedMailboxList'
import { LOCKED_SUBJECT_LABEL } from './MailMessageRow'
import { resetSubjectCache } from '../../utils/subjectCache'
import { addToHashMapSubject } from '../../state/features/mailSlice'

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  return store
}

function renderList(store: ReturnType<typeof makeStore>, ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

const realReply = { reference: { identifier: 'orig', name: 'bob', service: 'MAIL_PRIVATE' }, data: { createdAt: 1, subject: 'first' } }
const reply = { id: 'r1', user: 'bob', createdAt: 2_000, generalData: { threadV2: [realReply] } }
const fresh = { id: 'f1', user: 'carol', createdAt: 1_000 }

/** The unread dot sits next to the group label (one group per sender here). */
const isUnread = (sender: string) => {
  const label = screen.getByText(sender)
  const header = label.closest('[data-group]') as HTMLElement
  return within(header).queryAllByLabelText('Unread').length > 0
}

describe('GroupedMailboxList read state', () => {
  beforeEach(() => {
    resetSubjectCache()
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
  })

  it('takes read/unread from the read store, not from generalData.threadV2', () => {
    const store = makeStore()
    // r1 was explicitly marked unread; f1 was read.
    store.dispatch(setReadState({ address: 'QAlice', entries: { r1: 0, f1: 10 } }))
    renderList(store, <GroupedMailboxList messages={[reply, fresh]} mailboxType="inbox" openMessage={() => {}} />)
    expect(isUnread('bob')).toBe(true)
    expect(isUnread('carol')).toBe(false)
  })

  it('a reply with a real thread but no store entry stays compatible with the original (read)', () => {
    const store = makeStore()
    renderList(store, <GroupedMailboxList messages={[reply, fresh]} mailboxType="inbox" openMessage={() => {}} />)
    expect(isUnread('bob')).toBe(false)
    expect(isUnread('carol')).toBe(true)
  })

  it('Mark as Unread keeps the real reply chain and flips the row through the store', () => {
    const store = makeStore()
    store.dispatch(setReadState({ address: 'QAlice', entries: {} }))
    store.dispatch(upsertMessages([reply]))
    const onMarkAsUnread = vi.fn((messages: any[]) => {
      store.dispatch(markUnread({ ids: messages.map((m) => m.id) }))
    })
    const onMarkAsRead = vi.fn((messages: any[]) => {
      store.dispatch(markRead({ ids: messages.map((m) => m.id) }))
    })
    renderList(
      store,
      <GroupedMailboxList
        messages={store.getState().mail.mailMessages}
        mailboxType="inbox"
        openMessage={() => {}}
        onMarkAsRead={onMarkAsRead}
        onMarkAsUnread={onMarkAsUnread}
      />
    )
    // Read (compat rule) before the click.
    expect(isUnread('bob')).toBe(false)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /mark as unread/i }))
    expect(onMarkAsUnread).toHaveBeenCalledTimes(1)
    expect(store.getState().mail.readState.r1).toBe(0)
    // The list copy still carries its genuine history.
    expect(store.getState().mail.mailMessages[0].generalData.threadV2).toEqual([realReply])
    expect(isUnread('bob')).toBe(true)
  })
})

describe('GroupedMailboxList states and rows', () => {
  beforeEach(() => {
    resetSubjectCache()
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
  })

  it('shows a skeleton while loading, an error with Retry, and an empty state with a next action', () => {
    const store = makeStore()
    const onRetry = vi.fn()
    const { rerender } = renderList(
      store,
      <GroupedMailboxList messages={[]} mailboxType="inbox" openMessage={() => {}} status="loading" />
    )
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()

    rerender(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <GroupedMailboxList messages={[]} mailboxType="inbox" openMessage={() => {}} status="error" errorMessage="node down" onRetry={onRetry} />
        </HubThemeProvider>
      </Provider>
    )
    expect(screen.getByRole('alert').textContent).toContain('node down')
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    rerender(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <GroupedMailboxList
            messages={[]}
            mailboxType="inbox"
            openMessage={() => {}}
            status="ready"
            emptyTitle="No mail yet"
            emptyAction={<button>Compose</button>}
          />
        </HubThemeProvider>
      </Provider>
    )
    expect(screen.getByText('No mail yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Compose' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tapping a row opens it, ticking its checkbox only selects it (UX #5), inside an expanded group too', () => {
    const store = makeStore()
    const openMessage = vi.fn()
    const two = [
      { id: 'a1', user: 'bob', createdAt: 3_000 },
      { id: 'a2', user: 'bob', createdAt: 2_000 },
      fresh,
    ]
    renderList(
      store,
      <GroupedMailboxList messages={two} mailboxType="inbox" openMessage={openMessage} showSelectAll onMarkAsRead={() => {}} />
    )
    // Single-message group renders the row itself.
    fireEvent.click(screen.getByRole('button', { name: /carol/ }))
    expect(openMessage).toHaveBeenCalledTimes(1)
    expect(openMessage.mock.calls[0][1]).toBe('f1')

    // The group header expands instead of opening.
    const header = screen.getByRole('button', { name: /bob, 2 messages/ })
    fireEvent.click(header)
    expect(openMessage).toHaveBeenCalledTimes(1)
    expect(header.getAttribute('aria-expanded')).toBe('true')
    const group = screen.getByRole('group', { name: 'Messages from bob' })
    const rows = within(group).getAllByRole('button')
    expect(rows).toHaveLength(2)

    // Checkbox of a compact row: selects, never opens.
    const boxes = within(group).getAllByRole('checkbox')
    fireEvent.click(boxes[0])
    expect(openMessage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('toolbar', { name: 'Selected messages' }).textContent).toContain('1 selected')
    expect((boxes[0] as HTMLInputElement).checked).toBe(true)

    // The row body opens the message.
    fireEvent.click(rows[1])
    expect(openMessage).toHaveBeenCalledTimes(2)
    expect(openMessage.mock.calls[1][1]).toBe('a2')
  })

  it('never shows the ciphertext as a subject and says the row is locked instead (Bugs #18, UX #27)', async () => {
    const store = makeStore()
    mockQortalAction('DECRYPT_DATA', () => {
      throw new Error('not for you')
    })
    store.dispatch(addToHashMapSubject({ id: 'f1', subject: 'Q2lwaGVydGV4dA==', attachments: false }))
    renderList(store, <GroupedMailboxList messages={[fresh]} mailboxType="inbox" openMessage={() => {}} />)
    expect(screen.getByText(LOCKED_SUBJECT_LABEL)).toBeTruthy()
    await screen.findByText('(no subject)')
    expect(screen.queryByText('Q2lwaGVydGV4dA==')).toBeNull()
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(1)
    // The exact stamp is on the date's title, the row shows a short one.
    const time = screen.getByTitle(/^1970-/)
    expect(time.textContent).not.toMatch(/^\d{4}-/)
  })
})
