import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  PANE_LIMITS,
  clampListWidth,
  clampRailWidth,
  listWidthBounds,
  paneWidthsKey,
  readPaneWidths,
  usePaneWidths,
  writePaneWidths,
} from './usePaneWidths'

describe('pane width limits', () => {
  it('keeps the rail between 180 and 360 px', () => {
    expect(clampRailWidth(100)).toBe(180)
    expect(clampRailWidth(250.4)).toBe(250)
    expect(clampRailWidth(900)).toBe(360)
  })

  it('keeps the list at 260 px or more, at most 60 % of the main area, and leaves the reading pane 360 px', () => {
    // 1200 px main area: 60 % = 720, and 1200 - 360 = 840, so 720.
    expect(listWidthBounds(1200)).toEqual({ min: 260, max: 720 })
    expect(clampListWidth(1000, 1200)).toBe(720)
    expect(clampListWidth(100, 1200)).toBe(260)
    // 800 px: 60 % = 480, 800 - 360 = 440, so the reading minimum wins.
    expect(listWidthBounds(800).max).toBe(440)
    // Too narrow for both minimums: the list keeps its own.
    expect(listWidthBounds(500)).toEqual({ min: 260, max: 260 })
    // Not measured yet: a generous bound, never below the minimum.
    expect(listWidthBounds(null).min).toBe(PANE_LIMITS.listMin)
    expect(listWidthBounds(null).max).toBeGreaterThan(PANE_LIMITS.listMin)
  })
})

describe('saved pane widths', () => {
  it('saves per account under qmail_pane_widths_<address> and reads them back', () => {
    writePaneWidths('QAlice', { rail: 300, list: 420 })
    expect(JSON.parse(window.localStorage.getItem('qmail_pane_widths_QAlice') || '{}')).toEqual({ rail: 300, list: 420 })
    expect(paneWidthsKey('QAlice')).toBe('qmail_pane_widths_QAlice')
    expect(readPaneWidths('QAlice')).toEqual({ rail: 300, list: 420 })
    expect(readPaneWidths('QBob')).toEqual({})
  })

  it('ignores junk and clamps what it reads', () => {
    window.localStorage.setItem(paneWidthsKey('QAlice'), '{not json')
    expect(readPaneWidths('QAlice')).toEqual({})
    window.localStorage.setItem(paneWidthsKey('QAlice'), JSON.stringify({ rail: 9999, list: 'wide' }))
    expect(readPaneWidths('QAlice')).toEqual({ rail: 360 })
    window.localStorage.setItem(paneWidthsKey('QAlice'), JSON.stringify({ list: 10 }))
    expect(readPaneWidths('QAlice')).toEqual({ list: 260 })
  })

  it('without an address nothing is read or written', () => {
    writePaneWidths('', { rail: 300 })
    expect(window.localStorage.length).toBe(0)
    expect(readPaneWidths('')).toEqual({})
  })
})

describe('usePaneWidths', () => {
  it('previews without saving, commits and resets with saving, and restores per account', () => {
    const { result, rerender } = renderHook(({ address }) => usePaneWidths(address), {
      initialProps: { address: 'QAlice' },
    })
    expect(result.current.widths).toEqual({})

    act(() => result.current.preview('list', 410.6))
    expect(result.current.widths.list).toBe(411)
    expect(window.localStorage.getItem(paneWidthsKey('QAlice'))).toBeNull()

    act(() => result.current.commit('list', 430))
    act(() => result.current.commit('rail', 300))
    expect(readPaneWidths('QAlice')).toEqual({ list: 430, rail: 300 })

    // Another account starts from its own (no) widths, and back again.
    rerender({ address: 'QBob' })
    expect(result.current.widths).toEqual({})
    rerender({ address: 'QAlice' })
    expect(result.current.widths).toEqual({ list: 430, rail: 300 })

    act(() => result.current.reset('list'))
    expect(result.current.widths).toEqual({ rail: 300 })
    expect(readPaneWidths('QAlice')).toEqual({ rail: 300 })
    act(() => result.current.reset('rail'))
    expect(window.localStorage.getItem(paneWidthsKey('QAlice'))).toBeNull()
  })
})
