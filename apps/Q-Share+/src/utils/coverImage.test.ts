import { describe, expect, it } from "vitest";
import { COVER_SIZE, squareCrop } from "./coverImage";

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
