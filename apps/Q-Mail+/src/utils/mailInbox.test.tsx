import { beforeEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from '../test/setup'
import blogReducer from '../state/features/blogSlice'
import globalReducer from '../state/features/globalSlice'
import mailReducer, { upsertMessages } from '../state/features/mailSlice'
import { useFetchMail } from '../hooks/useFetchMail'
import { resetSearchCache, searchResources } from './qdnSearch'
import {
  fetchRecentInboxMessagesForOwnedName,
  fetchRecentInboxMessagesForSavedAlias,
  getOwnedNameInboxQueries,
  hasInboxMailActivityForOwnedName,
  hasSentMailActivityForOwnedName,
  mergeNewRows,
} from './mailInbox'

const ADDRESS = 'QAliceAddressXYZ123'
const SUFFIX = ADDRESS.slice(-6)
const SEARCH = '/arbitrary/resources/search?'

const inboxRow = (id: string, from = 'bob', created = 1000) => ({
  identifier: `_mail_qortal_qmail_alice_${SUFFIX}_mail_${id}`,
  name: from,
  created,
})

function makeStore() {
  return configureStore({
    reducer: { blog: blogReducer, global: globalReducer, mail: mailReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
}

let api: ReturnType<typeof useFetchMail> | null = null
function Harness() {
  api = useFetchMail()
  return null
}

describe('first load for one name', () => {
  beforeEach(() => {
    resetSearchCache()
    api = null
    mockQortalAction('GET_QDN_RESOURCE_URL', 'http://avatar')
  })

  it('costs 4 searches with mail on the name (I1, I4, I5, I12) and 0 when it repeats within the TTL', async () => {
    // Order matters: the first matching route answers.
    mockFetchRoute(/service=DOCUMENT_PRIVATE/, [{ identifier: 'qmail_state_v1', name: 'alice' }])
    mockFetchRoute(/name=alice.*query=_mail_qortal_qmail_/, [
      { identifier: `_mail_qortal_qmail_carol_${SUFFIX}_mail_s1`, name: 'alice' },
    ])
    mockFetchRoute(new RegExp(`query=qortal_qmail_alice_${SUFFIX}_mail_`), [
      inboxRow('m1', 'bob', 3000),
      inboxRow('m2', 'bob', 2000),
      inboxRow('m3', 'dave', 1000),
    ])
    mockFetchRoute(SEARCH, [])

    const store = makeStore()
    render(
      <Provider store={store}>
        <Harness />
      </Provider>
    )

    // What Mail.tsx does for one name, 0 aliases, 0 groups: the index fetch, the
    // two sidebar probes (started together) and the state-document existence check.
    await act(async () => {
      await Promise.all([
        api!.getAllMailMessages('alice', ADDRESS),
        Promise.all([hasInboxMailActivityForOwnedName('alice', ADDRESS), hasSentMailActivityForOwnedName('alice')]),
        searchResources({
          mode: 'ALL',
          service: 'DOCUMENT_PRIVATE',
          identifier: 'qmail_state_v1',
          name: 'alice',
          exactmatchnames: 'true',
          limit: '1',
          includemetadata: 'false',
          reverse: 'true',
          excludeblocked: 'true',
        }),
      ])
    })

    expect(fetchedUrls(SEARCH)).toHaveLength(4)
    expect(store.getState().mail.mailMessages.map((m: any) => m.id)).toEqual([
      `_mail_qortal_qmail_alice_${SUFFIX}_mail_m1`,
      `_mail_qortal_qmail_alice_${SUFFIX}_mail_m2`,
      `_mail_qortal_qmail_alice_${SUFFIX}_mail_m3`,
    ])
    // Avatars: one lookup per distinct sender, not per message.
    expect(qortalCalls('GET_QDN_RESOURCE_URL').map((c) => c.name).sort()).toEqual(['bob', 'dave'])

    // Switching away and back within the TTL (Bugs #9): served from the cache.
    await act(async () => {
      await api!.getAllMailMessages('alice', ADDRESS)
      await hasInboxMailActivityForOwnedName('alice', ADDRESS)
    })
    expect(fetchedUrls(SEARCH)).toHaveLength(4)
  })

  it('costs 6 searches when the name has no mail (both inbox and both sent probes miss)', async () => {
    mockFetchRoute(SEARCH, [])
    const store = makeStore()
    render(
      <Provider store={store}>
        <Harness />
      </Provider>
    )
    await act(async () => {
      await Promise.all([
        api!.getAllMailMessages('alice', ADDRESS),
        hasInboxMailActivityForOwnedName('alice', ADDRESS),
        hasSentMailActivityForOwnedName('alice'),
        searchResources({ service: 'DOCUMENT_PRIVATE', identifier: 'qmail_state_v1', name: 'alice', limit: '1' }),
      ])
    })
    expect(fetchedUrls(SEARCH)).toHaveLength(6)
  })
})

describe('new-mail poll', () => {
  beforeEach(() => {
    resetSearchCache()
    api = null
  })

  it('checkNewMessages adds every unknown row, even when the newest known is not in the page (Bugs #20)', async () => {
    const store = makeStore()
    store.dispatch(upsertMessages([{ id: `_mail_qortal_qmail_alice_${SUFFIX}_mail_m2`, user: 'bob', createdAt: 2000 }]))
    render(
      <Provider store={store}>
        <Harness />
      </Provider>
    )
    mockFetchRoute(SEARCH, [inboxRow('m4', 'bob', 4000), inboxRow('m3', 'bob', 3000), inboxRow('m1', 'bob', 1000)])
    let added = 0
    await act(async () => {
      added = await api!.checkNewMessages('alice', ADDRESS)
    })
    expect(added).toBe(3)
    expect(store.getState().mail.mailMessages.map((m: any) => m.id.slice(-2)).sort()).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(fetchedUrls(SEARCH)).toHaveLength(1)

    // The poll never uses the cache: a second tick fetches again and finds nothing new.
    await act(async () => {
      added = await api!.checkNewMessages('alice', ADDRESS)
    })
    expect(added).toBe(0)
    expect(fetchedUrls(SEARCH)).toHaveLength(2)
  })

  it('fetchRecentInboxMessagesForOwnedName runs both owned-name queries and keeps only matching identifiers', async () => {
    const queries = getOwnedNameInboxQueries('alice', ADDRESS)
    expect(queries.map((q) => q.query)).toEqual([`qortal_qmail_alice_${SUFFIX}_mail_`, 'qortal_qmail_alice_mail_'])
    mockFetchRoute(new RegExp(`query=qortal_qmail_alice_${SUFFIX}_mail_`), [
      inboxRow('a', 'bob', 5),
      { identifier: `qortal_qmail_alice_${SUFFIX}_mail_legacy`, name: 'bob', created: 4 },
    ])
    mockFetchRoute(/query=qortal_qmail_alice_mail_/, [
      { identifier: '_mail_qortal_qmail_alice_mail_b', name: 'eve', created: 3 },
      { identifier: '_mail_qortal_qmail_alicex_mail_c', name: 'eve', created: 2 },
    ])
    const rows = await fetchRecentInboxMessagesForOwnedName('alice', ADDRESS)
    expect(rows.map((r) => r.id)).toEqual([`_mail_qortal_qmail_alice_${SUFFIX}_mail_a`, '_mail_qortal_qmail_alice_mail_b'])
    expect(fetchedUrls(SEARCH)).toHaveLength(2)
    expect(fetchedUrls(SEARCH)[0]).toContain('limit=20')
  })

  it('mergeNewRows prepends unknown rows and returns the same array when nothing is new', () => {
    const known = [{ id: 'b' }, { id: 'a' }]
    expect(mergeNewRows(known, [{ id: 'b' }])).toBe(known)
    expect(mergeNewRows(known, [{ id: 'c' }, { id: 'a' }])).toEqual([{ id: 'c' }, { id: 'b' }, { id: 'a' }])
  })

  it('fetchRecentInboxMessagesForSavedAlias keeps only _mail_qortal_qmail_<alias>_mail_ identifiers', async () => {
    mockFetchRoute(SEARCH, [
      { identifier: '_mail_qortal_qmail_shop_mail_1', name: 'bob', created: 2 },
      { identifier: '_mail_qortal_qmail_shopping_mail_2', name: 'bob', created: 1 },
    ])
    const rows = await fetchRecentInboxMessagesForSavedAlias('shop')
    expect(rows.map((r) => r.id)).toEqual(['_mail_qortal_qmail_shop_mail_1'])
    expect(await fetchRecentInboxMessagesForSavedAlias('')).toEqual([])
  })
})
