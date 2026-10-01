import { describe, expect, it } from 'vitest'
import { PDF_ZOOM_STEPS, canvasPixelRatio, clampZoom, scrollAfterZoom, stepZoom } from './documentZoom'

describe('documentZoom', () => {
  it('clamps and steps through the presets', () => {
    expect(clampZoom(10, 50, 400)).toBe(50)
    expect(clampZoom(900, 50, 400)).toBe(400)
    expect(stepZoom(100, 1, PDF_ZOOM_STEPS)).toBe(125)
    expect(stepZoom(100, -1, PDF_ZOOM_STEPS)).toBe(75)
    expect(stepZoom(113, 1, PDF_ZOOM_STEPS)).toBe(125)
    expect(stepZoom(113, -1, PDF_ZOOM_STEPS)).toBe(100)
    expect(stepZoom(400, 1, PDF_ZOOM_STEPS)).toBe(400)
    expect(stepZoom(50, -1, PDF_ZOOM_STEPS)).toBe(50)
  })

  it('keeps the canvas under the pixel budget', () => {
    expect(canvasPixelRatio(100, 100, 2)).toBe(2)
    expect(canvasPixelRatio(100, 100, 0)).toBe(1)
    expect(canvasPixelRatio(4000, 4000, 3, 16_000_000)).toBe(1)
    expect(canvasPixelRatio(4000, 4000, 3, 64_000_000)).toBe(2)
  })

  it('keeps the focal point still after a zoom', () => {
    expect(scrollAfterZoom(0, 100, 2)).toBe(100)
    expect(scrollAfterZoom(50, 100, 2)).toBe(200)
    expect(scrollAfterZoom(0, 100, 0.5)).toBe(0)
  })
})
