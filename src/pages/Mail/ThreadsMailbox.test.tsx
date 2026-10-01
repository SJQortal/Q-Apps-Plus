import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from '../../test/setup'
import { resetSearchCache } from '../../utils/qdnSearch'
import { resetGroupMembersCache } from '../../utils/groupMembersCache'
import { resetThreadDataCache } from './threadData'
import { resetAvatarAttempts } from './ThreadAvatar'
import { saveThreadViewed } from './threadUnread'
import { ThreadsMailbox } from './ThreadsMailbox'

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  return store
}

function renderThreads(ui: React.ReactElement) {
  return render(
    <Provider store={makeStore()}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

const header = (groupId: string, token: string, title: string, created: number) => ({
  name: 'alice',
  service: 'MAIL',
  identifier: `qortal_qmail_thread_group${groupId}_${token}`,
  created,
  metadata: { description: title },
})
const post = (groupId: string, token: string, uid: string, created: number, name = 'bob') => ({
  name,
  service: 'MAIL_PRIVATE',
  identifier: `qortal_qmail_thmsg_group${groupId}_${token}_${uid}`,
  created,
})

/** Serve thread headers and activity for a group with `threadCount` threads (descriptions present). */
function mockGroup(groupId: string, threadCount: number, posts: ReturnType<typeof post>[] = []) {
  const headers = Array.from({ length: threadCount }, (_, i) => header(groupId, `t${i}`, `Thread ${i} of ${groupId}`, 1_000 + i))
  // searchResources() sorts the keys, so match on the query only.
  mockFetchRoute(new RegExp(`^/arbitrary/resources/search\\?.*query=qortal_qmail_thread_group${groupId}&`), headers)
  mockFetchRoute(new RegExp(`^/arbitrary/resources/search\\?.*query=qortal_qmail_thmsg_group${groupId}&`), posts)
}

const groups = [
  { id: '1', name: 'Devs' },
  { id: '2', name: 'Design' },
]

describe('ThreadsMailbox', () => {
  beforeEach(() => {
    resetSearchCache()
    resetThreadDataCache()
    resetGroupMembersCache()
    resetAvatarAttempts()
    mockQortalAction('GET_QDN_RESOURCE_URL', () => '')
    mockQortalAction('FETCH_QDN_RESOURCE', () => ({}))
    mockQortalAction('GET_ACCOUNT_DATA', (request: Record<string, any>) => ({ publicKey: `PK_${request.address}` }))
    mockFetchRoute(/^\/groups\/members\//, { members: [{ member: 'QBob' }, { member: 'QCarol' }] })
    mockFetchRoute(/^\/names\/address\//, [{ name: 'bob' }])
  })

  it('opens the overview with two searches per group (headers + activity) and no header fetches', async () => {
    mockGroup('1', 5)
    mockGroup('2', 3)
    renderThreads(<ThreadsMailbox groups={groups} onOpenThread={() => {}} />)
    expect(screen.getByLabelText('Loading')).toBeTruthy()

    await waitFor(() => expect(screen.getByText('Thread 4 of 1')).toBeTruthy())
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(4)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
    expect(screen.getAllByText(/Thread \d of \d/)).toHaveLength(8)
    expect(screen.getByText('5 threads · 5 unread')).toBeTruthy()
    expect(screen.getByText('3 threads · 3 unread')).toBeTruthy()
  })

  it('shows unread from the viewed store and clears it once a thread was opened', async () => {
    mockGroup('1', 2, [post('1', 't1', 'm1', 9_000)])
    saveThreadViewed('alice', '1', 'qortal_qmail_thread_group1_t0', 8_000) // opened after its creation (1000)
    saveThreadViewed('alice', '1', 'qortal_qmail_thread_group1_t1', 8_000) // but a post arrived at 9000
    renderThreads(<ThreadsMailbox groups={[groups[0]]} onOpenThread={() => {}} />)
    await waitFor(() => expect(screen.getByText('2 threads · 1 unread')).toBeTruthy())
    expect(screen.getAllByLabelText('Unread')).toHaveLength(1)

    act(() => {
      saveThreadViewed('alice', '1', 'qortal_qmail_thread_group1_t1', 10_000)
    })
    await waitFor(() => expect(screen.getByText('2 threads')).toBeTruthy())
    expect(screen.queryAllByLabelText('Unread')).toHaveLength(0)
  })

  it('shows the empty state with a New thread action when no group has threads', async () => {
    const onRequestComposeThread = vi.fn()
    renderThreads(
      <ThreadsMailbox groups={[]} joinedGroups={[{ id: '9', name: 'Quiet' }]} onOpenThread={() => {}} onRequestComposeThread={onRequestComposeThread} />
    )
    expect(screen.getByText('No threads yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /New thread/ }))
    expect(onRequestComposeThread).toHaveBeenCalledWith({ id: '9', name: 'Quiet' })
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(0)
  })

  it('shows an error state with Retry when the searches fail', async () => {
    mockFetchRoute('/arbitrary/resources/search?', { error: 'down' }, { status: 503 })
    renderThreads(<ThreadsMailbox groups={[groups[0]]} onOpenThread={() => {}} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('Could not load threads')).toBeTruthy()
    const calls = fetchedUrls('/arbitrary/resources/search').length
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetchedUrls('/arbitrary/resources/search').length).toBeGreaterThan(calls))
  })
})
