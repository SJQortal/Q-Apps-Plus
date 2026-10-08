import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, renderHook } from '@testing-library/react'
import {
  SHORTCUT_HELP,
  SHORTCUTS_MIN_WIDTH,
  TOUCH_ONLY_QUERY,
  isTypingTarget,
  resolveShortcut,
  shortcutsAvailableFor,
  useKeyboardShortcuts,
  useShortcutsAvailable,
  type ShortcutHandlers,
} from './useKeyboardShortcuts'

describe('resolveShortcut', () => {
  it('maps single keys and the g-sequences, and lists every action in the help', () => {
    expect(resolveShortcut({ key: 'c' }, null)).toEqual({ action: 'compose', pending: null })
    expect(resolveShortcut({ key: 'Enter' }, null)).toEqual({ action: 'open', pending: null })
    expect(resolveShortcut({ key: 'Escape' }, null)).toEqual({ action: 'close', pending: null })
    expect(resolveShortcut({ key: '/' }, null)).toEqual({ action: 'focusSearch', pending: null })
    expect(resolveShortcut({ key: '?', shiftKey: true }, null)).toEqual({ action: 'showHelp', pending: null })
    expect(resolveShortcut({ key: 'g' }, null)).toEqual({ action: null, pending: 'g' })
    expect(resolveShortcut({ key: 'i' }, 'g')).toEqual({ action: 'goInbox', pending: null })
    expect(resolveShortcut({ key: 't' }, 'g')).toEqual({ action: 'goThreads', pending: null })
    // "a" alone is reply all; after g it is aliases.
    expect(resolveShortcut({ key: 'a' }, null).action).toBe('replyAll')
    expect(resolveShortcut({ key: 'a' }, 'g').action).toBe('goAliases')
    const actions = new Set(SHORTCUT_HELP.map((entry) => entry.action))
    expect(actions.size).toBe(17)
    // The row menu is the browser's own key: listed, not handled here.
    expect(resolveShortcut({ key: 'F10', shiftKey: true }, null).action).toBeNull()
  })

  it('leaves browser and Hub shortcuts alone when a modifier is held', () => {
    expect(resolveShortcut({ key: 'c', ctrlKey: true }, null).action).toBeNull()
    expect(resolveShortcut({ key: 'f', metaKey: true }, null).action).toBeNull()
    expect(resolveShortcut({ key: 'E', shiftKey: true }, null).action).toBeNull()
    expect(resolveShortcut({ key: 'i', altKey: true }, 'g')).toEqual({ action: null, pending: null })
  })
})

describe('isTypingTarget', () => {
  it('is true for fields, contenteditable and the Quill editor', () => {
    const input = document.createElement('input')
    expect(isTypingTarget(input)).toBe(true)
    const editor = document.createElement('div')
    editor.className = 'ql-editor'
    const span = document.createElement('span')
    editor.appendChild(span)
    document.body.appendChild(editor)
    expect(isTypingTarget(span)).toBe(true)
    const plain = document.createElement('div')
    expect(isTypingTarget(plain)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
    editor.remove()
  })
})

function Harness({ handlers, enabled = true }: { handlers: ShortcutHandlers; enabled?: boolean }) {
  useKeyboardShortcuts(handlers, { enabled })
  return (
    <div>
      <input aria-label="Search inbox messages..." />
      <div className="ql-editor" tabIndex={0}>
        editor
      </div>
    </div>
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useKeyboardShortcuts', () => {
  it('runs handlers for keys pressed outside fields, and ignores keys typed in a field or the editor', () => {
    const compose = vi.fn()
    const focusSearch = vi.fn()
    const { container } = render(<Harness handlers={{ compose, focusSearch }} />)
    fireEvent.keyDown(window, { key: 'c' })
    expect(compose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(container.querySelector('input')!, { key: 'c' })
    fireEvent.keyDown(container.querySelector('.ql-editor')!, { key: '/' })
    expect(compose).toHaveBeenCalledTimes(1)
    expect(focusSearch).not.toHaveBeenCalled()
  })

  it('handles the g-sequence within the timeout and forgets it afterwards', () => {
    vi.useFakeTimers()
    const goSent = vi.fn()
    const replyAll = vi.fn()
    render(<Harness handlers={{ goSent, replyAll }} />)
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 's' })
    expect(goSent).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'g' })
    vi.advanceTimersByTime(1500)
    fireEvent.keyDown(window, { key: 'a' })
    // The prefix expired, so "a" is reply all, not "go to aliases".
    expect(replyAll).toHaveBeenCalledTimes(1)
  })

  it('does nothing while a dialog is open or when disabled (phone width or touch-only)', () => {
    const compose = vi.fn()
    const { unmount } = render(<Harness handlers={{ compose }} />)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    fireEvent.keyDown(window, { key: 'c' })
    expect(compose).not.toHaveBeenCalled()
    dialog.remove()
    unmount()
    render(<Harness handlers={{ compose }} enabled={false} />)
    fireEvent.keyDown(window, { key: 'c' })
    expect(compose).not.toHaveBeenCalled()
  })

  it('leaves Enter on a focused button to the browser, but letter shortcuts still work there', () => {
    const open = vi.fn()
    const next = vi.fn()
    const click = vi.fn()
    render(
      <>
        <Harness handlers={{ open, next }} />
        <button type="button" onClick={click}>
          Row
        </button>
      </>
    )
    const button = document.querySelector('button')!
    button.focus()
    // fireEvent returns false when the event was default-prevented.
    expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true)
    expect(open).not.toHaveBeenCalled()
    fireEvent.keyDown(button, { key: 'j' })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('does not swallow a key when the handler did nothing', () => {
    const open = vi.fn(() => false)
    const compose = vi.fn()
    render(<Harness handlers={{ open, compose }} />)
    expect(fireEvent.keyDown(window, { key: 'o' })).toBe(true)
    expect(open).toHaveBeenCalledTimes(1)
    expect(fireEvent.keyDown(window, { key: 'c' })).toBe(false)
  })
})

describe('shortcuts availability', () => {
  const originalMatchMedia = window.matchMedia

  function mockMedia(width: number, touchOnly: boolean) {
    window.matchMedia = ((query: string) => {
      const min = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query)
      const matches = min ? width >= Number(min[1]) : query === TOUCH_ONLY_QUERY ? touchOnly : false
      return {
        matches,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }
    }) as typeof window.matchMedia
  }

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('needs at least 600 px and a device that is not touch-only', () => {
    expect(SHORTCUTS_MIN_WIDTH).toBe(600)
    expect(shortcutsAvailableFor({ wideEnough: true, touchOnly: false })).toBe(true)
    expect(shortcutsAvailableFor({ wideEnough: false, touchOnly: false })).toBe(false)
    expect(shortcutsAvailableFor({ wideEnough: true, touchOnly: true })).toBe(false)
  })

  it('is on in the medium layout (Hub 600–899 px) and on desktop, off on phones and touch-only screens', () => {
    const cases: Array<[number, boolean, boolean]> = [
      [1440, false, true],
      [700, false, true],
      [600, false, true],
      [599, false, false],
      [390, false, false],
      [1024, true, false],
    ]
    for (const [width, touchOnly, expected] of cases) {
      mockMedia(width, touchOnly)
      const { result, unmount } = renderHook(() => useShortcutsAvailable())
      expect([width, touchOnly, result.current]).toEqual([width, touchOnly, expected])
      unmount()
    }
  })
})
