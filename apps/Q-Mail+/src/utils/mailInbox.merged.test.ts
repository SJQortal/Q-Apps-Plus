/**
 * The merged probes (one search for many names) find the same names as the
 * per-name probes they replace, and fall back to those probes when a merged
 * search fails or reaches its page cap. Group avatars are asked once per group.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from '../test/setup'
import { resetSearchCache } from './qdnSearch'
import {
  MERGED_PROBE_MAX_PAGES,
  THREAD_PROBE_MAX_PAGES,
  fetchGroupAvatarUrl,
  groupIdsWithThreads,
  groupsWithThreadActivity,
  mapWithConcurrency,
  ownedNamesWithAddressMail,
  ownedNamesWithSentMail,
  resetGroupAvatarCache,
} from './mailInbox'

const ADDRESS = 'QOwnerAddressABCDEF'
const SUFFIX = 'ABCDEF'
const searches = () => fetchedUrls('/arbitrary/resources/search?')
const paramsOf = (url: string) => new URLSearchParams(url.split('?')[1])

describe('ownedNamesWithSentMail', () => {
  beforeEach(() => resetSearchCache())

  it('asks once per kind for all names, and keeps the per-name row test', async () => {
    // New form (identifier _mail_): Alice has one, Bob only a deleted one.
    mockFetchRoute(/identifier=_mail_/, [
      { name: 'Alice', identifier: `_mail_qortal_qmail_zed_${SUFFIX}_mail_a1`, metadata: {} },
      { name: 'Bob', identifier: `_mail_qortal_qmail_zed_${SUFFIX}_mail_b1`, metadata: { title: '__qmail_deleted__' } },
    ])
    // Legacy form: Carol's mail has no leading _mail_.
    mockFetchRoute(/query=qortal_qmail_/, [{ name: 'carol', identifier: `qortal_qmail_zed_${SUFFIX}_mail_c1`, metadata: {} }])
    const found = await ownedNamesWithSentMail(['Alice', 'Bob', 'Carol'])
    expect([...found].sort()).toEqual(['alice', 'carol'])
    const urls = searches()
    expect(urls).toHaveLength(2)
    expect(paramsOf(urls[0]).getAll('name')).toEqual(['Alice', 'Bob', 'Carol'])
    expect(paramsOf(urls[0]).get('exactmatchnames')).toBe('true')
    // The legacy search only asks for the names still open.
    expect(paramsOf(urls[1]).getAll('name')).toEqual(['Bob', 'Carol'])
  })

  it('splits long name lists into searches of at most 50 names', async () => {
    mockFetchRoute(/arbitrary\/resources\/search/, [])
    const names = Array.from({ length: 120 }, (_, i) => `name${i}`)
    await ownedNamesWithSentMail(names)
    const counts = searches().map((url) => paramsOf(url).getAll('name').length)
    expect(counts).toEqual([50, 50, 20, 50, 50, 20])
  })

  it('falls back to the per-name probe for names a failed merged search left open', async () => {
    // Both merged searches (they name Alice and Bob) fail; the per-name probes answer.
    mockFetchRoute(/name=Alice&name=Bob/, '{"error":1}', { status: 500 })
    mockFetchRoute(/name=Bob/, [{ name: 'Bob', identifier: `_mail_qortal_qmail_zed_${SUFFIX}_mail_b1`, metadata: {} }])
    mockFetchRoute(/arbitrary\/resources\/search/, [])
    const found = await ownedNamesWithSentMail(['Alice', 'Bob'])
    expect([...found]).toEqual(['bob'])
    const perName = searches().filter((url) => paramsOf(url).getAll('name').length === 1)
    expect(perName.map((url) => paramsOf(url).get('name'))).toEqual(['Alice', 'Alice', 'Bob'])
  })
})

describe('ownedNamesWithAddressMail', () => {
  beforeEach(() => resetSearchCache())

  it('finds every name with by-address mail in one search for the address suffix', async () => {
    mockFetchRoute(new RegExp(`query=_${SUFFIX}_mail_`), [
      { name: 'x', identifier: `_mail_qortal_qmail_Simon James_${SUFFIX}_mail_1` },
      { name: 'y', identifier: `_mail_qortal_qmail_simon james_${SUFFIX}_mail_2` },
      // a name longer than 20 characters is truncated in the identifier
      { name: 'z', identifier: `_mail_qortal_qmail_Custom Node on Qorta_${SUFFIX}_mail_3` },
      // legacy form (no leading _mail_): not counted for owned names, as before
      { name: 'w', identifier: `qortal_qmail_POS+_${SUFFIX}_mail_4` },
      // another account's suffix in the middle of an identifier
      { name: 'v', identifier: `_mail_qortal_qmail_Bob_${SUFFIX}_mail_x_OTHER1_mail_5` },
    ])
    const names = ['Simon James', 'Custom Node on Qortal GO | GUIDE', 'POS+', 'Bob', 'Nobody']
    const { found, settled } = await ownedNamesWithAddressMail(names, ADDRESS)
    expect(settled).toBe(true)
    expect([...found].sort()).toEqual(['bob', 'custom node on qortal go | guide', 'simon james'])
    expect(searches()).toHaveLength(1)
    expect(paramsOf(searches()[0]).get('query')).toBe(`_${SUFFIX}_mail_`)
  })

  it('reads every page, and says when it stopped at the cap', async () => {
    let page = 0
    const fullPage = () =>
      Array.from({ length: 200 }, (_, i) => ({ name: 'x', identifier: `_mail_qortal_qmail_other_${SUFFIX}_mail_${page}-${i}` }))
    mockFetchRoute(new RegExp(`query=_${SUFFIX}_mail_`), fullPage())
    page += 1
    const { settled } = await ownedNamesWithAddressMail(['Alice'], ADDRESS)
    expect(settled).toBe(false)
    expect(searches()).toHaveLength(MERGED_PROBE_MAX_PAGES)
    expect(searches().map((url) => paramsOf(url).get('offset'))).toEqual(
      Array.from({ length: MERGED_PROBE_MAX_PAGES }, (_, i) => String(i * 200))
    )
  })

  it('is unsettled when the search fails', async () => {
    mockFetchRoute(new RegExp(`query=_${SUFFIX}_mail_`), '{"error":1}', { status: 500 })
    expect((await ownedNamesWithAddressMail(['Alice'], ADDRESS)).settled).toBe(false)
  })
})

describe('mapWithConcurrency', () => {
  it('keeps input order and runs at most `limit` at once', async () => {
    let running = 0
    let peak = 0
    const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, n))
      running -= 1
      return n * 10
    })
    expect(out).toEqual([50, 10, 40, 20, 30])
    expect(peak).toBe(2)
    expect(await mapWithConcurrency([], 4, async (n: number) => n)).toEqual([])
  })
})

describe('fetchGroupAvatarUrl', () => {
  beforeEach(() => {
    resetSearchCache()
    resetGroupAvatarCache()
  })

  it('asks once per group, also when two callers ask at the same moment', async () => {
    mockFetchRoute(/service=THUMBNAIL/, [{ name: 'alice', identifier: 'qortal_group_avatar_694' }])
    mockQortalAction('GET_QDN_RESOURCE_URL', '/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694')
    const [a, b] = await Promise.all([fetchGroupAvatarUrl(694), fetchGroupAvatarUrl('694')])
    expect(a).toBe('/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694')
    expect(b).toBe(a)
    expect(await fetchGroupAvatarUrl(694)).toBe(a)
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1)
    expect(searches()).toHaveLength(1)
  })

  it('asks again after a failed lookup instead of hiding the avatar all session', async () => {
    mockFetchRoute(/service=THUMBNAIL/, [{ name: 'alice', identifier: 'qortal_group_avatar_694' }])
    let up = false
    mockQortalAction('GET_QDN_RESOURCE_URL', () => {
      if (!up) throw new Error('Request timed out')
      return '/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694'
    })
    expect(await fetchGroupAvatarUrl(694)).toBe('')
    up = true
    expect(await fetchGroupAvatarUrl(694)).toBe('/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694')
    expect(await fetchGroupAvatarUrl(694)).toBe('/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694')
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(2)
  })

  it('asks again after a failed search', async () => {
    mockFetchRoute(/service=THUMBNAIL/, 'busy', { status: 503 })
    expect(await fetchGroupAvatarUrl(7)).toBe('')
    expect(await fetchGroupAvatarUrl(7)).toBe('')
    expect(searches()).toHaveLength(2)
  })

  it('remembers a group without an avatar too', async () => {
    mockFetchRoute(/service=THUMBNAIL/, [])
    expect(await fetchGroupAvatarUrl(7)).toBe('')
    expect(await fetchGroupAvatarUrl(7)).toBe('')
    expect(searches()).toHaveLength(1)
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(0)
  })
})

describe('groupsWithThreadActivity', () => {
  beforeEach(() => resetSearchCache())

  it('finds the groups with threads in one search, with the per-group identifier test', async () => {
    mockFetchRoute(/query=qortal_qmail_thread_group/, [
      { name: 'a', identifier: 'qortal_qmail_thread_group7_tok1' },
      { name: 'b', identifier: 'qortal_qmail_thread_group70_tok2' },
      { name: 'c', identifier: 'qortal_qmail_thread_group709_tok3' },
      { name: 'd', identifier: 'qortal_qmail_thread_group7' }, // no token: not a header
    ])
    const { found, settled } = await groupsWithThreadActivity([7, '709', 8, ' 694 '])
    expect(settled).toBe(true)
    expect([...found].sort()).toEqual(['7', '709'])
    expect(searches()).toHaveLength(1)
    expect(paramsOf(searches()[0]).get('service')).toBe('MAIL')
  })

  it('stops after THREAD_PROBE_MAX_PAGES of other groups\' headers', async () => {
    const page = Array.from({ length: 200 }, (_, i) => ({ name: 'x', identifier: `qortal_qmail_thread_group5000_t${i}` }))
    mockFetchRoute(/query=qortal_qmail_thread_group&/, page)
    const { found, settled } = await groupsWithThreadActivity([7])
    expect(settled).toBe(false)
    expect(found.size).toBe(0)
    expect(searches()).toHaveLength(THREAD_PROBE_MAX_PAGES)
  })

  it('then probes only the groups it has not found, one search each', async () => {
    const page = [
      { name: 'a', identifier: 'qortal_qmail_thread_group7_tok1' },
      ...Array.from({ length: 199 }, (_, i) => ({ name: 'x', identifier: `qortal_qmail_thread_group5000_t${i}` })),
    ]
    mockFetchRoute(/query=qortal_qmail_thread_group&/, page)
    mockFetchRoute(/query=qortal_qmail_thread_group709&/, [{ name: 'b', identifier: 'qortal_qmail_thread_group709_tok2' }])
    mockFetchRoute(/query=qortal_qmail_thread_group8&/, [{ name: 'c', identifier: 'qortal_qmail_thread_group80_tok3' }])
    const found = await groupIdsWithThreads([7, '709', 8])
    expect([...found].sort()).toEqual(['7', '709'])
    const perGroup = searches()
      .map((url) => paramsOf(url).get('query'))
      .filter((query) => query !== 'qortal_qmail_thread_group')
    expect(perGroup.sort()).toEqual(['qortal_qmail_thread_group709', 'qortal_qmail_thread_group8'])
  })

  it('asks nothing without groups, and is unsettled when the search fails', async () => {
    expect(await groupsWithThreadActivity([])).toEqual({ found: new Set(), settled: true })
    expect(searches()).toHaveLength(0)
    mockFetchRoute(/query=qortal_qmail_thread_group/, '{"error":1}', { status: 500 })
    expect((await groupsWithThreadActivity([7])).settled).toBe(false)
  })
})
