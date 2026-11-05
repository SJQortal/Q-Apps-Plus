// Torq's tests for pdfSmartDark.ts (src/__tests__/utils/pdfSmartDark.test.ts), unchanged.
import { describe, expect, it } from 'vitest';
import {
  applySmartDark,
  pageImageRects,
  type PixelRect,
} from './pdfSmartDark';

// pdf.js 4.x operator codes used by the page walker.
const OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  beginGroup: 76,
  endGroup: 77,
  beginAnnotation: 80,
  endAnnotation: 81,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintInlineImageXObjectGroup: 87,
  paintImageXObjectRepeat: 88,
  showText: 44,
};

type Rgb = [number, number, number];

function page(
  width: number,
  height: number,
  color: (x: number, y: number) => Rgb
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = color(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

/** White paper with rows of dark "text" and a little anti-aliasing grey. */
const documentLike = (x: number, y: number): Rgb => {
  if (y % 12 === 5 && x % 7 < 4) return [20, 20, 25];
  if (y % 12 === 6 && x % 7 < 4) return [150, 150, 155];
  return [252, 252, 250];
};

/** A photo: smooth, colourful mid-tones everywhere. */
const photoLike = (x: number, y: number): Rgb => [
  60 + ((x * 3) % 140),
  90 + ((y * 5) % 110),
  120 - ((x + y) % 80),
];

describe('pageImageRects', () => {
  it('follows the page transforms to each picture’s box on the canvas', () => {
    // pdf.js flips page space so y grows downward on the canvas.
    const viewport = [2, 0, 0, -2, 0, 800];
    const rects = pageImageRects(
      {
        fnArray: [
          OPS.save,
          OPS.transform,
          OPS.paintImageXObject,
          OPS.restore,
          OPS.paintFormXObjectBegin,
          OPS.save,
          OPS.transform,
          OPS.paintInlineImageXObject,
          OPS.restore,
          OPS.paintFormXObjectEnd,
          OPS.save,
          OPS.transform,
          OPS.paintImageXObject,
          OPS.restore,
        ],
        argsArray: [
          null,
          [100, 0, 0, 50, 10, 20],
          ['img1', 10, 10],
          null,
          [
            [1, 0, 0, 1, 200, 0],
            [0, 0, 100, 100],
          ],
          null,
          [40, 0, 0, 40, 0, 0],
          [{}],
          null,
          null,
          null,
          // An icon too small to judge on its own.
          [4, 0, 0, 4, 5, 5],
          ['icon', 4, 4],
          null,
        ],
      },
      OPS,
      viewport,
      600,
      800
    );

    expect(rects).toEqual<PixelRect[]>([
      { x0: 20, y0: 660, x1: 220, y1: 760 },
      { x0: 400, y0: 720, x1: 480, y1: 800 },
    ]);
  });

  it('repeats tiled images and starts each annotation from the page transform', () => {
    const rects = pageImageRects(
      {
        fnArray: [
          OPS.save,
          OPS.transform,
          OPS.paintImageXObjectRepeat,
          OPS.beginAnnotation,
          OPS.paintImageXObject,
          OPS.endAnnotation,
        ],
        argsArray: [
          null,
          [10, 0, 0, 10, 0, 0],
          ['tile', 2, 2, [0, 0, 10, 10]],
          [
            'a1',
            [0, 0, 50, 50],
            [1, 0, 0, 1, 30, 30],
            [20, 0, 0, 20, 0, 0],
            false,
          ],
          ['img', 1, 1],
          null,
        ],
      },
      OPS,
      [1, 0, 0, 1, 0, 0],
      300,
      300
    );

    expect(rects).toEqual<PixelRect[]>([
      { x0: 0, y0: 0, x1: 20, y1: 20 },
      { x0: 100, y0: 100, x1: 120, y1: 120 },
      { x0: 30, y0: 30, x1: 50, y1: 50 },
    ]);
  });
});

describe('applySmartDark', () => {
  it('turns a drawn text page dark with light text', () => {
    const data = page(84, 84, documentLike);
    applySmartDark(data, 84, 84, []);

    // Paper lands near the reader's dark frame, not pure black.
    const paper = pixel(data, 84, 10, 0);
    expect(Math.max(...paper)).toBeLessThan(30);
    expect(Math.min(...paper)).toBeGreaterThanOrEqual(20);
    const ink = pixel(data, 84, 0, 5);
    expect(Math.min(...ink)).toBeGreaterThan(200);
  });

  it('darkens a page that is one screenshot evenly, with no bright frame', () => {
    const width = 90;
    const height = 90;
    // A screenshot of a document with a coloured heading, JPEG-style noise,
    // and a white margin around it on the page.
    const data = page(width, height, (x, y) => {
      if (x < 2 || y < 2 || x >= 88 || y >= 88) return [255, 255, 255];
      if (y < 10) return [30, 90, 200];
      const noise = (x * 7 + y * 13) % 9;
      const [r, g, b] = documentLike(x, y);
      return [r - noise, g - (noise >> 1), b];
    });
    const before = data.slice();
    const shot: PixelRect = { x0: 2, y0: 2, x1: 88, y1: 88 };

    applySmartDark(data, width, height, [shot]);

    // Every pixel went through the same lightness flip: none left bright.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const wasLight = before[i] + before[i + 1] + before[i + 2] > 700;
        if (wasLight) expect(data[i]).toBeLessThan(40);
      }
    }
    // The blue heading stays blue, now light on dark.
    const [r, g, b] = pixel(data, width, 40, 5);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(r + g + b).toBeGreaterThan(30 + 90 + 200);
  });

  it('keeps a photo that is part of a screenshot while the page around it darkens', () => {
    const width = 160;
    const height = 160;
    const inPhoto = (x: number, y: number) =>
      x >= 48 && x < 128 && y >= 48 && y < 112;
    const data = page(width, height, (x, y) =>
      inPhoto(x, y) ? photoLike(x, y) : documentLike(x, y)
    );
    const before = data.slice();
    const shot: PixelRect = { x0: 0, y0: 0, x1: width, y1: height };

    applySmartDark(data, width, height, [shot]);

    expect(pixel(data, width, 80, 80)).toEqual(pixel(before, width, 80, 80));
    expect(pixel(data, width, 10, 10)[0]).toBeLessThan(40);
    expect(pixel(data, width, 150, 152)[0]).toBeLessThan(40);
  });

  it('keeps a photo as it is while the paper around it turns dark', () => {
    const photo: PixelRect = { x0: 30, y0: 30, x1: 90, y1: 90 };
    const data = page(120, 120, (x, y) =>
      x >= 30 && x < 90 && y >= 30 && y < 90
        ? photoLike(x, y)
        : documentLike(x, y)
    );
    const before = data.slice();

    applySmartDark(data, 120, 120, [photo]);

    expect(pixel(data, 120, 50, 50)).toEqual(pixel(before, 120, 50, 50));
    expect(pixel(data, 120, 100, 100)[0]).toBeLessThan(40);
  });

  it('leaves a screenshot that is already dark alone', () => {
    const shot: PixelRect = { x0: 0, y0: 0, x1: 60, y1: 60 };
    const data = page(60, 60, (x, y) =>
      y % 10 === 4 && x % 5 < 3 ? [230, 230, 235] : [24, 26, 32]
    );
    const before = data.slice();

    applySmartDark(data, 60, 60, [shot]);

    expect(Array.from(data)).toEqual(Array.from(before));
  });
});
