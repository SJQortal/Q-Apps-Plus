import { alpha, darken, decomposeColor, getContrastRatio, lighten, recomposeColor, type Theme } from "@mui/material/styles";
import { fileKind, fileKindLabel } from "../../../utils/fileKind";
import type { ShareFile } from "../../FileContent/FileRow";
import type { SpaceShare } from "./useSpaceItems";

/** The kit bundles Inter only, so the book faces come from the device. */
export const LIBRARY_SERIF = ["\"Iowan Old Style\"", "\"Palatino Linotype\"", "Palatino", "\"Book Antiqua\"", "Georgia", "\"Noto Serif\"", "serif"].join(",");

export type LibraryView = "shelf" | "catalogue";
export type LibrarySort = "added" | "title";

const VIEW_KEY = "qshareplus-library-view";

export function readLibraryView(): LibraryView {
  try {
    return localStorage.getItem(VIEW_KEY) === "catalogue" ? "catalogue" : "shelf";
  } catch {
    return "shelf";
  }
}

export function writeLibraryView(view: LibraryView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // storage may be unavailable; the view still applies for this visit
  }
}

/** Books whose title or publisher holds every word typed. Ones still on their way have nothing to match yet. */
export function filterBooks(shares: SpaceShare[], query: string): SpaceShare[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return shares;
  return shares.filter((share) => {
    if (!share.title) return false;
    const text = `${share.title} ${share.user}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}

const titleOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** By title, with ones still on their way last; or as the collection holds them. */
export function sortBooks(shares: SpaceShare[], sort: LibrarySort): SpaceShare[] {
  if (sort === "added") return shares;
  return [...shares].sort((a, b) => {
    if (!a.title || !b.title) return a.title ? -1 : b.title ? 1 : 0;
    return titleOrder.compare(a.title, b.title);
  });
}

/** What a book's card says instead of offering its files, or null when all is well. */
export function bookStatus(share: SpaceShare): string | null {
  if (share.deleted) return "Deleted by its publisher";
  if (share.unreadable) return "This share can't be read";
  if (share.unavailable) return "Not available right now";
  return null;
}

/** A file's badge: its extension when it has a short one, else its kind. */
export function formatBadge(file: Pick<ShareFile, "filename" | "mimetype">): string {
  const match = /\.([a-z0-9]{1,5})$/i.exec(file.filename || "");
  return match ? match[1].toUpperCase() : fileKindLabel(fileKind(file.mimetype, file.filename));
}

/** The different badges of a share's files, documents first, as far as `max`. */
export function bookFormats(share: Pick<SpaceShare, "documents" | "files">, max = 3): string[] {
  const seen = new Set([...share.documents, ...share.files].map(formatBadge));
  return [...seen].slice(0, max);
}

export function totalBytes(files: ShareFile[]): number {
  return files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
}

export const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** `base` with `amount` of `tint` mixed in, solid. */
function mix(base: string, tint: string, amount: number): string {
  const a = decomposeColor(base).values;
  const b = decomposeColor(tint).values;
  const values = [0, 1, 2].map((i) => Math.round(a[i] * (1 - amount) + b[i] * amount));
  return recomposeColor({ type: "rgb", values: values as [number, number, number] });
}

/** What a colour with its own opacity looks like on `surface`. */
function flatten(color: string, surface: string): string {
  const { values, type } = decomposeColor(color);
  const opacity = type.endsWith("a") && values.length > 3 ? Number(values[3]) : 1;
  return mix(surface, recomposeColor({ type: "rgb", values: [values[0], values[1], values[2]] }), opacity);
}

/** `preferred` when it reads at 4.5:1 on `surface`, else `fallback`. */
function readable(preferred: string, fallback: string, surface: string): string {
  return getContrastRatio(flatten(preferred, surface), surface) >= 4.5 ? preferred : fallback;
}

export interface LibraryLook {
  /** The reading room's warm surface. */
  room: string;
  /** The pool of lamplight at the top of the room, over `room`. */
  lamp: string;
  /** Headings and titles on `room`. */
  ink: string;
  /** Quieter text on `room` and under the lamp, at 4.5:1. */
  quiet: string;
  /** The thin rules. */
  rule: string;
  /** The shelf board's top and its dark front. */
  board: string;
  boardEdge: string;
  /** The block of pages seen at a book's edge. */
  pages: string;
}

/** How strong the lamp is at its brightest. */
const LAMP = 0.06;

/** The library's colours, all drawn from the theme and warmed with its warning hue. */
export function libraryLook(theme: Theme): LibraryLook {
  const { background, warning, text, mode, common } = theme.palette;
  const paper = flatten(background.paper, flatten(background.default, mode === "dark" ? theme.palette.common.black : theme.palette.common.white));
  const room = mix(paper, warning.main, mode === "dark" ? 0.05 : 0.06);
  const board = mix(room, warning.main, mode === "dark" ? 0.3 : 0.34);
  const lit = mix(room, warning.main, LAMP);
  const paperWhite = mix(common.white, warning.main, 0.14);
  return {
    room,
    lamp: alpha(warning.main, LAMP),
    ink: readable(text.primary, mode === "dark" ? common.white : common.black, lit),
    quiet: readable(text.secondary, text.primary, lit),
    rule: mix(room, warning.main, 0.4),
    board,
    boardEdge: darken(board, 0.32),
    pages: mode === "dark" ? mix(paperWhite, room, 0.3) : paperWhite,
  };
}

function hash(seed: string): number {
  let value = 0;
  for (let i = 0; i < seed.length; i++) value = (value * 31 + seed.charCodeAt(i)) >>> 0;
  return value;
}

export interface BookCloth {
  cloth: string;
  /** The foil the title is stamped in, at 4.5:1 on the cloth. */
  foil: string;
}

/** A book's cloth: one of the theme's hues taken dark, the same for the same seed. */
export function bookCloth(theme: Theme, seed: string): BookCloth {
  const { primary, secondary, success, error, warning, info, common } = theme.palette;
  const hues = [primary.main, success.main, error.main, warning.main, info.main, secondary.main];
  let cloth = hues[hash(seed) % hues.length];
  for (let amount = 0.3; getContrastRatio(common.white, cloth) < 9 && amount < 1; amount += 0.08) {
    cloth = darken(hues[hash(seed) % hues.length], amount);
  }
  return { cloth, foil: readable(lighten(warning.main, 0.65), common.white, cloth) };
}

export interface ShelfSpine extends BookCloth {
  /** Share of the shelf's height, in percent. */
  height: number;
  /** Width in px. */
  width: number;
}

/** A few spines for a folder's little shelf: the same for the same folder, none alike. */
export function shelfSpines(theme: Theme, seed: string, count = 6): ShelfSpine[] {
  return Array.from({ length: count }, (_, i) => {
    const key = `${seed}/${i}`;
    const turn = hash(`${key}#`);
    return { ...bookCloth(theme, key), height: 70 + (turn % 31), width: 8 + ((turn >> 5) % 5) };
  });
}
