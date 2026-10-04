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
import { resetSearchCache, searchStats } from '../../utils/qdnSearch'
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

  it('opening a group with N threads reuses the overview searches and adds none per thread', async () => {
    mockGroup('1', 8, [post('1', 't2', 'm1', 5_000), post('1', 't0', 'm2', 4_000)])
    mockGroup('2', 2)
    const onOpenThread = vi.fn()
    const onSelectGroup = vi.fn()
    const view = renderThreads(
      <ThreadsMailbox groups={groups} onOpenThread={onOpenThread} onSelectGroup={onSelectGroup} selectedGroup={null} />
    )
    await waitFor(() => expect(screen.getByText('Thread 7 of 1')).toBeTruthy())
    const before = fetchedUrls('/arbitrary/resources/search').length
    expect(before).toBe(4)

    fireEvent.click(screen.getByText('Devs'))
    expect(onSelectGroup).toHaveBeenCalledWith({ id: '1', name: 'Devs' })

    // The parent filters to that group: "Recently active" for 8 threads.
    view.rerender(
      <Provider store={makeStore()}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ThreadsMailbox groups={groups} onOpenThread={onOpenThread} onSelectGroup={onSelectGroup} selectedGroup={groups[0]} />
        </HubThemeProvider>
      </Provider>
    )
    await waitFor(() => expect(screen.getByText('Recently active')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Thread 2 of 1')).toBeTruthy())
    // Both searches were cached by the overview; the group view issued none and fetched no headers one by one.
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(before)
    expect(searchStats().cacheHits).toBeGreaterThanOrEqual(2)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
    // Members come from the paged endpoint, never limit=0.
    await waitFor(() => expect(fetchedUrls('/groups/members/1')).toHaveLength(1))
    expect(fetchedUrls('/groups/members/1')[0]).toContain('limit=100&offset=0')

    // Newest activity first: t2 (5000) then t0 (4000) then the quiet threads.
    const titles = screen.getAllByText(/Thread \d of 1/).map((node) => node.textContent)
    expect(titles.slice(0, 2)).toEqual(['Thread 2 of 1', 'Thread 0 of 1'])
    expect(titles).toHaveLength(8)

    fireEvent.click(screen.getByText('Thread 2 of 1'))
    expect(onOpenThread).toHaveBeenCalledTimes(1)
    expect(onOpenThread.mock.calls[0][0].threadId).toBe('qortal_qmail_thread_group1_t2')
    expect(onOpenThread.mock.calls[0][0].lastActivity).toBe(5_000)
  })

  it('does not search again every minute for the header of a recently active older thread', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const oldId = 'qortal_qmail_thread_group1_old'
      mockFetchRoute(new RegExp(`identifier=${oldId}`), [header('1', 'old', 'An older thread', 500)])
      mockGroup('1', 20, [post('1', 'old', 'm1', 9_000)])
      renderThreads(<ThreadsMailbox groups={[groups[0]]} onOpenThread={() => {}} selectedGroup={groups[0]} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('An older thread')).toBeTruthy()
      expect(fetchedUrls('/arbitrary/resources/search').filter((url) => url.includes(`identifier=${oldId}`))).toHaveLength(1)
      // Two poll ticks later the header was not searched again.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000)
      })
      expect(fetchedUrls('/arbitrary/resources/search').filter((url) => url.includes('query=qortal_qmail_thmsg_group1&')).length).toBeGreaterThan(1)
      expect(fetchedUrls('/arbitrary/resources/search').filter((url) => url.includes(`identifier=${oldId}`))).toHaveLength(1)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
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
