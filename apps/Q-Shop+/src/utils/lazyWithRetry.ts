/**
 * React.lazy that survives an update (Simon's Hub, 2026-10-26: right after
 * republishing, Products showed "Something went wrong" and stayed there).
 * While a node is still preparing a newly published version it answers 503
 * for the app's files, so a page loaded on demand fails once. A failed load
 * is tried again after a moment; if it fails again, the app reloads itself
 * once (a fresh load gets the node's finished files). A second failure within
 * a minute is left to the error screen, so it can never reload in a loop.
 */
import { lazy, type ComponentType } from "react";

export const RETRY_AFTER_MS = 2_000;
const RELOADED_KEY = "qshopplus-chunk-reload";
const RELOAD_GAP_MS = 60_000;

/** A page's file couldn't be fetched (any browser's wording), not an error in its code. */
export function isLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS|Loading (CSS )?chunk/i.test(message);
}

/** Reloads the app unless it did so in the last minute (then false). */
export function reloadOnce(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
    if (now - last < RELOAD_GAP_MS) return false;
    sessionStorage.setItem(RELOADED_KEY, String(now));
  } catch {
    // Without storage there's no way to tell a loop from a first time: leave it to the error screen.
    return false;
  }
  window.location.reload();
  return true;
}

/** `load()`, tried again once after a moment, then reloading the app once; other errors as they are. */
export async function retryImport<T>(load: () => Promise<T>, wait = RETRY_AFTER_MS): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isLoadError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await load();
    } catch (again) {
      // Waits for the reload (Suspense keeps showing its fallback).
      if (isLoadError(again) && reloadOnce()) return new Promise<T>(() => {});
      throw again;
    }
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => retryImport(load));
}
