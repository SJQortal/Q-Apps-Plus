import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { archiveIds, setArchivedState } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { fetchedUrls, mockFetchRoute, mockQortalAction } from '../../test/setup'
import { resetSearchCache } from '../../utils/qdnSearch'
import { resetSubjectCache } from '../../utils/subjectCache'
import { getMailIndex, resetMailIndexStore, aliasIndexKey } from './mailIndexStore'
import { AliasMail } from './AliasMail'

const ADDRESS = 'QAliceAddressXYZ123'
const SUFFIX = ADDRESS.slice(-6)

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: ADDRESS, publicKey: 'PK', name: 'alice' }))
  store.dispatch(setArchivedState({ address: ADDRESS, entries: {} }))
  return store
}

function renderAlias(store: ReturnType<typeof makeStore>, ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

const aliasRow = (n: number, from = `sender${n}`) => ({
  identifier: `_mail_qortal_qmail_shop_mail_${n}`,
  name: from,
  created: 10_000 - n,
})

const pageOf = (offset: number, size: number, total: number) =>
  Array.from({ length: Math.max(0, Math.min(size, total - offset)) }, (_, i) => aliasRow(offset + i + 1))

/**
 * Routes for both alias queries (searchResources sorts the params, so `offset`
 * comes right before `query`): the by-address one is empty, the by-alias one
 * pages through `total` rows, 50 per page.
 */
function mockAliasInbox(total: number) {
  mockFetchRoute(new RegExp(`query=qortal_qmail_shop_${SUFFIX}_mail_`), [])
  for (const offset of [0, 50, 100, 150]) {
    mockFetchRoute(new RegExp(`offset=${offset}&query=qortal_qmail_shop_mail_`), pageOf(offset, 50, total))
  }
}

const searchUrls = () => fetchedUrls('/arbitrary/resources/search?')

describe('AliasMail', () => {
  beforeEach(() => {
    resetSearchCache()
    resetSubjectCache()
    resetMailIndexStore()
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
  })

  it('loads one page per query, pages by offset on Load older, and hands the rows back', async () => {
    const store = makeStore()
    mockAliasInbox(70)
    const onMessagesLoaded = vi.fn()
    renderAlias(store, <AliasMail value="shop" onOpen={async () => {}} onMessagesLoaded={onMessagesLoaded} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
    await screen.findByText('sender1')
    // One search per query for the first page (both with offset=0, limit=50).
    expect(searchUrls()).toHaveLength(2)
    expect(searchUrls().every((url) => url.includes('offset=0') && url.includes('limit=50'))).toBe(true)
    expect(onMessagesLoaded).toHaveBeenLastCalledWith('shop', expect.any(Array))
    expect(onMessagesLoaded.mock.calls.at(-1)?.[1]).toHaveLength(50)
    expect(getMailIndex(aliasIndexKey('shop'))).toHaveLength(50)

    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }))
    await screen.findByText('sender70')
    // Two more searches, both at offset 50 — never a refetch of page one.
    expect(searchUrls()).toHaveLength(4)
    expect(searchUrls().slice(2).every((url) => url.includes('offset=50'))).toBe(true)
    expect(onMessagesLoaded.mock.calls.at(-1)?.[1]).toHaveLength(70)
    // The last page was short: no more to load.
    expect(screen.queryByRole('button', { name: 'Load older messages' })).toBeNull()
  })

  it('shows an empty state naming the alias', async () => {
    const store = makeStore()
    mockAliasInbox(0)
    renderAlias(store, <AliasMail value="shop" onOpen={async () => {}} />)
    await screen.findByText('No mail for this alias yet')
    expect(screen.getByText(/Mail addressed to shop shows up here/)).toBeTruthy()
  })

  it('shows an error state whose Retry fetches again', async () => {
    const store = makeStore()
    mockFetchRoute(/query=qortal_qmail_shop/, 'nope', { status: 500 })
    renderAlias(store, <AliasMail value="shop" onOpen={async () => {}} />)
    await screen.findByRole('alert')
    const before = searchUrls().length
    expect(before).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    })
    await waitFor(() => expect(searchUrls().length).toBeGreaterThan(before))
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('hides archived alias mail from the list, keeps it in the rows handed back, and opens rows', async () => {
    const store = makeStore()
    mockAliasInbox(2)
    const onOpen = vi.fn(async () => {})
    const onMessagesLoaded = vi.fn()
    renderAlias(store, <AliasMail value="shop" onOpen={onOpen} onMessagesLoaded={onMessagesLoaded} />)
    await screen.findByText('sender2')
    fireEvent.click(screen.getByRole('button', { name: /sender2/ }))
    expect(onOpen).toHaveBeenCalledWith('sender2', '_mail_qortal_qmail_shop_mail_2', {})

    act(() => {
      store.dispatch(archiveIds({ ids: ['_mail_qortal_qmail_shop_mail_2'] }))
    })
    await waitFor(() => expect(screen.queryByText('sender2')).toBeNull())
    expect(screen.getByText('sender1')).toBeTruthy()
    expect(onMessagesLoaded.mock.calls.at(-1)?.[1]).toHaveLength(2)
  })
})
