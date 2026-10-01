import { useEffect } from 'react';

/**
 * Sizes the app to the space it really has, instead of 100vh:
 * - Hub and GO show the app in an iframe shorter than the screen, so the
 *   frame's innerHeight is the usable height (Torq's embeddedAppHeight);
 * - when the on-screen keyboard opens, visualViewport.height shrinks, so the
 *   composer's Send button and the focused field stay above the keyboard.
 *
 * Writes --qmail-app-height on <html>. Pure function kept separate for tests.
 */
export const APP_HEIGHT_VAR = '--qmail-app-height';

export function isEmbeddedFrame(win: Window = window): boolean {
  try {
    return win.parent !== win;
  } catch {
    return true;
  }
}

export function appHeightValue(win: Window = window): string {
  const visual = win.visualViewport;
  const visualHeight = visual && visual.height > 0 ? Math.round(visual.height) : 0;
  const innerHeight = win.innerHeight > 0 ? Math.round(win.innerHeight) : 0;
  // The keyboard shrinks the visual viewport but not innerHeight on some
  // Android WebViews, so the smaller of the two is the safe height.
  const keyboardAware = visualHeight && innerHeight ? Math.min(visualHeight, innerHeight) : visualHeight || innerHeight;
  if (keyboardAware && (isEmbeddedFrame(win) || (visualHeight && innerHeight && visualHeight < innerHeight - 1))) {
    return `${keyboardAware}px`;
  }
  return '100dvh';
}

export function applyAppViewport(win: Window = window): void {
  if (typeof win.document === 'undefined') return;
  win.document.documentElement.style.setProperty(APP_HEIGHT_VAR, appHeightValue(win));
}

export function useAppViewport(): void {
  useEffect(() => {
    const apply = () => applyAppViewport(window);
    apply();
    window.addEventListener('resize', apply);
    const visual = window.visualViewport;
    visual?.addEventListener('resize', apply);
    visual?.addEventListener('scroll', apply);
    return () => {
      window.removeEventListener('resize', apply);
      visual?.removeEventListener('resize', apply);
      visual?.removeEventListener('scroll', apply);
    };
  }, []);
}
