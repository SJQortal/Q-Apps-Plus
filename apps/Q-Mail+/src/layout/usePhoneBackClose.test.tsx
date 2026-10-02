import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { BACK_STATE_KEY, hasSubPaneEntry, subPaneOf, usePhoneBackClose } from './usePhoneBackClose'

function Harness({ activeKey, onBack, enabled = true }: { activeKey: string | null; onBack: () => void; enabled?: boolean }) {
  usePhoneBackClose({ enabled, activeKey, onBack })
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
      <p data-testid="key">{location.key}</p>
      <p data-testid="type">{useNavigationType()}</p>
      {/* GO's hardware Back and the browser's Back both pop the router's history. */}
      <button onClick={() => navigate(-1)}>hardware back</button>
    </>
  )
}

const mount = (ui: React.ReactElement) =>
  render(<MemoryRouter initialEntries={[{ pathname: '/', state: { backgroundLocation: 'x' } }]}>{ui}</MemoryRouter>)
const state = () => JSON.parse(screen.getByTestId('state').textContent || 'null')
const key = () => screen.getByTestId('key').textContent
const type = () => screen.getByTestId('type').textContent
const pressBack = () => act(() => fireEvent.click(screen.getByRole('button', { name: 'hardware back' })))
const historySpy = () => vi.spyOn(window.history, 'back')

describe('usePhoneBackClose', () => {
  it('pushes a router entry when a sub-pane opens and closes the pane when Back pops it', () => {
    const onBack = vi.fn()
    const back = historySpy()
    const { rerender } = mount(<Harness activeKey={null} onBack={onBack} />)
    const base = key()
    expect(hasSubPaneEntry(state())).toBe(false)

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Harness activeKey="message" onBack={onBack} />
      </MemoryRouter>
    )
    expect(state()[BACK_STATE_KEY]).toBe('message')
    // Other router state on the entry (Settings' background location) survives.
    expect(state().backgroundLocation).toBe('x')
    expect(type()).toBe('PUSH')
    expect(key()).not.toBe(base)

    pressBack()
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(type()).toBe('POP')
    expect(hasSubPaneEntry(state())).toBe(false)
    expect(key()).toBe(base)
    // Never window.history: all Hub tabs share it.
    expect(back).not.toHaveBeenCalled()
  })

  it('replaces its entry when the pane closes from the UI, without going back or calling onBack', () => {
    const onBack = vi.fn()
    const back = historySpy()
    const { rerender } = mount(<Harness activeKey="compose" onBack={onBack} />)
    expect(state()[BACK_STATE_KEY]).toBe('compose')
    // A different sub-pane replaces the entry rather than stacking another.
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Harness activeKey="thread" onBack={onBack} />
      </MemoryRouter>
    )
    expect(state()[BACK_STATE_KEY]).toBe('thread')
    expect(type()).toBe('REPLACE')

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Harness activeKey={null} onBack={onBack} />
      </MemoryRouter>
    )
    expect(hasSubPaneEntry(state())).toBe(false)
    expect(state()).toEqual({ backgroundLocation: 'x' })
    expect(type()).toBe('REPLACE')
    expect(onBack).not.toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()

    // A later Back, with no pane open, lands on the first entry and closes nothing.
    pressBack()
    expect(onBack).not.toHaveBeenCalled()
    expect(hasSubPaneEntry(state())).toBe(false)
  })

  it('does nothing on wider layouts', () => {
    const onBack = vi.fn()
    mount(<Harness activeKey="message" onBack={onBack} enabled={false} />)
    expect(hasSubPaneEntry(state())).toBe(false)
    expect(type()).toBe('POP')
    pressBack()
    expect(onBack).not.toHaveBeenCalled()
  })

  it('takes over an open pane when the layout becomes a phone, without closing it', () => {
    const onBack = vi.fn()
    const { rerender } = mount(<Harness activeKey="message" onBack={onBack} enabled={false} />)
    // The window shrank to phone width while a message was open: the hook is
    // enabled on the old (POP) entry, which is not a Back press.
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Harness activeKey="message" onBack={onBack} enabled />
      </MemoryRouter>
    )
    expect(onBack).not.toHaveBeenCalled()
    expect(state()[BACK_STATE_KEY]).toBe('message')
    pressBack()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('reads the sub-pane key from router state', () => {
    expect(subPaneOf({ [BACK_STATE_KEY]: 'message' })).toBe('message')
    expect(subPaneOf({ [BACK_STATE_KEY]: '' })).toBeNull()
    expect(subPaneOf({ other: 1 })).toBeNull()
    expect(subPaneOf(null)).toBeNull()
    expect(subPaneOf('message')).toBeNull()
  })
})
