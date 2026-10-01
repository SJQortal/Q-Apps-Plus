/**
 * Zoom levels for the document readers: PDF pages and plain text.
 * Adapted from Torq (src/utils/documentZoom.ts).
 */

export const PDF_ZOOM_MIN = 50;
export const PDF_ZOOM_MAX = 400;
export const PDF_ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 250, 300, 400];
export const PDF_DOUBLE_TAP_ZOOM = 200;

export const TEXT_SIZE_MIN = 12;
export const TEXT_SIZE_MAX = 36;
export const TEXT_SIZE_DEFAULT = 16;
export const TEXT_SIZE_STEPS = [12, 14, 16, 18, 20, 24, 28, 32, 36];

/**
 * Largest canvas the PDF reader draws, in device pixels. A sharp page on a
 * phone needs about three pixels per CSS pixel, but a zoomed page at that
 * density would take hundreds of megabytes, so big pages trade some sharpness.
 */
export const MAX_CANVAS_PIXELS = 1 << 23;

export function clampZoom(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** The next preset above or below `current`, so odd pinch values step cleanly. */
export function stepZoom(
  current: number,
  direction: 1 | -1,
  steps: readonly number[]
) {
  if (direction > 0) {
    return (
      steps.find((step) => step > current + 0.5) ?? steps[steps.length - 1]!
    );
  }
  return [...steps].reverse().find((step) => step < current - 0.5) ?? steps[0]!;
}

/** Device pixels per CSS pixel for a canvas, kept under `maxPixels`. */
export function canvasPixelRatio(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxPixels = MAX_CANVAS_PIXELS
) {
  const wanted = Math.max(1, devicePixelRatio || 1);
  const area = Math.max(1, cssWidth * cssHeight);
  return Math.min(wanted, Math.sqrt(maxPixels / area));
}

/**
 * Scroll offset that keeps the same spot of the content under the fingers
 * after the content grows by `ratio`. `focal` is measured from the scroller's
 * top-left corner.
 */
export function scrollAfterZoom(scroll: number, focal: number, ratio: number) {
  return Math.max(0, (scroll + focal) * ratio - focal);
}
