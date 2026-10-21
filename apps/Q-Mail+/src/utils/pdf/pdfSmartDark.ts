/**
 * Adapted from Torq (src/utils/pdfSmartDark.ts); copied, never imported across repos.
 *
 * "Smart" dark view for the PDF reader.
 *
 * Deciding pixel by pixel what to invert breaks up any page that is itself a
 * picture: a screenshot or scan mixes grey text, anti-aliasing, and JPEG
 * noise with coloured bits, so some of it flipped and the rest did not. Here
 * the page is split into the pictures pdf.js paints and the paper around
 * them, and each area is judged as a whole. Light paper with dark ink, drawn
 * or photographed, turns dark. Photos and pages that are already dark stay
 * as they are.
 */

export type Matrix = [number, number, number, number, number, number];

/** Canvas pixel box, right and bottom edges exclusive. */
export type PixelRect = { x0: number; y0: number; x1: number; y1: number };

export type PdfOperatorList = {
  fnArray: ArrayLike<number>;
  argsArray: ArrayLike<unknown>;
};

export type ToneStats = {
  count: number;
  light: number;
  dark: number;
  mid: number;
  colorful: number;
};

/** Pictures smaller than this on either side are left to the paper's call. */
const MIN_PICTURE_PX = 16;
/** The largest pictures are enough; a page of icons should not slow reading. */
const MAX_PICTURES = 64;
const SAMPLE_STEP = 3;
/** Grid used to find photos inside a screenshot that is being darkened. */
const TILE_PX = 16;
const TILE_SAMPLE_STEP = 2;
/** A photo inside a screenshot covers at least this many grid tiles. */
const MIN_PHOTO_TILES = 6;
/** HSL lightness, 0–255 scale, of paper and of ink. */
const LIGHT_MIN = 184;
const DARK_MAX = 72;
/** Where the page's black and white land after inverting, to sit on the frame. */
const INVERTED_LOW = 20;
const INVERTED_HIGH = 232;

const INVERTED_LEVEL = new Uint8ClampedArray(256);
for (let v = 0; v < 256; v++) {
  INVERTED_LEVEL[v] = Math.round(
    INVERTED_LOW + (v * (INVERTED_HIGH - INVERTED_LOW)) / 255
  );
}

function multiply(m: Matrix, n: ArrayLike<number>): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function isMatrix(value: unknown): value is ArrayLike<number> {
  return (
    !!value &&
    typeof value === 'object' &&
    'length' in value &&
    (value as ArrayLike<unknown>).length === 6 &&
    typeof (value as ArrayLike<unknown>)[0] === 'number'
  );
}

/** Box a picture drawn into the unit square under `ctm` covers on the canvas. */
function unitSquareRect(
  ctm: Matrix,
  width: number,
  height: number
): PixelRect | null {
  const xs = [
    ctm[4],
    ctm[0] + ctm[4],
    ctm[2] + ctm[4],
    ctm[0] + ctm[2] + ctm[4],
  ];
  const ys = [
    ctm[5],
    ctm[1] + ctm[5],
    ctm[3] + ctm[5],
    ctm[1] + ctm[3] + ctm[5],
  ];
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(width, Math.ceil(Math.max(...xs)));
  const y1 = Math.min(height, Math.ceil(Math.max(...ys)));
  if (x1 - x0 < MIN_PICTURE_PX || y1 - y0 < MIN_PICTURE_PX) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Canvas boxes of the pictures a page paints, in paint order. Follows the
 * same transforms pdf.js applies while drawing (see its CanvasGraphics).
 */
export function pageImageRects(
  opList: PdfOperatorList,
  ops: Record<string, number>,
  viewportTransform: ArrayLike<number>,
  width: number,
  height: number
): PixelRect[] {
  const base = Array.from(viewportTransform) as Matrix;
  let ctm = base;
  let stack: Matrix[] = [];
  const rects: PixelRect[] = [];
  const add = (matrix: Matrix) => {
    const rect = unitSquareRect(matrix, width, height);
    if (rect) rects.push(rect);
  };
  const push = () => stack.push(ctm);
  const pop = () => {
    ctm = stack.pop() ?? ctm;
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = (opList.argsArray[i] || []) as unknown[];
    switch (fn) {
      case ops.save:
        push();
        break;
      case ops.restore:
      case ops.paintFormXObjectEnd:
      case ops.endGroup:
        pop();
        break;
      case ops.transform:
        if (args.length >= 6) ctm = multiply(ctm, args as number[]);
        break;
      case ops.paintFormXObjectBegin:
        push();
        if (isMatrix(args[0])) ctm = multiply(ctm, args[0]);
        break;
      case ops.beginGroup: {
        push();
        const group = args[0] as { matrix?: unknown } | undefined;
        if (isMatrix(group?.matrix)) ctm = multiply(ctm, group.matrix);
        break;
      }
      case ops.beginAnnotation:
        // pdf.js starts each annotation from the page's own transform.
        stack = [];
        ctm = base;
        if (isMatrix(args[2])) ctm = multiply(ctm, args[2]);
        if (isMatrix(args[3])) ctm = multiply(ctm, args[3]);
        break;
      case ops.paintImageXObject:
      case ops.paintInlineImageXObject:
        add(ctm);
        break;
      case ops.paintImageXObjectRepeat: {
        const scaleX = Number(args[1]);
        const scaleY = Number(args[2]);
        const positions = (args[3] || []) as ArrayLike<number>;
        for (let p = 0; p + 1 < positions.length; p += 2) {
          add(
            multiply(ctm, [
              scaleX,
              0,
              0,
              scaleY,
              positions[p],
              positions[p + 1],
            ])
          );
        }
        break;
      }
      case ops.paintInlineImageXObjectGroup: {
        const map = (args[1] || []) as Array<{ transform?: unknown }>;
        for (const entry of Array.from(map)) {
          if (isMatrix(entry?.transform)) add(multiply(ctm, entry.transform));
        }
        break;
      }
      default:
        break;
    }
  }

  return rects
    .map((rect, order) => ({ rect, order }))
    .sort(
      (a, b) =>
        (b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0) -
        (a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0)
    )
    .slice(0, MAX_PICTURES)
    .sort((a, b) => a.order - b.order)
    .map(({ rect }) => rect);
}

function inside(rects: PixelRect[], x: number, y: number): boolean {
  for (const rect of rects) {
    if (x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1) {
      return true;
    }
  }
  return false;
}

/** Share of light, dark, mid-tone, and strongly coloured pixels in `rect`. */
export function toneStats(
  data: Uint8ClampedArray,
  width: number,
  rect: PixelRect,
  exclude: PixelRect[] = [],
  step = SAMPLE_STEP
): ToneStats {
  let count = 0;
  let light = 0;
  let dark = 0;
  let colorful = 0;
  for (let y = rect.y0; y < rect.y1; y += step) {
    for (let x = rect.x0; x < rect.x1; x += step) {
      if (exclude.length && inside(exclude, x, y)) continue;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sum = max + min;
      count++;
      if (sum >= LIGHT_MIN * 2) light++;
      else if (sum <= DARK_MAX * 2) dark++;
      else {
        // HSL saturation for a mid-tone pixel.
        const saturation =
          sum > 255 ? (max - min) / (510 - sum) : (max - min) / sum;
        if (saturation >= 0.4) colorful++;
      }
    }
  }
  if (!count) return { count, light: 0, dark: 0, mid: 0, colorful: 0 };
  return {
    count,
    light: light / count,
    dark: dark / count,
    mid: (count - light - dark) / count,
    colorful: colorful / count,
  };
}

/** Drawn pages: turn the paper dark unless it already is. */
export function shouldDarkenPaper(stats: ToneStats): boolean {
  return stats.light >= 0.35 && stats.light > stats.dark;
}

/**
 * Pictures: only a light page of mostly text, such as a screenshot or scan
 * of a document. Photos have too many mid-tones and colours to invert.
 */
export function shouldDarkenPicture(stats: ToneStats): boolean {
  return stats.light >= 0.45 && stats.mid <= 0.35 && stats.colorful <= 0.15;
}

/** A grid tile that looks like part of a photo rather than text on paper. */
function isPhotoTile(stats: ToneStats): boolean {
  return (
    (stats.colorful >= 0.25 && stats.light < 0.5) ||
    (stats.mid >= 0.85 && stats.dark < 0.1)
  );
}

/**
 * Photos inside a screenshot or scan: blocks of photo-like tiles that fill
 * most of their bounding box, as pasted pictures do. Text, even small grey
 * text, stays out because it sits on light paper.
 */
export function photoAreas(
  data: Uint8ClampedArray,
  width: number,
  rect: PixelRect
): PixelRect[] {
  const cols = Math.floor((rect.x1 - rect.x0) / TILE_PX);
  const rows = Math.floor((rect.y1 - rect.y0) / TILE_PX);
  if (cols < 3 || rows < 3) return [];
  const photo = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = rect.x0 + col * TILE_PX;
      const y0 = rect.y0 + row * TILE_PX;
      const tile = { x0, y0, x1: x0 + TILE_PX, y1: y0 + TILE_PX };
      if (isPhotoTile(toneStats(data, width, tile, [], TILE_SAMPLE_STEP))) {
        photo[row * cols + col] = 1;
      }
    }
  }

  const areas: PixelRect[] = [];
  const seen = new Uint8Array(cols * rows);
  for (let start = 0; start < photo.length; start++) {
    if (!photo[start] || seen[start]) continue;
    let top = rows;
    let left = cols;
    let bottom = 0;
    let right = 0;
    let count = 0;
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const cell = queue.pop()!;
      const row = Math.floor(cell / cols);
      const col = cell % cols;
      count++;
      top = Math.min(top, row);
      bottom = Math.max(bottom, row);
      left = Math.min(left, col);
      right = Math.max(right, col);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const r = row + dy;
          const c = col + dx;
          if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
          const next = r * cols + c;
          if (photo[next] && !seen[next]) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    const boxTiles = (bottom - top + 1) * (right - left + 1);
    if (count < MIN_PHOTO_TILES || count / boxTiles < 0.5) continue;
    areas.push(
      snapToPhotoEdges(
        data,
        width,
        {
          x0: rect.x0 + left * TILE_PX,
          y0: rect.y0 + top * TILE_PX,
          x1: Math.min(rect.x1, rect.x0 + (right + 1) * TILE_PX),
          y1: Math.min(rect.y1, rect.y0 + (bottom + 1) * TILE_PX),
        },
        rect
      )
    );
  }
  return areas;
}

/** Shares of light paper and of photo mid-tones along a line of pixels. */
function lineTones(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { paper: boolean; photo: boolean } {
  let light = 0;
  let mid = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const sum =
        Math.max(data[i], data[i + 1], data[i + 2]) +
        Math.min(data[i], data[i + 1], data[i + 2]);
      count++;
      if (sum >= LIGHT_MIN * 2) light++;
      else if (sum > DARK_MAX * 2) mid++;
    }
  }
  return {
    paper: count > 0 && light / count >= 0.75,
    photo: count > 0 && mid / count >= 0.5,
  };
}

/**
 * The tile grid rarely lines up with a photo. Move each side, a line at a
 * time and at most one tile: off paper, and out over the rest of the photo.
 * A line of text next to the photo is neither, so it stays darkened.
 */
function snapToPhotoEdges(
  data: Uint8ClampedArray,
  width: number,
  area: PixelRect,
  bounds: PixelRect
): PixelRect {
  const box = { ...area };
  const row = (y: number) => lineTones(data, width, box.x0, y, box.x1, y + 1);
  const column = (x: number) =>
    lineTones(data, width, x, box.y0, x + 1, box.y1);
  const tall = () => box.y1 - box.y0 > TILE_PX;
  const wide = () => box.x1 - box.x0 > TILE_PX;

  for (let step = 0; step < TILE_PX; step++) {
    if (tall() && row(box.y0).paper) box.y0 += 1;
    else if (box.y0 > bounds.y0 && row(box.y0 - 1).photo) box.y0 -= 1;
    else break;
  }
  for (let step = 0; step < TILE_PX; step++) {
    if (tall() && row(box.y1 - 1).paper) box.y1 -= 1;
    else if (box.y1 < bounds.y1 && row(box.y1).photo) box.y1 += 1;
    else break;
  }
  for (let step = 0; step < TILE_PX; step++) {
    if (wide() && column(box.x0).paper) box.x0 += 1;
    else if (box.x0 > bounds.x0 && column(box.x0 - 1).photo) box.x0 -= 1;
    else break;
  }
  for (let step = 0; step < TILE_PX; step++) {
    if (wide() && column(box.x1 - 1).paper) box.x1 -= 1;
    else if (box.x1 < bounds.x1 && column(box.x1).photo) box.x1 += 1;
    else break;
  }
  return box;
}

/**
 * Flip lightness and keep hue: black ink turns light, white paper turns
 * dark, and a blue link stays blue. Adding 255 - max - min to each channel
 * mirrors HSL lightness while chroma, and so hue and saturation, stay put.
 */
function darken(src: Uint8ClampedArray, out: Uint8ClampedArray, i: number) {
  const r = src[i];
  const g = src[i + 1];
  const b = src[i + 2];
  const shift = 255 - Math.max(r, g, b) - Math.min(r, g, b);
  out[i] = INVERTED_LEVEL[r + shift];
  out[i + 1] = INVERTED_LEVEL[g + shift];
  out[i + 2] = INVERTED_LEVEL[b + shift];
}

function copyRect(
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  width: number,
  rect: PixelRect,
  dark: boolean
) {
  for (let y = rect.y0; y < rect.y1; y++) {
    let i = (y * width + rect.x0) * 4;
    for (let x = rect.x0; x < rect.x1; x++, i += 4) {
      if (dark) darken(src, out, i);
      else {
        out[i] = src[i];
        out[i + 1] = src[i + 1];
        out[i + 2] = src[i + 2];
      }
    }
  }
}

/** Apply the smart dark view to a rendered page, in place. */
export function applySmartDark(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  pictures: PixelRect[]
): void {
  const src = data.slice();
  const page: PixelRect = { x0: 0, y0: 0, x1: width, y1: height };
  const pictureCalls = pictures.map((rect) =>
    shouldDarkenPicture(toneStats(src, width, rect))
  );
  const paper = toneStats(src, width, page, pictures);
  const pageSamples =
    Math.ceil(width / SAMPLE_STEP) * Math.ceil(height / SAMPLE_STEP);
  let darkPaper: boolean;
  if (pictures.length && paper.count < pageSamples * 0.1) {
    // Hardly any paper shows, as with a page that is one screenshot: match
    // the margins to the biggest picture so it has no bright frame.
    let biggest = 0;
    pictures.forEach((rect, index) => {
      const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
      const best = pictures[biggest];
      if (area > (best.x1 - best.x0) * (best.y1 - best.y0)) biggest = index;
    });
    darkPaper = pictureCalls[biggest];
  } else {
    darkPaper = shouldDarkenPaper(paper);
  }

  paint(src, data, width, page, darkPaper);
  // Later pictures cover earlier ones, as they do on the page.
  pictures.forEach((rect, index) => {
    paint(src, data, width, rect, pictureCalls[index]);
  });
}

/** Darken or restore `rect`; a darkened area keeps any photos in it. */
function paint(
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  width: number,
  rect: PixelRect,
  dark: boolean
) {
  copyRect(src, out, width, rect, dark);
  if (!dark) return;
  for (const area of photoAreas(src, width, rect)) {
    copyRect(src, out, width, area, false);
  }
}
