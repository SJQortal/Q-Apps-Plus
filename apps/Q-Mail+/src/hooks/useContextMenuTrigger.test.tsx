import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { LONG_PRESS_MS, useContextMenuTrigger, type MenuPoint } from './useContextMenuTrigger'

function Row({ onOpen, onClick, portal }: { onOpen: (point: MenuPoint) => void; onClick: () => void; portal?: boolean }) {
  const trigger = useContextMenuTrigger(onOpen)
  return (
    <div data-testid="row" {...trigger}>
      <button type="button" onClick={onClick}>
        Alice, Lunch
      </button>
      {portal && createPortal(<button type="button">In the menu</button>, document.body)}
    </div>
  )
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] })

describe('useContextMenuTrigger', () => {
  afterEach(() => vi.useRealTimers())

  it('a right click opens at the pointer, and the app-wide Copy menu does not see it', () => {
    const onOpen = vi.fn()
    const documentListener = vi.fn()
    document.addEventListener('contextmenu', documentListener)
    render(<Row onOpen={onOpen} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Alice, Lunch' })
    vi.spyOn(screen.getByTestId('row'), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 400, bottom: 64, width: 400, height: 64 } as DOMRect)
    fireEvent.contextMenu(button, { clientX: 120, clientY: 30 })
    expect(onOpen).toHaveBeenCalledWith({ top: 30, left: 120 })
    expect(documentListener).not.toHaveBeenCalled()
    document.removeEventListener('contextmenu', documentListener)
  })

  it('the menu key (no pointer) opens it at the row', () => {
    const onOpen = vi.fn()
    render(<Row onOpen={onOpen} onClick={() => {}} />)
    vi.spyOn(screen.getByTestId('row'), 'getBoundingClientRect').mockReturnValue({ left: 10, top: 200, right: 410, bottom: 264, width: 400, height: 64 } as DOMRect)
    fireEvent.contextMenu(screen.getByRole('button'), { clientX: 0, clientY: 0 })
    expect(onOpen).toHaveBeenCalledWith({ top: 240, left: 26 })
  })

  it('a long press opens at the finger, and its tap does not open the row', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    const onClick = vi.fn()
    render(<Row onOpen={onOpen} onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Alice, Lunch' })
    fireEvent.touchStart(button, touch(50, 20))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1))
    expect(onOpen).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onOpen).toHaveBeenCalledWith({ top: 20, left: 50 })
    fireEvent.touchEnd(button)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    // The next tap is a tap again.
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.touchStart(button, touch(50, 20))
    fireEvent.touchEnd(button)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('a short tap or a scroll opens nothing', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<Row onOpen={onOpen} onClick={() => {}} />)
    const button = screen.getByRole('button')
    fireEvent.touchStart(button, touch(50, 20))
    act(() => vi.advanceTimersByTime(200))
    fireEvent.touchEnd(button)
    fireEvent.touchStart(button, touch(50, 20))
    fireEvent.touchMove(button, touch(50, 60))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Android: its own contextmenu during a long press opens the menu once', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<Row onOpen={onOpen} onClick={() => {}} />)
    const button = screen.getByRole('button')
    // Android's contextmenu first, then our timer would fire.
    fireEvent.touchStart(button, touch(50, 20))
    act(() => vi.advanceTimersByTime(400))
    fireEvent.contextMenu(button, { clientX: 50, clientY: 20 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onOpen).toHaveBeenCalledTimes(1)
    fireEvent.touchEnd(button)
    // Our timer first, then Android's contextmenu for the same press.
    fireEvent.touchStart(button, touch(50, 20))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    fireEvent.contextMenu(button, { clientX: 50, clientY: 20 })
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('leaves events from the open menu (a portal) alone', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<Row onOpen={onOpen} onClick={() => {}} portal />)
    const inMenu = screen.getByRole('button', { name: 'In the menu' })
    fireEvent.touchStart(inMenu, touch(5, 5))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2))
    fireEvent.contextMenu(inMenu)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
