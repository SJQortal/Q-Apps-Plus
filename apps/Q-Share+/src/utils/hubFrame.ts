/**
 * Hub and GO host the app in an iframe that is shorter than the device
 * screen, so `100vh` overshoots and pins things behind the browser bars.
 * This keeps a CSS variable, `--qshare-app-height`, on <html>: the frame's
 * innerHeight when embedded, `100dvh` when the app runs on its own.
 * Ported from Torq's src/utils/hubBoot.ts. index.html sets a first value
 * before React loads; main.tsx calls `watchEmbeddedFrame()` to keep it fresh.
 */
export const APP_HEIGHT_VAR = "--qshare-app-height";
export const FRAMED_CLASS = "qshare-framed";

export function isEmbeddedFrame(win: Window = window): boolean {
  try {
    return win.parent !== win;
  } catch {
    // Cross-origin parents throw on access; that still means we are framed.
    return true;
  }
}

export function embeddedAppHeight(framed: boolean, innerHeight = 0): string {
  if (!framed) return "100dvh";
  if (innerHeight > 0) return `${Math.round(innerHeight)}px`;
  return "100%";
}

export function applyEmbeddedFrame(win: Window = window): void {
  if (typeof win === "undefined" || typeof win.document === "undefined") return;
  const framed = isEmbeddedFrame(win);
  const root = win.document.documentElement;
  root.classList.toggle(FRAMED_CLASS, framed);
  root.style.setProperty(APP_HEIGHT_VAR, embeddedAppHeight(framed, framed ? win.innerHeight : 0));
}

/** Hub resizes the iframe; follow it. Returns a function that stops watching. */
export function watchEmbeddedFrame(win: Window = window): () => void {
  if (typeof win === "undefined") return () => {};
  const apply = () => applyEmbeddedFrame(win);
  apply();
  win.addEventListener("resize", apply);
  return () => win.removeEventListener("resize", apply);
}
