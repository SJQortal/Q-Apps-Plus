import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import mailReducer, {
  applyPublishedReadState,
  markRead,
  markUnread,
  setReadState,
} from '../state/features/mailSlice'
import {
  READ_STATE_MAX_ENTRIES,
  countUnreadMessages,
  getReadStateStorageKey,
  isMessageRead,
  pruneReadState,
  readIdsFromState,
  readReadStateFromStorage,
  withMessagesRead,
  withMessagesUnread,
  withPublishedReadState,
  writeReadStateToStorage,
} from './readState'

const reply = { id: 'r1', generalData: { threadV2: [{ reference: {}, data: {} }] } }
const fresh = { id: 'f1', generalData: { thread: [], threadV2: [] } }
const noData = { id: 'n1' }

describe('readState helpers', () => {
  it('treats a store entry > 0 as read, 0 as unread, and falls back to threadV2', () => {
    expect(isMessageRead(fresh, {})).toBe(false)
    expect(isMessageRead(noData, {})).toBe(false)
    expect(isMessageRead(reply, {})).toBe(true) // compatible with the original app
    expect(isMessageRead(fresh, { f1: 5 })).toBe(true)
    expect(isMessageRead(reply, { r1: 0 })).toBe(false) // explicit unread wins
  })

  it('withMessagesRead / withMessagesUnread return the same map when nothing changes', () => {
    const base = { a: 10 }
    expect(withMessagesRead(base, ['a'])).toBe(base)
    const next = withMessagesRead(base, ['b', ''], 20)
    expect(next).toEqual({ a: 10, b: 20 })
    expect(base).toEqual({ a: 10 })
    expect(withMessagesUnread(next, ['b'])).toEqual({ a: 10, b: 0 })
    expect(withMessagesUnread({ b: 0 }, ['b'])).toEqual({ b: 0 })
  })

  it('a published load fills only ids with no local decision', () => {
    const local = { kept: 0, already: 3 }
    expect(withPublishedReadState(local, ['kept', 'already', 'new'], 9)).toEqual({
      kept: 0,
      already: 3,
      new: 9,
    })
    expect(withPublishedReadState(local, ['kept'])).toBe(local)
  })

  it('counts unread once per id, honouring exclusions', () => {
    const messages = [fresh, fresh, reply, noData, { id: 'x' }]
    expect(countUnreadMessages(messages, {})).toBe(3)
    expect(countUnreadMessages(messages, { f1: 1 })).toBe(2)
    expect(countUnreadMessages(messages, {}, new Set(['x']))).toBe(2)
    expect(countUnreadMessages(messages, {}, { n1: { at: 1 } })).toBe(2)
    expect(countUnreadMessages([], {})).toBe(0)
  })

  it('readIdsFromState only lists read entries', () => {
    expect(Array.from(readIdsFromState({ a: 1, b: 0, c: 7 }))).toEqual(['a', 'c'])
  })

  it('prunes the oldest entries past the cap', () => {
    const big: Record<string, number> = {}
    for (let i = 0; i < READ_STATE_MAX_ENTRIES + 10; i += 1) big[`m${i}`] = i + 1
    const pruned = pruneReadState(big)
    expect(Object.keys(pruned)).toHaveLength(READ_STATE_MAX_ENTRIES)
    expect(pruned.m0).toBeUndefined()
    expect(pruned[`m${READ_STATE_MAX_ENTRIES + 9}`]).toBeDefined()
    expect(pruneReadState({ a: 1 }, 5)).toEqual({ a: 1 })
  })

  it('round-trips through localStorage per address and ignores bad data', () => {
    expect(getReadStateStorageKey('QAddr')).toBe('qmail_read_state_QAddr')
    expect(getReadStateStorageKey('')).toBe('')
    writeReadStateToStorage('QAddr', { a: 1, b: 0 })
    expect(readReadStateFromStorage('QAddr')).toEqual({ a: 1, b: 0 })
    expect(readReadStateFromStorage('Other')).toEqual({})
    window.localStorage.setItem('qmail_read_state_Bad', '[1,2]')
    expect(readReadStateFromStorage('Bad')).toEqual({})
    window.localStorage.setItem('qmail_read_state_Mixed', JSON.stringify({ ok: 3, neg: -1, nan: 'x' }))
    expect(readReadStateFromStorage('Mixed')).toEqual({ ok: 3 })
  })
})

describe('mailSlice read state', () => {
  const makeStore = () => configureStore({ reducer: { mail: mailReducer } })

  it('marks read, unread and applies published entries', () => {
    const store = makeStore()
    store.dispatch(setReadState({ address: 'QAddr', entries: { old: 1 } }))
    expect(store.getState().mail.readStateAddress).toBe('QAddr')
    store.dispatch(markRead({ ids: ['a', 'b'], at: 50 }))
    expect(store.getState().mail.readState).toEqual({ old: 1, a: 50, b: 50 })
    store.dispatch(markUnread({ ids: ['a'] }))
    expect(store.getState().mail.readState.a).toBe(0)
    store.dispatch(applyPublishedReadState({ ids: ['a', 'c'], at: 70 }))
    expect(store.getState().mail.readState).toEqual({ old: 1, a: 0, b: 50, c: 70 })
  })
})
