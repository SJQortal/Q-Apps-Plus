import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ProductImage, hasTransparentEdge, resetProductImageFits } from "./ProductImage";

const SIZE = 24;

/** A canvas whose 24×24 sample is opaque, or see-through around a solid middle (a cut-out). */
function stubCanvas(cutOut: boolean) {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inside = x > 3 && y > 3 && x < SIZE - 4 && y < SIZE - 4;
      data[(y * SIZE + x) * 4 + 3] = cutOut && !inside ? 0 : 255;
    }
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
    getImageData: () => ({ data }),
  } as unknown as CanvasRenderingContext2D);
}

function loadedImage(): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 400 });
  Object.defineProperty(img, "naturalHeight", { value: 400 });
  return img;
}

afterEach(() => {
  vi.restoreAllMocks();
  resetProductImageFits();
});

describe("a product picture in its square frame", () => {
  it("tells a cut-out (see-through edges) from a photo", () => {
    stubCanvas(true);
    expect(hasTransparentEdge(loadedImage())).toBe(true);
    vi.restoreAllMocks();
    stubCanvas(false);
    expect(hasTransparentEdge(loadedImage())).toBe(false);
  });

  it("fits a cut-out whole with a margin, and lets a photo fill the square", () => {
    stubCanvas(true);
    renderWithProviders(<ProductImage src="data:image/webp;base64,Q1VU" alt="Ghee" />);
    const picture = screen.getByRole("img", { name: "Ghee" });
    Object.defineProperty(picture, "naturalWidth", { value: 400 });
    Object.defineProperty(picture, "naturalHeight", { value: 400 });
    expect(getComputedStyle(picture).objectFit).toBe("cover");
    fireEvent.load(picture);
    expect(getComputedStyle(picture).objectFit).toBe("contain");
  });
});
