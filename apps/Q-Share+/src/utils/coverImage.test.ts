import { afterEach, describe, expect, it, vi } from "vitest";
import { COVER_SIZE, ImageTooBigError, MAX_SOURCE_PIXELS, decodeImage, squareCrop } from "./coverImage";
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
