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
import { mockQortalAction } from '../../test/setup'
import { GroupedMailboxList } from './GroupedMailboxList'

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
