import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { mockFetchRoute, mockQortalAction, qortalCalls } from '../../test/setup'
import { resetSearchCache } from '../../utils/qdnSearch'
import { resetGroupAvatarCache } from '../../utils/mailInbox'
import { useGroupAvatarUrls } from './useGroupAvatarUrls'

const urlOf = (request: any) => `/arbitrary/THUMBNAIL/${request.name}/${request.identifier}`

describe('useGroupAvatarUrls', () => {
  beforeEach(() => {
    resetSearchCache()
    resetGroupAvatarCache()
  })
  afterEach(() => vi.useRealTimers())

  it('shows each answer, "" for a group without an avatar, and asks once per group', async () => {
    mockFetchRoute(/qortal_group_avatar_694/, [{ name: 'alice', identifier: 'qortal_group_avatar_694' }])
    mockFetchRoute(/qortal_group_avatar_7&/, [])
    mockQortalAction('GET_QDN_RESOURCE_URL', urlOf)
    const { result, rerender } = renderHook(({ ids }) => useGroupAvatarUrls(ids, true), { initialProps: { ids: ['694', 7] as Array<string | number> } })
    await waitFor(() => expect(result.current).toEqual({ '694': '/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694', '7': '' }))
    rerender({ ids: ['694', 7] })
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1)
  })

  it('asks nothing until enabled', () => {
    renderHook(() => useGroupAvatarUrls(['694'], false))
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(0)
  })

  it('asks a group whose lookup failed again when the groups change, instead of showing none all session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetchRoute(/qortal_group_avatar_694/, [{ name: 'alice', identifier: 'qortal_group_avatar_694' }])
    mockFetchRoute(/qortal_group_avatar_659/, [{ name: 'bob', identifier: 'qortal_group_avatar_659' }])
    let up = false
    mockQortalAction('GET_QDN_RESOURCE_URL', (request: any) => {
      if (request.identifier === 'qortal_group_avatar_694' && !up) throw new Error('Request timed out')
      return urlOf(request)
    })
    const { result, rerender } = renderHook(({ ids }) => useGroupAvatarUrls(ids, true), { initialProps: { ids: ['694'] } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    // Asked now, after 5 s and after 20 s more, then unknown: nothing stored, nothing asked by itself.
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(3)
    expect(result.current).toEqual({})
    up = true
    rerender({ ids: ['694', '659'] })
    await waitFor(() => expect(result.current['694']).toBe('/arbitrary/THUMBNAIL/alice/qortal_group_avatar_694'))
    expect(result.current['659']).toBe('/arbitrary/THUMBNAIL/bob/qortal_group_avatar_659')
  })
})
