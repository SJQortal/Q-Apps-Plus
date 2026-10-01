import { beforeEach, describe, expect, it } from 'vitest'
import { fetchMock, fetchedUrls, mockFetchRoute } from '../test/setup'
import { invalidateSearches, resetSearchCache, searchResources, searchStats } from './qdnSearch'

describe('searchResources', () => {
  beforeEach(() => {
    resetSearchCache()
  })
  const okRoute = () => mockFetchRoute('/arbitrary/resources/search?', [{ identifier: 'a' }])

  it('fetches once and serves repeats from the cache', async () => {
    okRoute()
    const params = { service: 'MAIL_PRIVATE', query: 'qortal_qmail_x', limit: 20 }
    const first = await searchResources(params)
    const second = await searchResources(params)
    expect(first).toEqual([{ identifier: 'a' }])
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(searchStats().cacheHits).toBe(1)
  })

  it('merges identical searches that are in flight', async () => {
    okRoute()
    const p = new URLSearchParams({ service: 'MAIL_PRIVATE', query: 'q', limit: '20' })
    const [a, b, c] = await Promise.all([searchResources(p), searchResources(p), searchResources(p)])
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(searchStats().merged).toBe(2)
  })

  it('keys the cache on the sorted params, not on key order', async () => {
    okRoute()
    await searchResources({ limit: 20, service: 'MAIL_PRIVATE' })
    await searchResources({ service: 'MAIL_PRIVATE', limit: 20 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchedUrls()[0]).toBe('/arbitrary/resources/search?limit=20&service=MAIL_PRIVATE')
  })

  it('refetches after invalidation, with force, or when the TTL is 0', async () => {
    okRoute()
    const params = { service: 'MAIL_PRIVATE', query: 'q' }
    await searchResources(params)
    expect(invalidateSearches('service=MAIL_PRIVATE')).toBe(1)
    await searchResources(params)
    await searchResources(params, { force: true })
    await searchResources(params, { ttlMs: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('returns an empty array for a non-array body and throws on HTTP errors', async () => {
    mockFetchRoute('/arbitrary/resources/search?service=X', { error: 'nope' })
    expect(await searchResources({ service: 'X' })).toEqual([])
    mockFetchRoute('/arbitrary/resources/search?service=Y', 'fail', { status: 500 })
    await expect(searchResources({ service: 'Y' })).rejects.toThrow('QDN search failed (500)')
  })
})
