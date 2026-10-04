import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { fetchedUrls, mockFetchRoute } from '../../test/setup'
import { resetSearchCache, searchResources } from '../../utils/qdnSearch'
import { resetThreadDataCache, threadActivitySearchParams, threadHeaderSearchParams } from './threadData'
import {
  countUnread,
  isThreadUnread,
  useThreadUnreadCounts,
  readViewedThreads,
  saveThreadViewed,
  viewedThreadKey,
  viewedThreadsStorageKey,
} from './threadUnread'
import type { ThreadSummary } from './threadData'

const thread = (token: string, created: number, lastActivity?: number): ThreadSummary => ({
  identifier: `qortal_qmail_thread_group1_${token}`,
  threadId: `qortal_qmail_thread_group1_${token}`,
  created,
  threadOwner: 'alice',
  threadData: { title: token, groupId: '1', createdAt: created, name: 'alice' },
  lastActivity,
})

describe('viewed-thread store', () => {
  it('writes the original key and shape and keeps at most 500 entries', () => {
    saveThreadViewed('alice', '1', 'qortal_qmail_thread_group1_t1', 5000)
    const raw = JSON.parse(localStorage.getItem('qmail_threads_viewedtimestamp_alice') || '{}')
    expect(raw).toEqual({ qmail_threads_1_qortal_qmail_thread_group1_t1: { timestamp: 5000 } })
    expect(viewedThreadsStorageKey('alice')).toBe('qmail_threads_viewedtimestamp_alice')
    expect(viewedThreadKey(1, 'x')).toBe('qmail_threads_1_x')

    for (let i = 0; i < 520; i += 1) saveThreadViewed('alice', '1', `t${i}`, 10_000 + i)
    const stored = readViewedThreads('alice')
    expect(Object.keys(stored)).toHaveLength(500)
    expect(stored['qmail_threads_1_t519']).toEqual({ timestamp: 10_519 })
    expect(stored['qmail_threads_1_qortal_qmail_thread_group1_t1']).toBeUndefined()
  })

  it('reads a store written by the original app and tolerates junk', () => {
    localStorage.setItem('qmail_threads_viewedtimestamp_bob', JSON.stringify({ qmail_threads_1_x: { timestamp: 42 } }))
    expect(readViewedThreads('bob')).toEqual({ qmail_threads_1_x: { timestamp: 42 } })
    localStorage.setItem('qmail_threads_viewedtimestamp_eve', '{not json')
    expect(readViewedThreads('eve')).toEqual({})
    expect(readViewedThreads(undefined)).toEqual({})
  })

  it('marks a thread unread when never opened or when newer activity exists', () => {
    saveThreadViewed('alice', '1', 'qortal_qmail_thread_group1_seen', 1000)
    const viewed = readViewedThreads('alice')
    expect(isThreadUnread(viewed, thread('never', 500))).toBe(true)
    expect(isThreadUnread(viewed, thread('seen', 500))).toBe(false)
    expect(isThreadUnread(viewed, thread('seen', 500, 900))).toBe(false)
    expect(isThreadUnread(viewed, thread('seen', 500, 1500))).toBe(true)
    expect(countUnread(viewed, [thread('never', 1), thread('seen', 500, 1500), thread('seen', 500)])).toBe(2)
  })

  it('tells listeners when a thread was opened', () => {
    let detail: any = null
    const onViewed = (event: Event) => {
      detail = (event as CustomEvent).detail
    }
    document.addEventListener('qmail:thread-viewed', onViewed)
    saveThreadViewed('alice', '2', 'qortal_qmail_thread_group2_t', 7)
    document.removeEventListener('qmail:thread-viewed', onViewed)
    expect(detail).toEqual({ username: 'alice', key: 'qmail_threads_2_qortal_qmail_thread_group2_t' })
  })
})

describe('useThreadUnreadCounts', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const tick = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  it('reuses searches an open view made under a minute ago, and backs off while nothing changes', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    resetSearchCache()
    resetThreadDataCache()
    mockFetchRoute('/arbitrary/resources/search?', [])
    const groups = [{ id: '1', name: 'Devs' }]
    renderHook(() => useThreadUnreadCounts(groups, 'alice'))
    await tick(0)
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(2)

    // An open Threads view refreshed both searches 30 s before the tick.
    await tick(90_000)
    await act(async () => {
      await searchResources(threadHeaderSearchParams('1'), { force: true })
      await searchResources(threadActivitySearchParams('1'), { force: true })
    })
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(4)
    await tick(30_000)
    // The 120 s tick took those answers instead of searching again.
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(4)

    // Nothing changed, so the next tick waits 240 s, not 120 s.
    await tick(120_000)
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(4)
    await tick(120_000)
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(6)
    vi.restoreAllMocks()
  })
})
