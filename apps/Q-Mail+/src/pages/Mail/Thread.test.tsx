import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
import { readViewedThreads } from './threadUnread'
import { Thread, buildReplyQuoteHtml, newerRows, postPlainText } from './Thread'

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  return store
}

const currentThread = {
  identifier: 'qortal_qmail_thread_group1_t1',
  threadId: 'qortal_qmail_thread_group1_t1',
  created: 1_000,
  threadOwner: 'alice',
  threadData: { title: 'Release plan', groupId: '1', createdAt: 1_000, name: 'alice' },
}
const groupInfo = { id: '1', name: 'Devs' }

const row = (uid: string, created: number, name = 'bob') => ({
  name,
  service: 'MAIL_PRIVATE',
  identifier: `qortal_qmail_thmsg_group1_t1_${uid}`,
  created,
})

/** The thread's posts as the node would return them (newest first) and their decrypted JSON. */
function mockPosts(rows: ReturnType<typeof row>[], bodies: Record<string, string>) {
  mockFetchRoute(/^\/arbitrary\/resources\/search\?.*query=qortal_qmail_thmsg_group1_t1&/, rows)
  mockQortalAction('FETCH_QDN_RESOURCE', (request: Record<string, any>) => `enc:${request.identifier}`)
  mockQortalAction('DECRYPT_DATA', (request: Record<string, any>) => {
    const identifier = String(request.encryptedData).replace(/^enc:/, '')
    const uid = identifier.split('_').pop() as string
    return btoa(JSON.stringify({ textContentV2: `<p>${bodies[uid]}</p>`, createdAt: 1, version: 1, attachments: [], name: 'bob' }))
  })
}

describe('Thread screen', () => {
  beforeEach(() => {
    resetSearchCache()
    resetThreadDataCache()
    resetGroupMembersCache()
    resetAvatarAttempts()
    mockQortalAction('GET_QDN_RESOURCE_URL', () => '')
    mockQortalAction('GET_ACCOUNT_DATA', (request: Record<string, any>) => ({ publicKey: `PK_${request.address}` }))
    mockFetchRoute(/^\/groups\/members\//, { members: [{ member: 'QBob' }] })
    mockFetchRoute(/^\/names\/address\//, [{ name: 'bob' }])
  })

  it('loads a page of 20, decrypts each post once, shows them oldest first and records the visit', async () => {
    mockPosts([row('m2', 3_000), row('m1', 2_000)], { m1: 'First post', m2: 'Second post' })
    const store = makeStore()
    const view = render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Thread currentThread={currentThread} groupInfo={groupInfo} closeThread={() => {}} />
        </HubThemeProvider>
      </Provider>
    )
    expect(screen.getByRole('heading', { name: 'Release plan' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Second post')).toBeTruthy())
    const posts = screen.getAllByRole('article').map((node) => node.textContent)
    expect(posts[0]).toContain('First post')
    expect(posts[1]).toContain('Second post')
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(1)
    expect(fetchedUrls('/arbitrary/resources/search')[0]).toMatch(/limit=20&.*offset=0&query=qortal_qmail_thmsg_group1_t1&/)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Load earlier posts' })).toBeNull()
    expect(readViewedThreads('alice')['qmail_threads_1_qortal_qmail_thread_group1_t1']?.timestamp).toBeGreaterThan(0)

    // Post is enabled once the members' keys are known.
    await waitFor(() => expect((screen.getByRole('button', { name: 'Post a reply' }) as HTMLButtonElement).disabled).toBe(false))
    expect(fetchedUrls('/groups/members/1')[0]).toContain('limit=100&offset=0')

    // Reopening the same thread decrypts nothing again: the posts are in the store.
    view.unmount()
    render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Thread currentThread={currentThread} groupInfo={groupInfo} closeThread={() => {}} />
        </HubThemeProvider>
      </Provider>
    )
    await waitFor(() => expect(screen.getByText('Second post')).toBeTruthy())
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(2)
  })

  it('shows the empty state for a thread without posts', async () => {
    mockPosts([], {})
    render(
      <Provider store={makeStore()}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Thread currentThread={currentThread} groupInfo={groupInfo} closeThread={() => {}} />
        </HubThemeProvider>
      </Provider>
    )
    await waitFor(() => expect(screen.getByText('No posts yet')).toBeTruthy())
  })

  it('shows an error state with Retry when the search fails', async () => {
    mockFetchRoute('/arbitrary/resources/search?', { error: 'down' }, { status: 500 })
    render(
      <Provider store={makeStore()}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Thread currentThread={currentThread} groupInfo={groupInfo} closeThread={() => {}} />
        </HubThemeProvider>
      </Provider>
    )
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})

describe('newerRows (poll)', () => {
  const rows = [row('m5', 5), row('m4', 4), row('m3', 3)]

  it('takes only the rows above the newest known post', () => {
    const known = new Set([rows[1].identifier, rows[2].identifier])
    expect(newerRows(rows, rows[1].identifier, known).map((r) => r.identifier)).toEqual([rows[0].identifier])
  })

  it('takes the whole page when the newest known post is no longer in it (the original dropped the newest row)', () => {
    const fresh = newerRows(rows, 'qortal_qmail_thmsg_group1_t1_old', new Set())
    expect(fresh.map((r) => r.identifier)).toEqual(rows.map((r) => r.identifier))
    expect(newerRows(rows, undefined, new Set())).toHaveLength(3)
    expect(newerRows(rows, rows[0].identifier, new Set([rows[0].identifier]))).toHaveLength(0)
  })
})

describe('reply quote', () => {
  it('extracts plain text from every body format', () => {
    expect(postPlainText({ textContentV2: '<p>Hi<br>there</p><p>&amp; you</p>' })).toBe('Hi\nthere\n& you')
    expect(postPlainText({ textContent: [{ type: 'paragraph', children: [{ text: 'slate text' }] }] })).toBe('slate text')
    expect(postPlainText({ htmlContent: '<div>legacy</div>' })).toBe('legacy')
    expect(postPlainText({})).toBe('')
  })

  it('builds an escaped quote block with the author, time and a short excerpt', () => {
    const html = buildReplyQuoteHtml({ name: 'bob', created: Date.UTC(2026, 0, 2, 3, 4, 5), textContentV2: '<p>a &lt;b&gt;</p><p>line two</p>' })
    expect(html).toMatch(/^<blockquote>On \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}, bob wrote:<\/blockquote>/)
    expect(html).toContain('<blockquote>a &lt;b&gt;</blockquote><blockquote>line two</blockquote><p><br></p>')
    expect(html).not.toContain('<b>')
  })

  it('caps long posts', () => {
    const html = buildReplyQuoteHtml({ name: 'bob', textContentV2: `<p>${'x'.repeat(1000)}</p>` })
    expect(html).toContain('x'.repeat(400) + '…')
    expect(html).not.toContain('x'.repeat(401))
    const many = buildReplyQuoteHtml({ name: 'bob', textContentV2: Array.from({ length: 10 }, (_, i) => `<p>l${i}</p>`).join('') })
    expect(many.match(/<blockquote>/g)).toHaveLength(1 + 6 + 1)
    expect(buildReplyQuoteHtml({ name: 'bob' })).toContain('- no message body -')
  })

  it('shows the publisher from the search row, not a name or date the body claims', async () => {
    mockFetchRoute(/^\/arbitrary\/resources\/search\?.*query=qortal_qmail_thmsg_group1_t1&/, [row('m9', 5_000, 'eve')])
    mockQortalAction('FETCH_QDN_RESOURCE', (request: Record<string, any>) => `enc:${request.identifier}`)
    mockQortalAction('DECRYPT_DATA', () =>
      btoa(JSON.stringify({ textContentV2: '<p>New payment address</p>', createdAt: 1, created: 1, version: 1, attachments: [], name: 'GroupAdmin' }))
    )
    render(
      <Provider store={makeStore()}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Thread currentThread={currentThread} groupInfo={groupInfo} closeThread={() => {}} />
        </HubThemeProvider>
      </Provider>
    )
    await waitFor(() => expect(screen.getByText('New payment address')).toBeTruthy())
    expect(screen.getByRole('article', { name: 'Post by eve' })).toBeTruthy()
    expect(screen.queryByRole('article', { name: 'Post by GroupAdmin' })).toBeNull()
  })
})
