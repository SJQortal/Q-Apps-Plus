/**
 * The row and group menus (right click here; long press uses the same
 * trigger, tested in useContextMenuTrigger.test.tsx).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { setReadState } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { mockQortalAction } from '../../test/setup'
import { resetSubjectCache } from '../../utils/subjectCache'
import { GroupedMailboxList } from './GroupedMailboxList'
import { HIDDEN_CHARACTERS_SR } from '../../components/common/NameText'

function renderList(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  store.dispatch(setReadState({ address: 'QAlice', entries: { b1: 10, b2: 0, c1: 0 } }))
  render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

const bob1 = { id: 'b1', user: 'bob', createdAt: 3_000 }
const bob2 = { id: 'b2', user: 'bob', createdAt: 2_000 }
const carol = { id: 'c1', user: 'carol', createdAt: 1_000 }
const opened = { id: 'c1', user: 'carol', isValid: true, subject: 'Lunch', createdAt: 1_000 }

const menuItems = async () => (await screen.findAllByRole('menuitem')).map((item) => item.textContent)

describe('GroupedMailboxList menus', () => {
  beforeEach(() => {
    resetSubjectCache()
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
  })

  it('a right click on a row offers what the list can do with that message', async () => {
    const onArchive = vi.fn()
    renderList(
      <GroupedMailboxList
        messages={[bob1, bob2, carol]}
        mailboxType="inbox"
        showSelectAll
        openMessage={() => {}}
        onReply={() => {}}
        onForward={() => {}}
        onMarkAsRead={() => {}}
        onMarkAsUnread={() => {}}
        onArchive={onArchive}
      />
    )
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Unread\. carol/ }), { clientX: 40, clientY: 40 })
    expect(await menuItems()).toEqual(['Open', 'Reply', 'Reply all', 'Forward', 'Mark as read', 'Archive', 'Select'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(onArchive).toHaveBeenCalledWith([carol])
  })

  it('Reply opens a message that is not decrypted yet, then replies to it', async () => {
    const openMessage = vi.fn(async () => opened)
    const onReply = vi.fn()
    renderList(<GroupedMailboxList messages={[carol]} mailboxType="inbox" openMessage={openMessage} onReply={onReply} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: /carol/ }), { clientX: 40, clientY: 40 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reply all' }))
    await waitFor(() => expect(onReply).toHaveBeenCalledWith(opened, { replyAll: true }))
    expect(openMessage).toHaveBeenCalledWith('carol', 'c1', carol, 'alice')
  })

  it('nothing is replied to when the message could not be opened', async () => {
    const onForward = vi.fn()
    renderList(<GroupedMailboxList messages={[carol]} mailboxType="inbox" openMessage={async () => null} onForward={onForward} />)
    fireEvent.contextMenu(screen.getByRole('button', { name: /carol/ }), { clientX: 40, clientY: 40 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Forward' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onForward).not.toHaveBeenCalled()
  })

  it('a right click on a sender group acts on all its messages', async () => {
    const onMarkAsRead = vi.fn()
    renderList(
      <GroupedMailboxList messages={[bob1, bob2, carol]} mailboxType="inbox" showSelectAll openMessage={() => {}} onMarkAsRead={onMarkAsRead} onMarkAsUnread={() => {}} onArchive={() => {}} />
    )
    const header = document.querySelector('[data-group="sender:bob"] button[aria-expanded]') as HTMLElement
    fireEvent.contextMenu(header, { clientX: 40, clientY: 40 })
    expect(await menuItems()).toEqual(['Show the 2 messages', 'Mark all as read', 'Mark all as unread', 'Archive all', 'Select all 2'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark all as read' }))
    expect(onMarkAsRead).toHaveBeenCalledWith([bob1, bob2])
    fireEvent.contextMenu(header, { clientX: 40, clientY: 40 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Select all 2' }))
    expect(screen.getByText('2 selected')).toBeTruthy()
  })

  it('on a phone it is a sheet titled with the name, an impostor still marked', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as any
    try {
      // U+2800 BRAILLE PATTERN BLANK in place of the space.
      const impostor = { id: 'i1', user: 'Simon\u2800James', createdAt: 500 }
      renderList(<GroupedMailboxList messages={[impostor]} mailboxType="inbox" openMessage={() => {}} onArchive={() => {}} />)
      fireEvent.contextMenu(document.querySelector('[data-message-row="i1"] button') as HTMLElement, { clientX: 40, clientY: 40 })
      const sheet = await screen.findByRole('dialog', { name: 'Message actions' })
      expect(sheet.querySelector('h2')?.textContent).toContain(HIDDEN_CHARACTERS_SR)
      expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
    } finally {
      window.matchMedia = original
    }
  })

  it('sent rows: forward and delete, no reply', async () => {
    renderList(
      <GroupedMailboxList messages={[carol]} mailboxType="sent" openMessage={() => {}} onReply={() => {}} onForward={() => {}} onDeleteMessage={() => {}} />
    )
    fireEvent.contextMenu(document.querySelector('[data-message-row="c1"] button') as HTMLElement, { clientX: 40, clientY: 40 })
    expect(await menuItems()).toEqual(['Open', 'Forward', 'Delete sent message'])
  })
})
