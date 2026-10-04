import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme'
import { PaneResizer, RESIZE_BIG_STEP, RESIZE_STEP, clampWidth } from './PaneResizer'

function setup(value = 300, min = 260, max = 500) {
  const onChange = vi.fn()
  const onCommit = vi.fn()
  const onReset = vi.fn()
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <PaneResizer
        label="Resize the message list"
        controls="list"
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        onCommit={onCommit}
        onReset={onReset}
      />
    </HubThemeProvider>
  )
  const handle = screen.getByRole('separator', { name: 'Resize the message list' })
  return { handle, onChange, onCommit, onReset }
}

describe('PaneResizer', () => {
  it('is a focusable vertical window splitter with its value and limits', () => {
    const { handle } = setup()
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    expect(handle.getAttribute('aria-valuenow')).toBe('300')
    expect(handle.getAttribute('aria-valuemin')).toBe('260')
    expect(handle.getAttribute('aria-valuemax')).toBe('500')
    expect(handle.getAttribute('aria-controls')).toBe('list')
    expect(handle.tabIndex).toBe(0)
  })

  it('moves with the arrow keys, further with Shift, clamped to its limits', () => {
    const { handle, onCommit } = setup()
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onCommit).toHaveBeenLastCalledWith(300 + RESIZE_STEP)
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    // 300 - 64 is under the minimum.
    expect(300 - RESIZE_BIG_STEP).toBeLessThan(260)
    expect(onCommit).toHaveBeenLastCalledWith(260)
    fireEvent.keyDown(handle, { key: 'End' })
    expect(onCommit).toHaveBeenLastCalledWith(500)
    fireEvent.keyDown(handle, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledTimes(3)
  })

  it('does nothing at a limit', () => {
    const { handle, onCommit } = setup(260)
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('resets with Home or a double-click', () => {
    const { handle, onReset } = setup()
    fireEvent.keyDown(handle, { key: 'Home' })
    fireEvent.doubleClick(handle)
    expect(onReset).toHaveBeenCalledTimes(2)
  })

  it('drags with pointer capture, clamps, blocks text selection, and commits on release', () => {
    const { handle, onChange, onCommit } = setup()
    const capture = vi.fn()
    ;(handle as any).setPointerCapture = capture
    ;(handle as any).hasPointerCapture = () => true
    ;(handle as any).releasePointerCapture = vi.fn()
    fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientX: 400 })
    expect(capture).toHaveBeenCalledWith(7)
    expect(document.body.style.userSelect).toBe('none')
    expect(handle.getAttribute('data-dragging')).toBe('true')
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 450 })
    expect(onChange).toHaveBeenLastCalledWith(350)
    // Another pointer is ignored.
    fireEvent.pointerMove(handle, { pointerId: 8, clientX: 10 })
    expect(onChange).toHaveBeenCalledTimes(1)
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 2000 })
    expect(onChange).toHaveBeenLastCalledWith(500)
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.pointerUp(handle, { pointerId: 7, clientX: 2000 })
    expect(onCommit).toHaveBeenCalledWith(500)
    expect(document.body.style.userSelect).toBe('')
    expect(handle.getAttribute('data-dragging')).toBeNull()
  })

  it('a click without movement saves nothing', () => {
    const { handle, onCommit } = setup()
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 400 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('clampWidth rounds and clamps', () => {
    expect(clampWidth(10, 260, 500)).toBe(260)
    expect(clampWidth(333.4, 260, 500)).toBe(333)
    expect(clampWidth(900, 260, 500)).toBe(500)
  })
})
