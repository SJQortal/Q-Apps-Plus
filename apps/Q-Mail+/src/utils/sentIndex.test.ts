import { beforeEach, describe, expect, it } from 'vitest'
import { fetchedUrls, mockFetchRoute } from '../test/setup'
import { resetSearchCache } from './qdnSearch'
import { fetchSentDelta, fetchSentIndex, readDeletedSentIds, writeDeletedSentIds } from './sentIndex'

const SEARCH = '/arbitrary/resources/search?'
const sent = (n: number, extra: Record<string, unknown> = {}) => ({
  identifier: `_mail_qortal_qmail_bob_abc123_mail_${n}`,
  name: 'alice',
  created: 1_000 + n,
  ...extra,
})

describe('sentIndex', () => {
  beforeEach(() => {
    resetSearchCache()
  })

  it('fetches both queries per name through the cache, hides tombstones and local deletes', async () => {
    mockFetchRoute(/query=_mail_qortal_qmail_/, [
      sent(3),
      sent(2, { metadata: { title: '__qmail_deleted__' } }),
      sent(1),
      { identifier: 'qortal_qmail_thread_group1_tok', name: 'alice', created: 5 },
    ])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    writeDeletedSentIds('alice', { [sent(1).identifier]: true })
    expect(readDeletedSentIds('alice')).toEqual({ [sent(1).identifier]: true })

    const rows = await fetchSentIndex(['alice'], readDeletedSentIds('alice'))
    expect(rows.map((r) => r.id)).toEqual([sent(3).identifier])
    expect(fetchedUrls(SEARCH)).toHaveLength(2)
    expect(fetchedUrls(SEARCH)[0]).toContain('exactmatchnames=true')
    expect(fetchedUrls(SEARCH)[0]).toContain('name=alice')
    expect(fetchedUrls(SEARCH)[0]).toContain('limit=200')

    // Same index again within the TTL: served from the cache.
    await fetchSentIndex(['alice'])
    expect(fetchedUrls(SEARCH)).toHaveLength(2)
  })

  it('the delta poll asks for 20 newest, always hits the node, and stops at the first known id', async () => {
    mockFetchRoute(/query=_mail_qortal_qmail_/, [sent(5), sent(4), sent(3), sent(2)])
    mockFetchRoute(/query=qortal_qmail_&/, [])
    const known = new Set([sent(3).identifier, sent(2).identifier])
    const fresh = await fetchSentDelta(['alice'], known)
    expect(fresh.map((r) => r.id)).toEqual([sent(5).identifier, sent(4).identifier])
    expect(fetchedUrls(SEARCH)).toHaveLength(2)
    expect(fetchedUrls(SEARCH).every((url) => url.includes('limit=20'))).toBe(true)

    const again = await fetchSentDelta(['alice'], new Set([sent(5).identifier]))
    expect(again).toHaveLength(0)
    // TTL 0: a second poll fetched again rather than reading the cache.
    expect(fetchedUrls(SEARCH)).toHaveLength(4)
  })
})
