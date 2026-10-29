/**
 * Covers for collections and folders: the picked image cut to a centred
 * square and scaled to at most 600 px, as WebP (JPEG where the browser
 * can't write WebP), well under Core's 500 KB limit for a THUMBNAIL. Done on
 * the device, so nothing but the small result is published.
 */
export const COVER_SIZE = 600;
/** Core takes THUMBNAILs up to 500 KB; leave room. */
export const COVER_MAX_BYTES = 450 * 1024;
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

/** The centred square of a width × height image, and the side to draw it at. */
export function squareCrop(width: number, height: number, max = COVER_SIZE) {
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    side,
    out: Math.max(1, Math.min(side, max)),
  };
}

/** A decoded image ready to draw; `close` frees it. */
export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/**
 * Images up to this many pixels are read on the device (a 50 MP photo). A
 * 200 MP photo would take about 800 MB to decode whole, enough to end a
 * phone's WebView.
 */
export const MAX_SOURCE_PIXELS = 50_000_000;

export class ImageTooBigError extends Error {
  constructor() {
    super("The image is too big to read on this device");
    this.name = "ImageTooBigError";
  }
}

/** The image's width and height, known from its header once loaded, before it is decoded. */
export function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const done = () => URL.revokeObjectURL(url);
    image.onload = () => {
      done();
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      done();
      reject(new Error("The image can't be read"));
    };
    image.src = url;
  });
}

/**
 * The image decoded at the size `fit` picks for its width and height, where
 * the browser can scale while decoding (so a big photo is never held whole),
 * else at full size. Rejects with ImageTooBigError past MAX_SOURCE_PIXELS.
 */
export async function decodeImage(
  file: Blob,
  fit?: (width: number, height: number) => { width: number; height: number }
): Promise<DecodedImage> {
  const size = await imageSize(file);
  if (size.width * size.height > MAX_SOURCE_PIXELS) throw new ImageTooBigError();
  if (typeof createImageBitmap === "function") {
    const target = fit?.(size.width, size.height);
    const bitmap = target
      ? await createImageBitmap(file, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: "high" }).catch(
          () => createImageBitmap(file)
        )
      : await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * The canvas as a WebP (JPEG where the browser can't write WebP) of at most
 * `maxBytes`, trying lower qualities in turn; named `<base>.webp` or `.jpg`.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, base: string, maxBytes: number): Promise<File> {
  for (const quality of QUALITIES) {
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) break;
    if (blob.size <= maxBytes) {
      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      return new File([blob], `${base}.${extension}`, { type: blob.type });
    }
  }
  throw new Error("The image is too large");
}

/** A canvas of `width` × `height` with `draw` done on it. */
export function drawnCanvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.imageSmoothingQuality = "high";
  draw(context);
  return canvas;
}

/** The cover file for `file`; rejects when the image can't be read or made small enough. */
export async function makeCoverFile(file: Blob): Promise<File> {
  // Decoded with its shorter side at the cover size; the square is cut below.
  const image = await decodeImage(file, (width, height) => {
    const scale = Math.min(1, COVER_SIZE / Math.min(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  });
  try {
    if (!image.width || !image.height) throw new Error("The image is empty");
    const { sx, sy, side, out } = squareCrop(image.width, image.height);
    const canvas = drawnCanvas(out, out, (context) => context.drawImage(image.source, sx, sy, side, side, 0, 0, out, out));
    return await encodeCanvas(canvas, "cover", COVER_MAX_BYTES);
  } finally {
    image.close();
  }
}
