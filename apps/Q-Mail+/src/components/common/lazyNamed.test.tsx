import { describe, expect, it, vi } from 'vitest'
import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { lazyNamed, preloadOnIdle } from './lazyNamed'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('lazyNamed', () => {
  it('renders a named export through React.lazy', async () => {
    const Hello = () => <p>hello from the chunk</p>
    const loader = vi.fn(async () => ({ Hello }))
    const Lazy = lazyNamed(loader, 'Hello')
    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy />
      </Suspense>
    )
    expect(screen.getByText('loading')).toBeTruthy()
    expect(await screen.findByText('hello from the chunk')).toBeTruthy()
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('preloadOnIdle', () => {
  it('runs the loaders in order once the browser is idle', async () => {
    vi.useFakeTimers()
    const order: string[] = []
    const a = vi.fn(async () => {
      order.push('a')
    })
    const b = vi.fn(async () => {
      order.push('b')
    })
    preloadOnIdle([a, b], 100)
    expect(a).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(0)
    vi.useRealTimers()
    await flush()
    expect(order).toEqual(['a', 'b'])
  })

  it('does nothing after cancel, and swallows a failed preload', async () => {
    vi.useFakeTimers()
    const a = vi.fn(async () => {})
    const handle = preloadOnIdle([a], 100)
    handle.cancel()
    await vi.advanceTimersByTimeAsync(200)
    expect(a).not.toHaveBeenCalled()

    const failing = vi.fn(async () => {
      throw new Error('offline')
    })
    const after = vi.fn(async () => {})
    preloadOnIdle([failing, after], 100)
    await vi.advanceTimersByTimeAsync(100)
    vi.useRealTimers()
    await flush()
    expect(failing).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)
  })
})
