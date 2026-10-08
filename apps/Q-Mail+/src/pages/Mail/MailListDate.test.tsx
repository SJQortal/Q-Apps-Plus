import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ButtonBase } from '@mui/material'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { MailListDate, TAP_DETAIL_MS } from './MailListDate'
import { mailDateDetail, readerMailDate } from './readerTime'

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime()
const stamp = at(2026, 8, 2, 8, 58, 20)

/** Pretend to be a touch screen (no hover), or a mouse. */
function pretendHover(hover: boolean) {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: query.includes('hover: none') ? !hover : false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as any
  return () => {
    window.matchMedia = original
  }
}

function renderRow(onOpen: () => void) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <ButtonBase onClick={onOpen} aria-label="Open the message">
        <span>Alice</span>
        <MailListDate timestamp={stamp} detailPrefix="Latest: " />
      </ButtonBase>
    </HubThemeProvider>
  )
}

describe('MailListDate', () => {
  let restore: () => void = () => {}
  afterEach(() => {
    restore()
    vi.useRealTimers()
  })

  it('shows the reader\'s date with a machine-readable datetime', () => {
    restore = pretendHover(true)
    renderRow(() => {})
    const time = document.querySelector('time') as HTMLElement
    expect(time.textContent).toBe(readerMailDate(stamp))
    expect(time.getAttribute('datetime')).toBe(new Date(stamp).toISOString())
  })

  it('with a mouse: the detail on hover, and a click on the date opens the row', async () => {
    restore = pretendHover(true)
    const onOpen = vi.fn()
    renderRow(onOpen)
    const time = document.querySelector('time') as HTMLElement
    fireEvent.mouseOver(time)
    expect(await screen.findByRole('tooltip')).toHaveProperty('textContent', `Latest: ${mailDateDetail(stamp)}`)
    fireEvent.click(time)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('on a touch screen: a tap on the date shows the detail for a while and does not open the row', async () => {
    restore = pretendHover(false)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onOpen = vi.fn()
    renderRow(onOpen)
    const time = document.querySelector('time') as HTMLElement
    fireEvent.click(time)
    expect(onOpen).not.toHaveBeenCalled()
    expect(await screen.findByRole('tooltip')).toHaveProperty('textContent', `Latest: ${mailDateDetail(stamp)}`)
    act(() => {
      vi.advanceTimersByTime(TAP_DETAIL_MS + 500)
    })
    await vi.waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    // A tap elsewhere on the row still opens it.
    fireEvent.click(screen.getByText('Alice'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('a second tap closes the detail at once', async () => {
    restore = pretendHover(false)
    renderRow(() => {})
    const time = document.querySelector('time') as HTMLElement
    fireEvent.click(time)
    await screen.findByRole('tooltip')
    fireEvent.click(time)
    await vi.waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })

  it('renders nothing for a missing stamp', () => {
    restore = pretendHover(true)
    const { container } = render(<MailListDate timestamp={undefined} />)
    expect(container.querySelector('time')).toBeNull()
  })
})
