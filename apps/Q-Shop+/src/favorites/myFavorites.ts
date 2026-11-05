/**
 * The signed-in name's favourites (favorites/model.ts): read once per
 * session with one search of its `q-store-fav…` resources, and changed at
 * once when a heart is tapped (optimistic), before Hub has published it.
 *
 * A change the node's search doesn't show yet (a publish takes a block or so
 * to be listed) is kept on this device for PENDING_MS, so a reload doesn't
 * undo a heart; it goes once the node agrees, or Hub says it was declined or
 * failed (then the heart goes back).
 */
import { PENDING_FAVORITES_STORAGE_KEY } from "../constants/plus";
import { errorMessage, isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { invalidateQdnSearches, searchQdnAll } from "../qdn/search";
import { FAV_BASE, buildFavoritePublish, buildUnfavoritePublish, favoriteOfRow, type Favorite } from "./model";

export const PENDING_MS = 30 * 60_000;
export const FAVORITE_PUBLISH_TIMEOUT_MS = 5 * 60_000;
const clock = () => Date.now();

interface Pending {
  on: boolean;
  fav: Favorite;
  at: number;
}

interface State {
  name: string;
  status: "idle" | "loading" | "ready" | "error";
  saved: Map<string, Favorite>;
  pending: Map<string, Pending>;
}

export interface FavoritesSnapshot {
  name: string;
  status: State["status"];
  /** Saved and pending together, newest change last. */
  list: Favorite[];
  ids: ReadonlySet<string>;
}

let state: State = { name: "", status: "idle", saved: new Map(), pending: new Map() };
let snapshot: FavoritesSnapshot = { name: "", status: "idle", list: [], ids: new Set() };
const listeners = new Set<() => void>();

function readPending(name: string): Map<string, Pending> {
  try {
    const all = JSON.parse(localStorage.getItem(PENDING_FAVORITES_STORAGE_KEY) ?? "{}") as Record<string, Record<string, Pending>>;
    const mine = all?.[name] ?? {};
    const now = clock();
    return new Map(Object.entries(mine).filter(([, p]) => p && typeof p.on === "boolean" && p.fav && now - p.at < PENDING_MS));
  } catch {
    return new Map();
  }
}

function writePending(): void {
  try {
    const all = JSON.parse(localStorage.getItem(PENDING_FAVORITES_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    if (state.pending.size > 0) all[state.name] = Object.fromEntries(state.pending);
    else delete all[state.name];
    if (Object.keys(all).length > 0) localStorage.setItem(PENDING_FAVORITES_STORAGE_KEY, JSON.stringify(all));
    else localStorage.removeItem(PENDING_FAVORITES_STORAGE_KEY);
  } catch {
    /* private mode: the change still shows in this tab */
  }
}

function publish(): void {
  const merged = new Map(state.saved);
  for (const [id, p] of state.pending) {
    if (p.on) merged.set(id, p.fav);
    else merged.delete(id);
  }
  snapshot = { name: state.name, status: state.status, list: [...merged.values()], ids: new Set(merged.keys()) };
  for (const listener of listeners) listener();
}

export function subscribeFavorites(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function favoritesSnapshot(): FavoritesSnapshot {
  return snapshot;
}

/** Reads the name's favourites, once per session (again with `fresh`). */
export async function loadFavorites(name: string, options: { fresh?: boolean } = {}): Promise<void> {
  if (!name) return;
  if (state.name !== name) state = { name, status: "idle", saved: new Map(), pending: readPending(name) };
  if (!options.fresh && (state.status === "ready" || state.status === "loading")) return;
  state = { ...state, status: "loading" };
  publish();
  try {
    const { rows } = await searchQdnAll(
      { service: "DOCUMENT", identifier: FAV_BASE, prefix: true, name, exactmatchnames: true, includemetadata: true },
      { pageSize: 100, maxPages: 5, fresh: options.fresh }
    );
    if (state.name !== name) return;
    const saved = new Map<string, Favorite>();
    for (const row of rows) {
      const fav = row.name === name ? favoriteOfRow(row) : null;
      if (fav) saved.set(fav.identifier, fav);
    }
    // A change the node shows now is no longer pending.
    const pending = new Map([...state.pending].filter(([id, p]) => p.on !== saved.has(id) && clock() - p.at < PENDING_MS));
    state = { ...state, status: "ready", saved, pending };
    writePending();
  } catch {
    if (state.name === name) state = { ...state, status: "error" };
  }
  publish();
}

export type FavoriteResult = { kind: "done" | "declined" | "unknown" } | { kind: "failed"; message: string };

/**
 * Adds or removes one: shown at once, then published (Hub asks to confirm).
 * A decline or a failure puts it back; a timeout keeps it (Hub may still
 * publish it) until the next read says.
 */
export async function setFavorite(
  name: string,
  fav: Favorite,
  on: boolean,
  send: (request: Record<string, unknown>, timeout: number) => Promise<unknown> = (r, t) => qortalRequestWithTimeout(r as never, t)
): Promise<FavoriteResult> {
  if (!name) return { kind: "failed", message: "Sign in with your Qortal name to keep favourites." };
  if (state.name !== name) state = { name, status: "idle", saved: new Map(), pending: readPending(name) };
  const before = state.pending.get(fav.identifier);
  state.pending.set(fav.identifier, { on, fav, at: clock() });
  writePending();
  publish();
  const putBack = () => {
    if (before) state.pending.set(fav.identifier, before);
    else state.pending.delete(fav.identifier);
    writePending();
    publish();
  };
  const request = on ? buildFavoritePublish({ name, fav, now: clock() }) : buildUnfavoritePublish({ name, identifier: fav.identifier });
  try {
    await send(request, FAVORITE_PUBLISH_TIMEOUT_MS);
  } catch (error) {
    if (isHubTimeout(error)) return { kind: "unknown" };
    putBack();
    if (isHubDecline(error)) return { kind: "declined" };
    return { kind: "failed", message: errorMessage(error, "Couldn't save the favourite. Try again.") };
  }
  // The counts and lists read again next time.
  invalidateQdnSearches((url) => url.includes(`identifier=${FAV_BASE}`));
  return { kind: "done" };
}

/** For tests. */
export function resetFavoritesMemory(): void {
  state = { name: "", status: "idle", saved: new Map(), pending: new Map() };
  snapshot = { name: "", status: "idle", list: [], ids: new Set() };
}
