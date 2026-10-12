import { describe, expect, it } from 'vitest'
import { applySmartDark, shouldDarkenPaper, shouldDarkenPicture, toneStats } from './pdfSmartDark'

function page(width: number, height: number, fill: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = 255
  }
  return data
}

describe('pdfSmartDark', () => {
  it('judges white paper as light and a photo as mid-tone', () => {
    const paper = toneStats(page(12, 12, [255, 255, 255]), 12, { x0: 0, y0: 0, x1: 12, y1: 12 })
    expect(paper.light).toBe(1)
    expect(shouldDarkenPaper(paper)).toBe(true)
    const photo = toneStats(page(12, 12, [120, 90, 60]), 12, { x0: 0, y0: 0, x1: 12, y1: 12 })
    expect(photo.mid).toBe(1)
    expect(shouldDarkenPicture(photo)).toBe(false)
    expect(shouldDarkenPaper(photo)).toBe(false)
  })

  it('turns a white page with black ink dark, keeping the ink light', () => {
    const w = 12
    const data = page(w, w, [255, 255, 255])
    data[0] = 0
    data[1] = 0
    data[2] = 0 // one black pixel of ink
    applySmartDark(data, w, w, [])
    expect(data[4]).toBeLessThan(40) // paper went dark
    expect(data[0]).toBeGreaterThan(200) // ink went light
  })

  it('leaves a page that is already dark alone', () => {
    const w = 12
    const data = page(w, w, [10, 10, 10])
    applySmartDark(data, w, w, [])
    expect(data[0]).toBe(10)
  })
})
