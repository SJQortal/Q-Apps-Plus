import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import mailReducer, {
  applyPublishedArchived,
  archiveIds,
  setArchivedState,
  unarchiveIds,
} from '../state/features/mailSlice'
import {
  ARCHIVED_MAX_ENTRIES,
  getArchivedStorageKey,
  haveSameArchivedIds,
  isArchivedId,
  normalizeArchivedMap,
  pruneArchived,
  readArchivedFromStorage,
  withArchived,
  withPublishedArchived,
  withUnarchived,
  writeArchivedToStorage,
} from './archiveState'

describe('archiveState helpers', () => {
  it('archives and unarchives without mutating, returning the same map when nothing changes', () => {
    const base = { a: { at: 1 } }
    expect(withArchived(base, ['a'])).toBe(base)
    const next = withArchived(base, ['b', ''], 5)
    expect(next).toEqual({ a: { at: 1 }, b: { at: 5 } })
    expect(base).toEqual({ a: { at: 1 } })
    expect(withUnarchived(next, ['zzz'])).toBe(next)
    expect(withUnarchived(next, ['a'])).toEqual({ b: { at: 5 } })
    expect(isArchivedId(next, 'b')).toBe(true)
    expect(isArchivedId(next, '')).toBe(false)
  })

  it('merges a published map with local entries winning', () => {
    const local = { a: { at: 10 } }
    expect(withPublishedArchived(local, { a: { at: 1 } })).toBe(local)
    expect(withPublishedArchived(local, { a: { at: 1 }, b: { at: 2 } })).toEqual({ a: { at: 10 }, b: { at: 2 } })
    expect(haveSameArchivedIds({ a: { at: 1 } }, { a: { at: 9 } })).toBe(true)
    expect(haveSameArchivedIds({ a: { at: 1 } }, { b: { at: 1 } })).toBe(false)
    expect(haveSameArchivedIds({}, {})).toBe(true)
  })

  it('normalizes arbitrary input to { id: { at } } entries', () => {
    expect(normalizeArchivedMap(null)).toEqual({})
    expect(normalizeArchivedMap([1])).toEqual({})
    expect(normalizeArchivedMap({ ok: { at: 3 }, bad: { at: 'x' }, zero: { at: 0 }, none: true })).toEqual({
      ok: { at: 3 },
    })
  })

  it('prunes the oldest past the cap and round-trips through localStorage', () => {
    const big: Record<string, { at: number }> = {}
    for (let i = 0; i < ARCHIVED_MAX_ENTRIES + 3; i += 1) big[`m${i}`] = { at: i + 1 }
    const pruned = pruneArchived(big)
    expect(Object.keys(pruned)).toHaveLength(ARCHIVED_MAX_ENTRIES)
    expect(pruned.m0).toBeUndefined()
    expect(getArchivedStorageKey('QA')).toBe('qmail_archived_QA')
    writeArchivedToStorage('QA', { a: { at: 1 } })
    expect(readArchivedFromStorage('QA')).toEqual({ a: { at: 1 } })
    expect(readArchivedFromStorage('QB')).toEqual({})
    window.localStorage.setItem('qmail_archived_QC', 'not json')
    expect(readArchivedFromStorage('QC')).toEqual({})
  })
})

describe('mailSlice archive reducers', () => {
  it('archives, unarchives and applies a published map', () => {
    const store = configureStore({ reducer: { mail: mailReducer } })
    store.dispatch(setArchivedState({ address: 'QA', entries: { old: { at: 1 } } }))
    expect(store.getState().mail.archivedAddress).toBe('QA')
    store.dispatch(archiveIds({ ids: ['a'], at: 2 }))
    expect(store.getState().mail.archived).toEqual({ old: { at: 1 }, a: { at: 2 } })
    store.dispatch(unarchiveIds({ ids: ['old'] }))
    expect(store.getState().mail.archived).toEqual({ a: { at: 2 } })
    store.dispatch(applyPublishedArchived({ a: { at: 99 }, fromDoc: { at: 3 } }))
    expect(store.getState().mail.archived).toEqual({ a: { at: 2 }, fromDoc: { at: 3 } })
  })
})
