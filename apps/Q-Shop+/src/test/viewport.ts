/**
 * A pretend screen for tests of phone and desktop layouts: replaces
 * `window.matchMedia` with just enough of a media query engine for
 * hooks/usePhoneLayout.ts (a comma is "or"; every `(feature: value)` in a
 * branch must hold). Ported from Q-Share+'s BottomNav test.
 *
 *   const restore = mockViewport(PHONE_PORTRAIT);
 *   … render …
 *   restore();
 */
export type Viewport = { width: number; height: number; touch: boolean };

export const PHONE_PORTRAIT: Viewport = { width: 390, height: 844, touch: true };
export const PHONE_LANDSCAPE: Viewport = { width: 844, height: 390, touch: true };
/** GO resizes the app for the soft keyboard: at 360×740 the frame is about 320 px tall. */
export const PHONE_PORTRAIT_KEYBOARD: Viewport = { width: 360, height: 320, touch: true };
export const DESKTOP: Viewport = { width: 1440, height: 900, touch: false };

export function matchesViewport(query: string, vp: Viewport): boolean {
  return query
    .replace(/^@media\s*/, "")
    .split(",")
    .some((branch) =>
      [...branch.matchAll(/\(\s*([a-z-]+)\s*:\s*([^()]+?)\s*\)/g)].every(([, feature, value]) => {
        const px = parseFloat(value);
        switch (feature) {
          case "max-width":
            return vp.width <= px;
          case "min-width":
            return vp.width >= px;
          case "max-height":
            return vp.height <= px;
          case "min-height":
            return vp.height >= px;
          case "pointer":
            return value === (vp.touch ? "coarse" : "fine");
          case "prefers-reduced-motion":
            return false;
          default:
            return false;
        }
      })
    );
}

/** Installs the pretend screen; returns a function that puts the previous matchMedia back. */
export function mockViewport(vp: Viewport): () => void {
  const previous = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matchesViewport(query, vp),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
  return () => Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: previous });
}
