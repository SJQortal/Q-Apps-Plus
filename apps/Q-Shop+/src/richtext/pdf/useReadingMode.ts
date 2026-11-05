/**
 * Full screen for the PDF preview, after Torq's hooks/useReadingMode.ts: the
 * preview fills the app, and on a computer the page also asks for the
 * browser's full screen, so it covers Hub's window; leaving that (Esc) leaves
 * full screen here too. On a phone or tablet it only fills the app: Hub turns
 * the whole activity sideways for an HTML full-screen view, which is wrong
 * for a page of text.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement() {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

function quietly(run: (() => Promise<void> | void) | undefined) {
  try {
    const pending = run?.();
    if (pending && typeof pending.catch === "function") void pending.catch(() => undefined);
  } catch {
    // The browser said no; reading mode still fills the app.
  }
}

/** A phone or tablet: full screen fills the app only. */
export function touchReader(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useReadingMode() {
  const [reading, setReading] = useState(false);
  const ownsFullscreen = useRef(false);

  const leaveFullscreen = useCallback(() => {
    if (!ownsFullscreen.current) return;
    ownsFullscreen.current = false;
    if (!fullscreenElement()) return;
    const doc = document as FullscreenDocument;
    quietly(doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc));
  }, []);

  const enterReading = useCallback(() => {
    setReading(true);
    if (touchReader() || fullscreenElement()) return;
    const root = document.documentElement as FullscreenElement;
    const request = root.requestFullscreen?.bind(root) || root.webkitRequestFullscreen?.bind(root);
    if (!request) return;
    ownsFullscreen.current = true;
    try {
      const pending = request();
      if (pending && typeof pending.catch === "function") {
        void pending.catch(() => {
          ownsFullscreen.current = false;
        });
      }
    } catch {
      ownsFullscreen.current = false;
    }
  }, []);

  const exitReading = useCallback(() => {
    setReading(false);
    leaveFullscreen();
  }, [leaveFullscreen]);

  const toggleReading = useCallback(() => (reading ? exitReading() : enterReading()), [enterReading, exitReading, reading]);

  // Esc (or the browser) left full screen: leave reading mode too.
  useEffect(() => {
    const onChange = () => {
      if (!ownsFullscreen.current || fullscreenElement()) return;
      ownsFullscreen.current = false;
      setReading(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Closing the preview leaves full screen.
  useEffect(() => leaveFullscreen, [leaveFullscreen]);

  return { reading, toggleReading, exitReading };
}
