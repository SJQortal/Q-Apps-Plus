import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { QDN_IMAGE_RETRY_MS, asyncImageUrl, useQdnImage } from "./useQdnImage";

function Picture({ url }: { url: string | null }) {
  const { src, onError } = useQdnImage(url);
  return src ? <img src={src} alt="" onError={onError} /> : <span data-testid="fallback" />;
}
const src = (container: HTMLElement) => container.querySelector("img")?.getAttribute("src") ?? null;

afterEach(() => {
  vi.useRealTimers();
});

describe("QDN images", () => {
  it("asks without holding the node, and only for QDN paths", () => {
    expect(asyncImageUrl("/arbitrary/THUMBNAIL/dj%20b/qshare_thumb_x")).toBe("/arbitrary/THUMBNAIL/dj%20b/qshare_thumb_x?async=true");
    expect(asyncImageUrl("/arbitrary/THUMBNAIL/a/b?x=1", 2)).toBe("/arbitrary/THUMBNAIL/a/b?x=1&async=true&retry=2");
    expect(asyncImageUrl("blob:http://localhost/123")).toBe("blob:http://localhost/123");
  });

  it("asks again while the node fetches the image, then shows the fallback for good", () => {
    vi.useFakeTimers();
    const { container, getByTestId } = render(<Picture url="/arbitrary/THUMBNAIL/a/qshare_thumb_x" />);
    expect(src(container)).toBe("/arbitrary/THUMBNAIL/a/qshare_thumb_x?async=true");

    for (const [i, wait] of QDN_IMAGE_RETRY_MS.entries()) {
      fireEvent.error(container.querySelector("img")!);
      expect(getByTestId("fallback")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(wait - 1));
      expect(container.querySelector("img")).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(src(container)).toBe(`/arbitrary/THUMBNAIL/a/qshare_thumb_x?async=true&retry=${i + 1}`);
    }
    fireEvent.error(container.querySelector("img")!);
    act(() => vi.advanceTimersByTime(60_000));
    expect(container.querySelector("img")).toBeNull();
  });

  it("starts afresh for another image, and gives up on a local preview at once", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Picture url="/arbitrary/THUMBNAIL/a/one" />);
    fireEvent.error(container.querySelector("img")!);
    rerender(<Picture url="/arbitrary/THUMBNAIL/a/two" />);
    expect(src(container)).toBe("/arbitrary/THUMBNAIL/a/two?async=true");
    // The first image's retry doesn't bring it back.
    act(() => vi.advanceTimersByTime(QDN_IMAGE_RETRY_MS[0]));
    expect(src(container)).toBe("/arbitrary/THUMBNAIL/a/two?async=true");

    rerender(<Picture url="blob:http://localhost/7" />);
    expect(src(container)).toBe("blob:http://localhost/7");
    fireEvent.error(container.querySelector("img")!);
    act(() => vi.advanceTimersByTime(60_000));
    expect(container.querySelector("img")).toBeNull();
  });
});
