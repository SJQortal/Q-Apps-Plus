import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { OVERLAY_STATE_KEY, OverlayBackClose } from './OverlayBackClose'
import { BACK_STATE_KEY } from './usePhoneBackClose'

let navigateFn: ReturnType<typeof useNavigate> = () => {}
let lastState: unknown = null
let setOpenFn: (open: boolean) => void = () => {}

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  setOpenFn = setOpen
  navigateFn = useNavigate()
  lastState = useLocation().state
  return (
    <OverlayBackClose
      open={open}
      onClose={() => {
        setOpen(false)
        onClose()
      }}
    />
  )
}

const renderAt = (state: unknown, onClose = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/', state } as any]}>
      <Harness onClose={onClose} />
    </MemoryRouter>
  )
  return onClose
}

describe('OverlayBackClose', () => {
  it('Back closes the overlay and leaves the pane under it (the composer) open', () => {
    const onClose = renderAt({ [BACK_STATE_KEY]: 'compose' })
    act(() => setOpenFn(true))
    expect((lastState as any)[OVERLAY_STATE_KEY]).toBeTruthy()
    expect((lastState as any)[BACK_STATE_KEY]).toBe('compose')
    act(() => navigateFn(-1))
    expect(onClose).toHaveBeenCalledTimes(1)
    // Back landed on the composer's own entry.
    expect((lastState as any)[BACK_STATE_KEY]).toBe('compose')
    expect((lastState as any)[OVERLAY_STATE_KEY]).toBeUndefined()
  })

  it('closed from the UI, its entry loses the overlay id (no history.back)', () => {
    const onClose = renderAt(null)
    act(() => setOpenFn(true))
    act(() => setOpenFn(false))
    expect(onClose).not.toHaveBeenCalled()
    expect(lastState === null || (lastState as any)[OVERLAY_STATE_KEY] === undefined).toBe(true)
  })

  it('does nothing outside a router', () => {
    expect(() => render(<OverlayBackClose open onClose={() => {}} />)).not.toThrow()
  })
})
