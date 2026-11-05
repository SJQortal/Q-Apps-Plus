import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import { useSmoothSwap } from "./useSmoothSwap";

/** A section whose height is its number of rows × 100 px. */
function Section({ show, rows }: { show: string; rows: number }) {
  const ref = useRef<HTMLElement>(null);
  useSmoothSwap(ref, show);
  return (
    <section ref={ref} data-rows={rows}>
      <div data-swap>{show}</div>
      <div>toolbar</div>
    </section>
  );
}

const jsdomHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

function stubLayout(reduced = false) {
  const animate = vi.fn((_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) => ({ onfinish: null, oncancel: null }) as unknown as Animation);
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduced && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb();
      }
      disconnect() {}
    }
  );
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.dataset.rows ?? 0) * 100;
    },
  });
  return animate;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
  if (jsdomHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", jsdomHeight);
});

describe("useSmoothSwap", () => {
  it("eases the height from the old content's to the new and fades the new in, only when the key changes", () => {
    const animate = stubLayout();
    const { rerender } = render(<Section show="all" rows={12} />);
    rerender(<Section show="all" rows={12} />);
    expect(animate).not.toHaveBeenCalled();
    rerender(<Section show="gifts" rows={4} />);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0]).toEqual([[{ height: "1200px" }, { height: "400px" }], expect.objectContaining({ duration: 280 })]);
    expect((animate.mock.contexts[1] as HTMLElement).textContent).toBe("gifts");
    expect(animate.mock.calls[1][0]).toEqual([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }]);
  });

  it("moves nothing with reduced motion", () => {
    const animate = stubLayout(true);
    const { rerender } = render(<Section show="all" rows={12} />);
    rerender(<Section show="gifts" rows={4} />);
    expect(animate).not.toHaveBeenCalled();
  });
});
