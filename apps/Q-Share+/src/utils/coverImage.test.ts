import { afterEach, describe, expect, it, vi } from "vitest";
import { galleryCoverSize, BOOK_COVER_HEIGHT, BOOK_COVER_WIDTH, COVER_SIZE, FILM_COVER_HEIGHT, FILM_COVER_WIDTH, ImageTooBigError, MAX_SOURCE_PIXELS, bookCrop, decodeImage, filmCrop, squareCrop } from "./coverImage";
import { fitWithin } from "./thumbnailImage";

describe("squareCrop", () => {
  it("takes the centred square and scales it down to the cover size", () => {
    expect(squareCrop(1920, 1080)).toEqual({ sx: 420, sy: 0, side: 1080, out: COVER_SIZE });
    expect(squareCrop(800, 1200)).toEqual({ sx: 0, sy: 200, side: 800, out: COVER_SIZE });
  });

  it("never scales a small image up", () => {
    expect(squareCrop(300, 200)).toEqual({ sx: 50, sy: 0, side: 200, out: 200 });
    expect(squareCrop(1, 1).out).toBe(1);
  });
});

describe("bookCrop", () => {
  it("takes the centred 2:3 portrait and scales it down to the book cover's size", () => {
    // Landscape: the sides go.
    expect(bookCrop(1920, 1080)).toEqual({ sx: 600, sy: 0, sw: 720, sh: 1080, outWidth: BOOK_COVER_WIDTH, outHeight: BOOK_COVER_HEIGHT });
    // A tall phone photo: top and bottom go.
    expect(bookCrop(1000, 2000)).toEqual({ sx: 0, sy: 250, sw: 1000, sh: 1500, outWidth: BOOK_COVER_WIDTH, outHeight: BOOK_COVER_HEIGHT });
    // Already 2:3.
    expect(bookCrop(800, 1200)).toMatchObject({ sx: 0, sy: 0, sw: 800, sh: 1200, outWidth: 400, outHeight: 600 });
  });

  it("never scales a small image up", () => {
    expect(bookCrop(200, 300)).toMatchObject({ outWidth: 200, outHeight: 300 });
    expect(bookCrop(1, 1)).toMatchObject({ outWidth: 1, outHeight: 1 });
  });
});

describe("filmCrop", () => {
  it("takes the centred 16:9 and scales it down to the video cover's size", () => {
    expect(filmCrop(1920, 1080)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080, outWidth: FILM_COVER_WIDTH, outHeight: FILM_COVER_HEIGHT });
    // A portrait phone photo: a band across its middle.
    expect(filmCrop(1080, 1920)).toEqual({ sx: 0, sy: 656, sw: 1080, sh: 608, outWidth: 960, outHeight: 540 });
    // Wider than 16:9: the sides go.
    expect(filmCrop(3000, 1000)).toMatchObject({ sx: 611, sy: 0, sw: 1778, sh: 1000, outWidth: 960, outHeight: 540 });
  });

  it("never scales a small image up", () => {
    expect(filmCrop(320, 180)).toMatchObject({ outWidth: 320, outHeight: 180 });
  });
});

describe("galleryCoverSize", () => {
  it("keeps the picture's shape, its longer side at most 960 px", () => {
    expect(galleryCoverSize(4000, 3000)).toEqual({ width: 960, height: 720 });
    expect(galleryCoverSize(3000, 4000)).toEqual({ width: 720, height: 960 });
    expect(galleryCoverSize(500, 400)).toEqual({ width: 500, height: 400 });
  });

  it("cuts a very tall or very wide picture to the gallery's limits", () => {
    // A page scan is fine; a long strip becomes 0.6 or 2.2.
    expect(galleryCoverSize(1000, 3000)).toEqual({ width: 576, height: 960 });
    expect(galleryCoverSize(5000, 1000)).toEqual({ width: 960, height: 436 });
  });
});

describe("decodeImage", () => {
  // jsdom loads no images: an <img> that "loads" at a given size, and a createImageBitmap that records its options.
  function photo(width: number, height: number) {
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = width;
        naturalHeight = height;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    const bitmap = vi.fn(async (_file: Blob, options?: ImageBitmapOptions) => ({
      width: options?.resizeWidth ?? width,
      height: options?.resizeHeight ?? height,
      close: vi.fn(),
    }));
    vi.stubGlobal("createImageBitmap", bitmap);
    URL.createObjectURL = vi.fn(() => "blob:photo");
    URL.revokeObjectURL = vi.fn();
    return bitmap;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes a big photo at the size it is wanted at, never whole", async () => {
    const bitmap = photo(8000, 6000);
    const image = await decodeImage(new Blob(["x"]), (w, h) => fitWithin(w, h));
    expect(bitmap).toHaveBeenCalledWith(expect.any(Blob), { resizeWidth: 640, resizeHeight: 480, resizeQuality: "high" });
    expect([image.width, image.height]).toEqual([640, 480]);
  });

  it("refuses a photo past the pixel limit before decoding it", async () => {
    const bitmap = photo(16320, 12240); // 200 MP
    expect(16320 * 12240).toBeGreaterThan(MAX_SOURCE_PIXELS);
    await expect(decodeImage(new Blob(["x"]), (w, h) => fitWithin(w, h))).rejects.toBeInstanceOf(ImageTooBigError);
    expect(bitmap).not.toHaveBeenCalled();
  });
});
