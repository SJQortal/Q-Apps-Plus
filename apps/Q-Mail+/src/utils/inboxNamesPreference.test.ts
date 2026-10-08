import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  HIDDEN_INBOX_NAMES_PREFIX,
  readHiddenInboxNames,
  readHideEmptyInboxNames,
  resetInboxNamesSession,
  setInboxNameHidden,
  useInboxNamesPreference,
  visibleInboxNames,
  writeHideEmptyInboxNames,
} from './inboxNamesPreference'

describe('the inbox names preference', () => {
  beforeEach(() => resetInboxNamesSession())

  it('hides and shows names by hand, per account, stored lower-cased and only while any are hidden', () => {
    setInboxNameHidden('QA', 'POS+', true)
    setInboxNameHidden('QA', "MA's", true)
    expect(readHiddenInboxNames('QA')).toEqual(['pos+', "ma's"])
    expect(readHiddenInboxNames('QB')).toEqual([])
    setInboxNameHidden('QA', 'pos+', false)
    setInboxNameHidden('QA', "MA's", false)
    expect(localStorage.getItem(`${HIDDEN_INBOX_NAMES_PREFIX}QA`)).toBeNull()
  })

  it('"hide empty" is off by default', () => {
    expect(readHideEmptyInboxNames('QA')).toBe(false)
    writeHideEmptyInboxNames('QA', true)
    expect(readHideEmptyInboxNames('QA')).toBe(true)
  })

  it('an open mailbox follows changes at once, also with storage blocked', () => {
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    try {
      const { result } = renderHook(() => useInboxNamesPreference('QA'))
      act(() => setInboxNameHidden('QA', 'POS+', true))
      act(() => writeHideEmptyInboxNames('QA', true))
      expect(result.current).toEqual({ hidden: ['pos+'], hideEmpty: true })
    } finally {
      blocked.mockRestore()
    }
  })

  it('lists the names: hidden ones out, empty ones out while that is on, the open one always in', () => {
    const names = ['Simon James', 'POS+', "MA's", 'Qortino AI']
    const empty = (name: string) => name === "MA's" || name === 'Qortino AI'
    expect(visibleInboxNames(names, { hidden: ['pos+'], hideEmpty: false }, empty)).toEqual(['Simon James', "MA's", 'Qortino AI'])
    expect(visibleInboxNames(names, { hidden: ['pos+'], hideEmpty: true }, empty)).toEqual(['Simon James'])
    expect(visibleInboxNames(names, { hidden: ['pos+'], hideEmpty: true }, empty, 'pos+')).toEqual(['Simon James', 'POS+'])
  })
})
