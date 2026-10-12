import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { nextDelay, usePolling } from './usePolling'

function Poller({ task, interval = 1000, enabled = true }: { task: () => any; interval?: number; enabled?: boolean }) {
  usePolling(task, { intervalMs: interval, enabled, jitter: 0 })
  return null
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('nextDelay', () => {
  it('doubles per failure up to the maximum and adds jitter', () => {
    expect(nextDelay(1000, 0, 8000, 0)).toBe(1000)
    expect(nextDelay(1000, 1, 8000, 0)).toBe(2000)
    expect(nextDelay(1000, 3, 8000, 0)).toBe(8000)
    expect(nextDelay(1000, 9, 8000, 0)).toBe(8000)
    expect(nextDelay(1000, 0, 8000, 0.5, 1)).toBe(1500)
  })
})

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs on the interval while visible and stops on unmount', async () => {
    const task = vi.fn(async () => true)
    const { unmount } = render(<Poller task={task} />)
    expect(task).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(task).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(task).toHaveBeenCalledTimes(2)
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('pauses while the tab is hidden and catches up when it is visible again', async () => {
    const task = vi.fn(async () => true)
    render(<Poller task={task} />)
    setVisibility('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(task).not.toHaveBeenCalled()
    await act(async () => {
      setVisibility('visible')
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('backs off after failures and recovers after a success', async () => {
    let fail = true
    const task = vi.fn(async () => {
      if (fail) throw new Error('boom')
      return true
    })
    render(<Poller task={task} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000) // 1st run fails → next in 2000
    })
    expect(task).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(task).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000) // 2nd run fails → next in 4000
    })
    expect(task).toHaveBeenCalledTimes(2)
    fail = false
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000) // 3rd run succeeds → back to 1000
    })
    expect(task).toHaveBeenCalledTimes(3)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(task).toHaveBeenCalledTimes(4)
  })

  it('does nothing when disabled', async () => {
    const task = vi.fn()
    render(<Poller task={task} enabled={false} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(task).not.toHaveBeenCalled()
  })
})
