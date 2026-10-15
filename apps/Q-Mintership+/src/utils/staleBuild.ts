/**
 * After the app is updated (republished, or a new zip in Hub's Dev Mode), a
 * tab that already had it open still runs the old build, whose code-split
 * files are gone: the next screen it opens can't load. Reloading once loads
 * the new build (the theme survives: hub-theme remembers Hub's mode). A
 * second failure within a minute shows the error as usual, so it never loops.
 */
import { STORAGE_PREFIX } from '../constants/plus';

const KEY = `${STORAGE_PREFIX}stale-build-reload`;
const AGAIN_AFTER_MS = 60_000;

/** A code-split file that couldn't be loaded (each browser words it its own way). */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Unable to preload CSS/i.test(
    message
  );
}

/** Reload to the new build, unless that was just tried. True when it reloads. */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < AGAIN_AFTER_MS) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite reports a failed preload of a screen's files: reload instead of failing. */
export function watchForNewBuild(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault();
  });
}
