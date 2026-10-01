import { describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { BACK_STATE_KEY, hasSubPaneEntry, usePhoneBackClose } from './usePhoneBackClose'

function Harness({ activeKey, onBack, enabled = true }: { activeKey: string | null; onBack: () => void; enabled?: boolean }) {
  usePhoneBackClose({ enabled, activeKey, onBack })
  return null
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('usePhoneBackClose', () => {
  it('pushes an entry when a sub-pane opens and closes the pane when Back pops it', async () => {
    const onBack = vi.fn()
    const startLength = window.history.length
    const { rerender } = render(<Harness activeKey={null} onBack={onBack} />)
    expect(hasSubPaneEntry(window.history.state)).toBe(false)

    rerender(<Harness activeKey="message" onBack={onBack} />)
    expect(window.history.length).toBe(startLength + 1)
    expect(window.history.state?.[BACK_STATE_KEY]).toBe('message')

    // The user presses Back (GO's hardware button): jsdom fires popstate.
    await act(async () => {
      window.history.back()
      await flush()
    })
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(hasSubPaneEntry(window.history.state)).toBe(false)
  })

  it('pops its own entry when the pane closes from the UI, without calling onBack', async () => {
    const onBack = vi.fn()
    const { rerender } = render(<Harness activeKey="compose" onBack={onBack} />)
    expect(window.history.state?.[BACK_STATE_KEY]).toBe('compose')
    // A different sub-pane replaces the entry rather than stacking another.
    rerender(<Harness activeKey="thread" onBack={onBack} />)
    expect(window.history.state?.[BACK_STATE_KEY]).toBe('thread')

    await act(async () => {
      rerender(<Harness activeKey={null} onBack={onBack} />)
      await flush()
    })
    await waitFor(() => expect(hasSubPaneEntry(window.history.state)).toBe(false))
    expect(onBack).not.toHaveBeenCalled()
  })

  it('does nothing on wider layouts', () => {
    const onBack = vi.fn()
    const startLength = window.history.length
    render(<Harness activeKey="message" onBack={onBack} enabled={false} />)
    expect(window.history.length).toBe(startLength)
    expect(hasSubPaneEntry(window.history.state)).toBe(false)
  })
})
