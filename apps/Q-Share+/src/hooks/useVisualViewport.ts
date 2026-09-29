import { useEffect, useState } from "react";

export interface VisualViewportSize {
  /** Height of the visible area, which shrinks when the on-screen keyboard opens. */
  height: number;
  offsetTop: number;
}

function read(): VisualViewportSize {
  if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
  const vv = window.visualViewport;
  return {
    height: Math.round(vv?.height ?? window.innerHeight),
    offsetTop: Math.round(vv?.offsetTop ?? 0),
  };
}

/**
 * Tracks `window.visualViewport`, so full-screen dialogs can keep their
 * inputs and action bar above the on-screen keyboard (DESIGN.md → Mobile).
 */
export function useVisualViewport(): VisualViewportSize {
  const [size, setSize] = useState<VisualViewportSize>(read);
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setSize(read());
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return size;
}
