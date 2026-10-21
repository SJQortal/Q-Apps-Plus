import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { registerBackLayer, resetBackLayers } from './backStack'
import { SWIPE_HOLD_MS, SWIPE_TRIGGER_PX, SwipeBack, swipeBlockedAt } from './SwipeBack'

const at = (x: number, y = 300) => ({ touches: [{ clientX: x, clientY: y }] })

/** Start at x0, move through each x, lift. */
function swipe(target: Element, xs: number[], ys: number[] = xs.map(() => 300)) {
  fireEvent.touchStart(target, at(xs[0], ys[0]))
  for (let i = 1; i < xs.length; i++) fireEvent.touchMove(target, at(xs[i], ys[i]))
  fireEvent.touchEnd(target, { touches: [] })
}

afterEach(() => {
  resetBackLayers()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('SwipeBack', () => {
  it('a swipe right closes the top layer only', () => {
    const under = vi.fn()
    const top = vi.fn()
    registerBackLayer(under)
    registerBackLayer(top)
    const { container } = render(<div><SwipeBack /><p>page</p></div>)
    swipe(container, [40, 60, 90, 140])
    expect(top).toHaveBeenCalledTimes(1)
    expect(under).not.toHaveBeenCalled()
  })

  it('a short swipe does not close, and the arrow hides again', () => {
    const close = vi.fn()
    registerBackLayer(close)
    const { container } = render(<SwipeBack />)
    swipe(container, [40, 60, 40 + SWIPE_TRIGGER_PX - 10])
    expect(close).not.toHaveBeenCalled()
    const arrow = document.querySelector('[data-swipe-back-arrow]') as HTMLElement
    expect(arrow.style.visibility).toBe('hidden')
  })

  it('shows the arrow while pulling, filled once letting go would close', () => {
    registerBackLayer(() => {})
    const { container } = render(<SwipeBack />)
    fireEvent.touchStart(container, at(40))
    fireEvent.touchMove(container, at(60))
    const arrow = document.querySelector('[data-swipe-back-arrow]') as HTMLElement
    expect(arrow.style.visibility).toBe('visible')
    expect(arrow.dataset.armed).toBe('false')
    fireEvent.touchMove(container, at(40 + SWIPE_TRIGGER_PX + 5))
    expect(arrow.dataset.armed).toBe('true')
  })

  it('leaves vertical scrolling, a swipe the wrong way and an empty stack alone', () => {
    const { container } = render(<SwipeBack />)
    // Nothing open: nothing to close, and no error.
    swipe(container, [40, 80, 200])
    const close = vi.fn()
    registerBackLayer(close)
    swipe(container, [100, 110, 130], [100, 160, 300])
    swipe(container, [300, 280, 150])
    expect(close).not.toHaveBeenCalled()
  })

  it('the mailboxes drawer closes with a swipe left', () => {
    const close = vi.fn()
    registerBackLayer(close, { overlay: true, direction: 'left' })
    const modal = document.createElement('div')
    modal.className = 'MuiModal-root'
    document.body.appendChild(modal)
    render(<SwipeBack />)
    swipe(modal, [300, 280, 150])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does nothing while a dialog that is not registered (a confirmation) is open', () => {
    const close = vi.fn()
    registerBackLayer(close)
    const modal = document.createElement('div')
    modal.className = 'MuiModal-root'
    document.body.appendChild(modal)
    render(<SwipeBack />)
    swipe(modal, [40, 80, 200])
    expect(close).not.toHaveBeenCalled()
  })

  it('a press held before moving is a long press or a selection, not a swipe', () => {
    vi.useFakeTimers({ toFake: ['performance'] })
    const close = vi.fn()
    registerBackLayer(close)
    const { container } = render(<SwipeBack />)
    fireEvent.touchStart(container, at(40))
    vi.advanceTimersByTime(SWIPE_HOLD_MS + 50)
    fireEvent.touchMove(container, at(80))
    fireEvent.touchMove(container, at(200))
    fireEvent.touchEnd(container, { touches: [] })
    expect(close).not.toHaveBeenCalled()
  })

  it('a swipe in something that scrolls sideways scrolls it instead, until its start', () => {
    const strip = document.createElement('div')
    strip.style.overflowX = 'auto'
    Object.defineProperty(strip, 'scrollWidth', { value: 600 })
    Object.defineProperty(strip, 'clientWidth', { value: 300 })
    const tile = document.createElement('span')
    strip.appendChild(tile)
    document.body.appendChild(strip)
    strip.scrollLeft = 120
    expect(swipeBlockedAt(tile, 'right')).toBe(true)
    strip.scrollLeft = 0
    expect(swipeBlockedAt(tile, 'right')).toBe(false)
    expect(swipeBlockedAt(tile, 'left')).toBe(true)
    const zoomed = document.createElement('div')
    zoomed.setAttribute('data-no-swipe-back', '')
    document.body.appendChild(zoomed)
    expect(swipeBlockedAt(zoomed, 'right')).toBe(true)
  })
})
