import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { addToHashMapMail, addToHashMapSubject } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { primeDecryptedSubject, resetSubjectCache } from '../../utils/subjectCache'
import { useMailboxSearch } from './useMailboxSearch'
import { describeSearchStatus } from './MailboxSearchBar'

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  return store
}

const wrapperFor = (store: ReturnType<typeof makeStore>) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }

const encode = (value: unknown) => btoa(JSON.stringify(value))
const message = (id: string, user: string, createdAt: number, extra: Record<string, unknown> = {}) => ({
  id,
  user,
  createdAt,
  ...extra,
})

/** Serve decrypts for fetchAndEvaluateMail: FETCH → name → account → DECRYPT. */
function mockDecrypts(bodies: Record<string, string>) {
  mockQortalAction('FETCH_QDN_RESOURCE', (request: any) => `enc:${request.identifier}`)
  mockQortalAction('GET_NAME_DATA', { owner: 'QOwner' })
  mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PK' })
  mockQortalAction('ENCRYPT_DATA', 'encsub')
  mockQortalAction('DECRYPT_DATA', (request: any) => {
    const id = String(request.encryptedData).replace(/^enc:/, '')
    return encode({
      createdAt: 1,
      version: 1,
      attachments: [],
      generalData: {},
      subject: `Subject ${id}`,
      textContentV2: `<p>${bodies[id] || 'nothing here'}</p>`,
    })
  })
}

describe('useMailboxSearch', () => {
  beforeEach(() => {
    resetSubjectCache()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches sender, saved subject and metadata at once, 300 ms after the last key, with no decrypt', () => {
    vi.useFakeTimers()
    const store = makeStore()
    mockDecrypts({})
    store.dispatch(addToHashMapSubject({ id: 'm3', subject: 'enc-m3', attachments: false, timestamp: 1 }))
    primeDecryptedSubject('enc-m3', 'Quarterly report')
    const messages = [
      message('m1', 'alice', 3),
      message('m2', 'bob', 2, { description: 'report of the week' }),
      message('m3', 'carol', 1),
    ]
    const { result, rerender } = renderHook(
      ({ query }) => useMailboxSearch({ messages, query, mailboxType: 'inbox', username: 'alice' }),
      { initialProps: { query: '' }, wrapper: wrapperFor(store) }
    )
    expect(result.current.results).toHaveLength(3)

    rerender({ query: 'r' })
    rerender({ query: 're' })
    rerender({ query: 'rep' })
    // Nothing happened yet: still the full list, no terms.
    expect(result.current.status.terms).toEqual([])
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current.status.terms).toEqual([])
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.status.terms).toEqual(['rep'])
    expect(result.current.results.map((m) => m.id)).toEqual(['m2', 'm3'])
    expect(result.current.status.pending).toBe(3)
    expect(result.current.status.capped).toBe(true)
    expect(result.current.status.active).toBe(false)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(0)
    expect(describeSearchStatus(result.current.status)).toBe('2 matches · 3 bodies not searched')

    // Carol's row matches by sender too.
    rerender({ query: 'carol' })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.results.map((m) => m.id)).toEqual(['m3'])
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
  })

  it('searches bodies only on request, up to the limit, newest first, and continues from there', async () => {
    const store = makeStore()
    mockDecrypts({ m1: 'hello from one', m3: 'hello from three' })
    const messages = [message('m1', 'alice', 3), message('m2', 'bob', 2), message('m3', 'carol', 1)]
    const { result, rerender } = renderHook(
      ({ bodyLimit }) =>
        useMailboxSearch({ messages, query: 'hello', mailboxType: 'inbox', username: 'alice', bodyLimit, debounceMs: 1 }),
      { initialProps: { bodyLimit: 0 }, wrapper: wrapperFor(store) }
    )
    await waitFor(() => expect(result.current.status.terms).toEqual(['hello']))
    expect(result.current.results).toHaveLength(0)
    expect(result.current.status.pending).toBe(3)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)

    rerender({ bodyLimit: 2 })
    await waitFor(() => expect(result.current.status.active).toBe(false))
    await waitFor(() => expect(result.current.status.pending).toBe(1))
    const fetched = qortalCalls('FETCH_QDN_RESOURCE').map((c) => c.identifier)
    expect(fetched.sort()).toEqual(['m1', 'm2'])
    expect(result.current.results.map((m) => m.id)).toEqual(['m1'])
    expect(result.current.status.capped).toBe(true)
    expect(result.current.status.scanned).toBe(2)
    // The decrypts warmed the reader cache.
    expect((store.getState().mail.hashMapMailMessages as any).m1?.isValid).toBe(true)

    rerender({ bodyLimit: 4 })
    await waitFor(() => expect(result.current.status.pending).toBe(0))
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(3)
    expect(result.current.results.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(result.current.status.complete).toBe(true)
    expect(result.current.status.capped).toBe(false)
    expect(describeSearchStatus(result.current.status)).toBe('2 matches')

    // A new query with the same limit does not re-decrypt what is already known.
    rerender({ bodyLimit: 4 })
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(3)
  })

  it('searches Slate textContent bodies of messages decrypted earlier, without a fetch', async () => {
    const store = makeStore()
    mockDecrypts({})
    store.dispatch(
      addToHashMapMail({
        id: 'm9',
        user: 'dave',
        isValid: true,
        subject: '',
        textContent: [{ children: [{ text: 'the secret slate words' }] }],
      })
    )
    const messages = [message('m9', 'dave', 5), message('m8', 'erin', 4)]
    const { result } = renderHook(
      () => useMailboxSearch({ messages, query: 'slate secret', mailboxType: 'inbox', username: 'alice', debounceMs: 1 }),
      { wrapper: wrapperFor(store) }
    )
    await waitFor(() => expect(result.current.status.terms).toEqual(['slate', 'secret']))
    expect(result.current.results.map((m) => m.id)).toEqual(['m9'])
    expect(result.current.status.scanned).toBe(1)
    expect(result.current.status.pending).toBe(1)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
  })

  it('uses the mailbox tag of each row for sent rows in a mixed list', async () => {
    const store = makeStore()
    mockDecrypts({})
    const messages = [
      { ...message('_mail_qortal_qmail_bob_abc123_mail_s1', 'alice', 9), __qmailSearch: { kind: 'sent' } },
      { ...message('i1', 'bob', 8), __qmailSearch: { kind: 'inbox' } },
      { ...message('i2', 'zed', 7), __qmailSearch: { kind: 'alias', alias: 'shop' } },
    ]
    const { result } = renderHook(
      () => useMailboxSearch({ messages, query: 'bob', username: 'alice', debounceMs: 1 }),
      { wrapper: wrapperFor(store) }
    )
    await waitFor(() => expect(result.current.status.terms).toEqual(['bob']))
    expect(result.current.results.map((m) => m.id)).toEqual(['_mail_qortal_qmail_bob_abc123_mail_s1', 'i1'])
  })
})
