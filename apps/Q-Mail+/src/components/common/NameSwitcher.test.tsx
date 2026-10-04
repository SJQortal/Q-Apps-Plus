import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { qortalCalls, mockQortalAction } from '../../test/setup'
import { resetAvatarCache } from '../../utils/avatarCache'
import {
  NAME_SEARCH_THRESHOLD,
  NameSwitcher,
  NameSwitcherList,
  foldName,
  highlightParts,
  matchCountText,
  orderNames,
} from './NameSwitcher'

const few = ['Zed', 'alice', 'Bob']
/** 20 names: more than the threshold, so the list gets its search field. */
const many = [
  'Zed', 'alice', 'Bob', 'Simon James', 'simple', 'Qortal Seth', 'ändi', 'Ωmega', 'carol', 'dave',
  'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy', 'mallory', 'niaj', 'olivia', 'peggy',
]
/** Exactly the threshold: still no search field. */
const fifteen = many.slice(0, NAME_SEARCH_THRESHOLD)

const wrap = (ui: React.ReactElement) =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  )
const rows = () => screen.getAllByRole('menuitemradio').map((r) => r.getAttribute('aria-label'))
const search = () => screen.getByRole('textbox', { name: 'Find one of your names' }) as HTMLInputElement

beforeEach(() => {
  resetAvatarCache()
  mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
})

describe('orderNames', () => {
  it('puts the active name first, then the rest A to Z ignoring case and accents', () => {
    expect(orderNames(few, 'Bob')).toEqual(['Bob', 'alice', 'Zed'])
    const ordered = orderNames(many, 'peggy')
    expect(ordered[0]).toBe('peggy')
    expect(ordered.slice(1, 4)).toEqual(['alice', 'ändi', 'Bob'])
    expect(ordered).toHaveLength(20)
  })

  it('drops duplicates and blanks, and copes with an active name it does not know', () => {
    expect(orderNames(['b', 'a', '', 'b'], 'zzz')).toEqual(['a', 'b'])
    expect(orderNames(['b', 'a'], null)).toEqual(['a', 'b'])
  })

  it('matches anywhere, ignoring case and accents; starts before contains', () => {
    expect(orderNames(many, 'peggy', 'SIM')).toEqual(['Simon James', 'simple'])
    expect(orderNames(many, 'peggy', 'and')).toEqual(['ändi'])
    expect(orderNames(many, 'peggy', 'james')).toEqual(['Simon James'])
    expect(orderNames(many, 'peggy', 'ΩMEGA')).toEqual(['Ωmega'])
    expect(orderNames(many, 'peggy', 'e')[0]).toBe('erin')
    expect(orderNames(many, 'peggy', 'zzz')).toEqual([])
    // A lone accent is matched as typed, not as an empty query that lists everyone.
    expect(orderNames(many, 'peggy', '^')).toEqual([])
    expect(foldName('Ändi Ç')).toBe('andi c')
  })

  it('counts matches', () => {
    expect(matchCountText(86, 86, '')).toBe('86 names')
    expect(matchCountText(86, 3, 'bio')).toBe('3 of 86 names match.')
    expect(matchCountText(86, 1, 'bio')).toBe('1 of 86 names matches.')
    expect(matchCountText(86, 0, ' x ')).toBe('No name matches “x”.')
  })
})

describe('highlightParts', () => {
  it('marks what the filter matched, accents and case included', () => {
    const marked = (name: string, q: string) =>
      highlightParts(name, q)
        .filter((p) => p.match)
        .map((p) => p.text)
    expect(marked('José', 'jose')).toEqual(['José'])
    expect(marked('Ändi and ANDY', 'and')).toEqual(['Änd', 'and', 'AND'])
    expect(highlightParts('Simon', '').map((p) => p.text)).toEqual(['Simon'])
  })
})

describe('NameSwitcherList', () => {
  it('has no search field up to the threshold, sorts, and picks on a click', () => {
    const onPick = vi.fn()
    wrap(<NameSwitcherList names={fifteen} activeName="Bob" onPick={onPick} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(rows()[0]).toBe('Bob')
    expect(rows().slice(1, 3)).toEqual(['alice', 'ändi'])
    expect(screen.getByRole('menuitemradio', { name: 'Bob' }).getAttribute('aria-checked')).toBe('true')
    // Every row has its avatar, and the row's text is just the name.
    for (const row of screen.getAllByRole('menuitemradio')) {
      expect(row.querySelector('.MuiAvatar-root')).toBeTruthy()
      expect(row.textContent).toBe(row.getAttribute('aria-label'))
    }
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'alice' }))
    expect(onPick).toHaveBeenCalledWith('alice')
  })

  it('filters more than 15 names as you type, with a count, and says when nothing matches', () => {
    wrap(<NameSwitcherList names={many} activeName="peggy" onPick={() => {}} />)
    expect(search().placeholder).toBe('Find one of your 20 names')
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('20 names')
    fireEvent.change(search(), { target: { value: 'SIM' } })
    expect(rows()).toEqual(['Simon James', 'simple'])
    expect(status.textContent).toBe('2 of 20 names match.')
    expect(within(screen.getByRole('menuitemradio', { name: 'Simon James' })).getByText('Sim')).toBeTruthy()
    fireEvent.change(search(), { target: { value: 'andi' } })
    expect(rows()).toEqual(['ändi'])
    fireEvent.change(search(), { target: { value: 'nobody here' } })
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0)
    expect(status.textContent).toBe('No name matches “nobody here”.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(search().value).toBe('')
    expect(rows()).toHaveLength(20)
  })

  it('works from the keyboard: Enter picks the first match, arrows move between field and list', () => {
    const onPick = vi.fn()
    wrap(<NameSwitcherList names={many} activeName="peggy" onPick={onPick} autoFocus />)
    expect(document.activeElement).toBe(search())
    fireEvent.change(search(), { target: { value: 'qort' } })
    fireEvent.keyDown(search(), { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('Qortal Seth')

    fireEvent.change(search(), { target: { value: '' } })
    fireEvent.keyDown(search(), { key: 'ArrowDown' })
    const peggy = screen.getByRole('menuitemradio', { name: 'peggy' })
    expect(document.activeElement).toBe(peggy)
    fireEvent.keyDown(peggy, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'alice' }))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search())
  })

  it('types from a row into the search field (type-to-filter)', () => {
    wrap(<NameSwitcherList names={many} activeName="peggy" onPick={() => {}} />)
    const peggy = screen.getByRole('menuitemradio', { name: 'peggy' })
    peggy.focus()
    fireEvent.keyDown(peggy, { key: 'j' })
    expect(search().value).toBe('j')
    expect(document.activeElement).toBe(search())
    expect(rows()).toEqual(['judy', 'niaj', 'Simon James'])
  })

  it('leaves Enter to an input method that is composing', () => {
    const onPick = vi.fn()
    wrap(<NameSwitcherList names={many} activeName="peggy" onPick={onPick} />)
    fireEvent.change(search(), { target: { value: 'sim' } })
    fireEvent.keyDown(search(), { key: 'Enter', isComposing: true })
    fireEvent.keyDown(search(), { key: 'Enter', keyCode: 229 })
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.keyDown(search(), { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('Simon James')
  })

  it('keeps its order while the active name changes under it', () => {
    function Picking() {
      const [active, setActive] = useState('peggy')
      return <NameSwitcherList names={many} activeName={active} onPick={setActive} />
    }
    wrap(<Picking />)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Zed' }))
    expect(rows()[0]).toBe('peggy')
    expect(screen.getByRole('menuitemradio', { name: 'Zed' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('NameSwitcher lazy avatars', () => {
  let intersect: ((entries: { isIntersecting: boolean }[]) => void)[] = []
  const original = (globalThis as any).IntersectionObserver
  beforeEach(() => {
    intersect = []
    ;(globalThis as any).IntersectionObserver = class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        intersect.push(cb)
      }
      observe() {}
      disconnect() {}
    }
  })
  afterEach(() => {
    ;(globalThis as any).IntersectionObserver = original
  })

  it('asks for an avatar only once its row is in view', async () => {
    wrap(<NameSwitcherList names={many} activeName="peggy" onPick={() => {}} />)
    await act(async () => {})
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(0)
    await act(async () => {
      intersect[0]([{ isIntersecting: true }])
    })
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1)
  })
})

describe('NameSwitcher (the dropdown)', () => {
  it('shows the active name, opens the list, picks and closes', async () => {
    const onPick = vi.fn()
    wrap(<NameSwitcher names={many} activeName="peggy" onPick={onPick} />)
    const button = screen.getByRole('button', { name: 'Active mailbox: peggy. Change' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const dialog = screen.getByRole('dialog', { name: 'Switch active mailbox' })
    expect(document.activeElement).toBe(search())
    fireEvent.change(search(), { target: { value: 'grac' } })
    fireEvent.click(within(dialog).getByRole('menuitemradio', { name: 'grace' }))
    expect(onPick).toHaveBeenCalledWith('grace')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not call onPick for the name already active', () => {
    const onPick = vi.fn()
    wrap(<NameSwitcher names={few} activeName="Bob" onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /Active mailbox/ }))
    expect(screen.queryByRole('textbox')).toBeNull()
    // Without a search field the checked row takes focus.
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Bob' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bob' }))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('opens a full-screen sheet on phones, without focusing the search field', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    try {
      const onPick = vi.fn()
      wrap(<NameSwitcher names={many} activeName="peggy" onPick={onPick} />)
      fireEvent.click(screen.getByRole('button', { name: /Active mailbox/ }))
      const dialog = screen.getByRole('dialog', { name: 'Switch active mailbox' })
      expect(dialog.className).toContain('MuiDialog-paperFullScreen')
      expect(document.activeElement).not.toBe(search())
      fireEvent.click(within(dialog).getByRole('menuitemradio', { name: 'olivia' }))
      expect(onPick).toHaveBeenCalledWith('olivia')
    } finally {
      window.matchMedia = original
    }
  })

  it('opens a full-screen sheet, not a popover, in a landscape frame (703×201 in Hub)', () => {
    const original = window.matchMedia
    // Medium layout (neither phone nor desktop width), but a short, wide frame.
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-height: 500px'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    try {
      const onPick = vi.fn()
      wrap(<NameSwitcher names={many} activeName="peggy" onPick={onPick} />)
      fireEvent.click(screen.getByRole('button', { name: /Active mailbox/ }))
      const dialog = screen.getByRole('dialog', { name: 'Switch active mailbox' })
      expect(dialog.className).toContain('MuiDialog-paperFullScreen')
      expect(document.querySelector('.MuiPopover-paper')).toBeNull()
      // The count stays a live region for screen readers, out of the short frame's way.
      expect(getComputedStyle(screen.getByRole('status')).position).toBe('absolute')
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy()
      fireEvent.change(search(), { target: { value: 'oliv' } })
      fireEvent.click(within(dialog).getByRole('menuitemradio', { name: 'olivia' }))
      expect(onPick).toHaveBeenCalledWith('olivia')
    } finally {
      window.matchMedia = original
    }
  })
})
