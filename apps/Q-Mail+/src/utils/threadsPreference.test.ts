import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  SHOW_THREADS_STORAGE_PREFIX,
  readShowGroupThreads,
  showThreadsStorageKey,
  useShowGroupThreads,
  writeShowGroupThreads,
} from './threadsPreference'

describe('the Show group threads setting', () => {
  it('is on by default, per account, and stored only while off', () => {
    expect(readShowGroupThreads('QA')).toBe(true)
    writeShowGroupThreads('QA', false)
    expect(localStorage.getItem(`${SHOW_THREADS_STORAGE_PREFIX}QA`)).toBe('false')
    expect(readShowGroupThreads('QA')).toBe(false)
    expect(readShowGroupThreads('QB')).toBe(true)
    writeShowGroupThreads('QA', true)
    expect(localStorage.getItem(`${SHOW_THREADS_STORAGE_PREFIX}QA`)).toBeNull()
    expect(readShowGroupThreads('QA')).toBe(true)
  })

  it('without an account it is on and nothing is stored', () => {
    expect(showThreadsStorageKey('')).toBe('')
    writeShowGroupThreads(undefined, false)
    expect(readShowGroupThreads(undefined)).toBe(true)
    expect(Object.keys(localStorage)).toEqual([])
  })

  it('an open mailbox follows a change from Settings at once', () => {
    const { result } = renderHook(() => useShowGroupThreads('QA'))
    expect(result.current).toBe(true)
    act(() => writeShowGroupThreads('QA', false))
    expect(result.current).toBe(false)
    act(() => writeShowGroupThreads('QA', true))
    expect(result.current).toBe(true)
  })
})
