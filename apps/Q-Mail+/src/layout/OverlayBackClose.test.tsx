import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom'
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

  it('an overlay that mounts open stays open, and Back still closes it', () => {
    const onClose = vi.fn()
    let back: ReturnType<typeof useNavigate> = () => {}
    function Mounted() {
      back = useNavigate()
      return <OverlayBackClose open onClose={onClose} />
    }
    render(
      // The app's first entry is a POP, as on a real load.
      <MemoryRouter initialEntries={['/']}>
        <Mounted />
      </MemoryRouter>
    )
    expect(onClose).not.toHaveBeenCalled()
    act(() => back(-1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closing it while a page opens over a background location (the drawer\'s Settings) keeps that page', () => {
    // App.tsx renders the mail page at Settings' background location, so the
    // drawer there sees the entry it was opened on, not Settings.
    let open: (value: boolean) => void = () => {}
    let openSettings: () => void = () => {}
    function MailPage() {
      const [drawer, setDrawer] = useState(false)
      const navigate = useNavigate()
      const location = useLocation()
      open = setDrawer
      openSettings = () => {
        navigate('/settings', { state: { backgroundLocation: location } })
        setDrawer(false)
      }
      return <OverlayBackClose open={drawer} onClose={() => setDrawer(false)} />
    }
    function App() {
      const location = useLocation()
      const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
      return (
        <>
          <Routes location={background ?? location}>
            <Route path="/" element={<MailPage />} />
          </Routes>
          {background && <Routes><Route path="/settings" element={<p>Settings</p>} /></Routes>}
        </>
      )
    }
    window.history.replaceState(null, '', '/')
    const { getByText } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    act(() => open(true))
    act(() => openSettings())
    expect(window.location.pathname).toBe('/settings')
    expect(getByText('Settings')).toBeTruthy()
  })

  it('does nothing outside a router', () => {
    expect(() => render(<OverlayBackClose open onClose={() => {}} />)).not.toThrow()
  })
})
