import { describe, expect, it } from 'vitest'
import { HEADER_SETTLE_MS, PANE_HEADER_HEIGHT as H, nextHiddenOnScroll } from './PaneHeader'

const at = (top: number, max: number, time = 1000) => ({ top, max, at: time })

describe('nextHiddenOnScroll (the header that hides on scroll)', () => {
  it('hides on scroll down and shows on scroll up, with room to scroll', () => {
    expect(nextHiddenOnScroll(false, at(100, 600), at(140, 600), 0)).toBe(true)
    expect(nextHiddenOnScroll(true, at(140, 544), at(110, 544), 0)).toBe(false)
  })

  it('keeps its header on a page with little to scroll (hiding would only pull the content back)', () => {
    expect(nextHiddenOnScroll(false, at(40, 3 * H - 1), at(70, 3 * H - 1), 0)).toBe(false)
  })

  it('a scroller that grew and pulled the content back to its end is not a scroll up', () => {
    // Hidden at 200 of 205; the header (and GO's bar) gave their height: the end is now at 104.
    expect(nextHiddenOnScroll(true, at(200, 205, 2000), at(104, 104, 2400), 2300)).toBe(true)
    // The same jump with the end where it was is a real scroll up.
    expect(nextHiddenOnScroll(true, at(200, 205, 2000), at(104, 205, 2400), 2300)).toBe(false)
  })

  it('ignores scrolling while the header slides', () => {
    const settleUntil = 1000 + HEADER_SETTLE_MS
    expect(nextHiddenOnScroll(true, at(300, 600, 1000), at(250, 600, 1100), settleUntil)).toBe(true)
    expect(nextHiddenOnScroll(true, at(300, 600, 1000), at(250, 600, settleUntil + 1), settleUntil)).toBe(false)
  })

  it('always shows at the very top', () => {
    expect(nextHiddenOnScroll(true, at(10, 0), at(0, 0), Infinity)).toBe(false)
  })
})
