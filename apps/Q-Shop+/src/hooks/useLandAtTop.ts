/**
 * Opens a page at its top, gently (Simon, 2026-10-24: "when opening product
 * page, it should start from the top of the product, not from the middle of
 * the product page, with smooth landing"). The app is one page, so a new
 * route keeps the old one's scroll: when `key` changes (and on mount) the
 * window goes to the top at once and `ref` fades in from a little below,
 * rather than the page scrolling all the way up. With reduced motion it only
 * goes to the top.
 */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "./useSmoothSwap";

const LAND_MS = 320;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

export function useLandAtTop(ref: RefObject<HTMLElement | null>, key: string) {
  const landed = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (landed.current === key) return;
    landed.current = key;
    if (typeof window.scrollTo === "function" && window.scrollY > 0) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
    el.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: LAND_MS, easing: EASE });
  }, [key, ref]);
}
