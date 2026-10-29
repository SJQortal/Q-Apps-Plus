import { describe, expect, it } from "vitest";
import { THUMBNAIL_MAX, THUMBNAIL_SOURCE_MAX_BYTES, fitWithin, thumbnailSource } from "./thumbnailImage";

describe("thumbnail sizes", () => {
  it("scales down to fit 640 px, keeping the shape, and never scales up", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: THUMBNAIL_MAX, height: 480 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 360, height: 640 });
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(10000, 1)).toEqual({ width: 640, height: 1 });
  });
});

describe("thumbnailSource", () => {
  const f = (name: string, mimetype: string, size = 1000) => ({ name, mimetype, size });

  it("takes the first image, else the first video, else nothing", () => {
    expect(thumbnailSource([f("a.zip", "application/zip"), f("b.png", "image/png"), f("c.jpg", "image/jpeg")])?.file.name).toBe("b.png");
    expect(thumbnailSource([f("a.zip", "application/zip"), f("clip.mp4", "video/mp4")])).toMatchObject({ kind: "video" });
    expect(thumbnailSource([f("a.mp3", "audio/mpeg"), f("b.pdf", "application/pdf")])).toBeNull();
  });

  it("skips images too big to read on a phone", () => {
    const big = f("huge.tif", "image/tiff", THUMBNAIL_SOURCE_MAX_BYTES + 1);
    expect(thumbnailSource([big, f("small.png", "image/png")])?.file.name).toBe("small.png");
    expect(thumbnailSource([big])).toBeNull();
  });
});
