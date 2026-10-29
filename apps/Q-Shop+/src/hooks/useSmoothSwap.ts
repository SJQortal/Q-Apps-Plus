/**
 * Eases a section from one content to the next (Simon, 2026-10-24: "when
 * changing between collections on shop page, make the transitions smooth,
 * now they jump rapidly"). When `key` changes, the section's height goes
 * from its old to its new over a moment, so the page under it (and the
 * scroll position, when it has to give) doesn't snap, and its `[data-swap]`
 * parts fade in from a little below. With reduced motion nothing moves.
 *
 * The old height comes from a ResizeObserver, so no render forces a layout;
 * its callback runs after a frame's layout, so when the new content is in
 * (the layout effect) it still holds the old one.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const HEIGHT_MS = 280;
const FADE_MS = 240;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useSmoothSwap(ref: RefObject<HTMLElement | null>, key: string) {
  const height = useRef<number | null>(null);
  const shown = useRef(key);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      height.current = el.offsetHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  useLayoutEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
    const from = height.current;
    const to = el.offsetHeight;
    if (from !== null && Math.abs(from - to) > 1) {
      // Clipped while it eases: the new content shows as the height reaches it.
      const overflow = el.style.overflow;
      el.style.overflow = "hidden";
      const resize = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: HEIGHT_MS, easing: EASE });
      const done = () => {
        el.style.overflow = overflow;
      };
      resize.onfinish = done;
      resize.oncancel = done;
    }
    el.querySelectorAll<HTMLElement>("[data-swap]").forEach((part) =>
      part.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: FADE_MS, easing: EASE })
    );
  }, [key, ref]);
}
