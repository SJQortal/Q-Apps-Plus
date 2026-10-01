import { beforeEach, describe, expect, it } from 'vitest'
import { fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from '../../test/setup'
import { resetSearchCache } from '../../utils/qdnSearch'
import {
  activityFromRows,
  applyActivity,
  belongsToGroup,
  fetchGroupActivity,
  fetchThreadHeader,
  fetchThreadPage,
  invalidateThreadSearches,
  resetThreadDataCache,
  threadActivitySearchParams,
  threadHeaderSearchParams,
  threadIdFor,
  threadMessagesSearchParams,
  threadTokenFromMessageId,
  threadTokenFromThreadId,
} from './threadData'

const group = { id: '1', name: 'Devs' }
const header = (token: string, description: string | undefined, created = 1000) => ({
  name: 'alice',
  service: 'MAIL',
  identifier: `qortal_qmail_thread_group1_${token}`,
  created,
  metadata: description === undefined ? undefined : { description },
})

describe('thread identifiers', () => {
  it('derives tokens positionally, as the original readers do', () => {
    expect(threadTokenFromThreadId('qortal_qmail_thread_group12_abc')).toBe('abc')
    expect(threadTokenFromMessageId('qortal_qmail_thmsg_group12_abc_xyz')).toBe('abc')
    expect(threadIdFor('12', 'abc')).toBe('qortal_qmail_thread_group12_abc')
  })

  it('keeps only exact group ids out of the substring search', () => {
    expect(belongsToGroup('qortal_qmail_thread_group1_abc', '1', 'thread')).toBe(true)
    expect(belongsToGroup('qortal_qmail_thread_group10_abc', '1', 'thread')).toBe(false)
    expect(belongsToGroup('qortal_qmail_thmsg_group1_abc_x', '1', 'thmsg')).toBe(true)
    expect(belongsToGroup('qortal_qmail_thmsg_group1_abc_x', '1', 'thread')).toBe(false)
  })

  it('builds the same query strings the original app sends', () => {
    expect(threadHeaderSearchParams('1').toString()).toBe(
      'mode=ALL&service=MAIL&query=qortal_qmail_thread_group1&limit=20&includemetadata=true&offset=0&reverse=true&excludeblocked=true'
    )
    expect(threadHeaderSearchParams('1', { offset: 40, reverse: false }).toString()).toContain('offset=40&reverse=false')
    expect(threadActivitySearchParams('1').toString()).toBe(
      'mode=ALL&service=MAIL_PRIVATE&query=qortal_qmail_thmsg_group1&limit=100&includemetadata=false&offset=0&reverse=true&excludeblocked=true'
    )
    expect(threadMessagesSearchParams('1', 'abc', 20).toString()).toBe(
      'mode=ALL&service=MAIL_PRIVATE&query=qortal_qmail_thmsg_group1_abc&limit=20&includemetadata=false&offset=20&reverse=true&excludeblocked=true'
    )
  })
})

describe('activity', () => {
  it('groups posts by thread token, newest first, ignoring other groups', () => {
    const rows = [
      { identifier: 'qortal_qmail_thmsg_group1_t1_m3', created: 300, name: 'bob' },
      { identifier: 'qortal_qmail_thmsg_group1_t2_m2', created: 200, name: 'carol' },
      { identifier: 'qortal_qmail_thmsg_group1_t1_m1', created: 100, name: 'alice' },
      { identifier: 'qortal_qmail_thmsg_group10_t9_m9', created: 900, name: 'eve' },
    ]
    const activity = activityFromRows(rows, '1')
    expect(activity).toEqual([
      { token: 't1', latestCreated: 300, latestName: 'bob', count: 2 },
      { token: 't2', latestCreated: 200, latestName: 'carol', count: 1 },
    ])
    const threads = [
      { identifier: 'qortal_qmail_thread_group1_t1', threadId: 'qortal_qmail_thread_group1_t1', created: 50, threadOwner: 'alice', threadData: { title: 'A', groupId: '1', createdAt: 50, name: 'alice' } },
      { identifier: 'qortal_qmail_thread_group1_t3', threadId: 'qortal_qmail_thread_group1_t3', created: 500, threadOwner: 'dan', threadData: { title: 'C', groupId: '1', createdAt: 500, name: 'dan' } },
    ]
    const merged = applyActivity(threads, activity)
    expect(merged[0]).toMatchObject({ lastActivity: 300, lastPostBy: 'bob', postCount: 2 })
    expect(merged[1].lastActivity).toBeUndefined()
  })
})

describe('fetching', () => {
  beforeEach(() => {
    resetSearchCache()
    resetThreadDataCache()
  })

  it('takes titles from metadata and fetches the header JSON only when the description is missing', async () => {
    mockFetchRoute('/arbitrary/resources/search?', [
      header('t1', 'First thread'),
      header('t2', undefined),
      header('t3', '   '),
      { ...header('t4', 'Other group'), identifier: 'qortal_qmail_thread_group10_t4' },
    ])
    mockQortalAction('FETCH_QDN_RESOURCE', (request: Record<string, any>) =>
      request.identifier.endsWith('_t2') ? { title: 'From JSON' } : {}
    )
    const page = await fetchThreadPage(group)
    expect(page.threads.map((thread) => thread.threadData.title)).toEqual(['First thread', 'From JSON', 'Untitled thread'])
    expect(page.threads.every((thread) => thread.groupName === 'Devs' && thread.threadData.groupId === '1')).toBe(true)
    expect(page.hasMore).toBe(false)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)

    // The same page again costs no search and no fetch.
    await fetchThreadPage(group)
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(1)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)
  })

  it('reports hasMore on a full page', async () => {
    mockFetchRoute('/arbitrary/resources/search?', Array.from({ length: 20 }, (_, i) => header(`t${i}`, `T${i}`)))
    const page = await fetchThreadPage(group)
    expect(page.threads).toHaveLength(20)
    expect(page.hasMore).toBe(true)
  })

  it('answers a header lookup from memory once a list loaded it', async () => {
    mockFetchRoute('/arbitrary/resources/search?', [header('t1', 'First thread')])
    await fetchThreadPage(group)
    const found = await fetchThreadHeader(group, 'qortal_qmail_thread_group1_t1')
    expect(found?.threadData.title).toBe('First thread')
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(1)
  })

  it('invalidates a group\'s thread and post searches after a publish', async () => {
    mockFetchRoute('/arbitrary/resources/search?', [])
    await fetchThreadPage(group)
    await fetchGroupActivity('1')
    await fetchThreadPage({ id: '2', name: 'Other' })
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(3)
    expect(invalidateThreadSearches('1')).toBe(2)
    await fetchThreadPage(group)
    await fetchGroupActivity('1')
    await fetchThreadPage({ id: '2', name: 'Other' })
    expect(fetchedUrls('/arbitrary/resources/search')).toHaveLength(5)
  })
})
