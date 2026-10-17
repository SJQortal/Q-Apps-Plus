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

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
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

/** The cover file for `file`; rejects when the image can't be read or made small enough. */
export async function makeCoverFile(file: Blob): Promise<File> {
  const image = await decode(file);
  try {
    if (!image.width || !image.height) throw new Error("The image is empty");
    const { sx, sy, side, out } = squareCrop(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, sx, sy, side, side, 0, 0, out, out);
    for (const quality of QUALITIES) {
      let blob = await toBlob(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
      if (!blob) break;
      if (blob.size <= COVER_MAX_BYTES) {
        const extension = blob.type === "image/webp" ? "webp" : "jpg";
        return new File([blob], `cover.${extension}`, { type: blob.type });
      }
    }
    throw new Error("The image is too large");
  } finally {
    image.close();
  }
}
