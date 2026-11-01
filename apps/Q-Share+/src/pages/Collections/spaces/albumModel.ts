import { CARD_IMAGE_MAX_BYTES } from "../../../components/common/ShareArt";
import { fileKind, fileKindLabel } from "../../../utils/fileKind";
import type { ShareFile } from "../../FileContent/FileRow";
import type { SpaceItems, SpaceShare } from "./useSpaceItems";

/** A file of a share, as one picture of the album. */
export interface AlbumPhoto {
  /** Unique even when a share lists one file twice. */
  key: string;
  share: SpaceShare;
  file: ShareFile;
  /** The share's thumbnail, for its first picture only. */
  thumbnailUrl: string | null;
  /** Small enough for a tile to show by itself, once the node has it. */
  previewable: boolean;
}

/** Something drawn in the flow of pictures: a picture, or a share whose body is on its way. */
export type AlbumEntry = { type: "photo"; photo: AlbumPhoto } | { type: "pending"; key: string };

export type AlbumBlock =
  /** Shares with one picture each (and bodies still coming), side by side with no heading. */
  | { type: "run"; key: string; entries: AlbumEntry[] }
  /** A share with several pictures, under its own heading. */
  | { type: "section"; key: string; share: SpaceShare; photos: AlbumPhoto[] };

export interface AlbumLayout {
  blocks: AlbumBlock[];
  /** Every picture in the order drawn: what the lightbox walks through. */
  photos: AlbumPhoto[];
  /** Shares with no picture to show, deleted ones among them. */
  others: SpaceShare[];
}

/** The picture files of a share. A file list comes from someone's JSON, so anything odd in it is left out. */
export function albumPhotos(share: SpaceShare): AlbumPhoto[] {
  if (share.deleted || share.unreadable || share.unavailable) return [];
  const photos: AlbumPhoto[] = [];
  share.files.forEach((file, index) => {
    if (typeof file.name !== "string" || !file.name || typeof file.identifier !== "string" || !file.identifier) return;
    if (file.service !== undefined && file.service !== "FILE") return;
    if (fileKind(file.mimetype, file.filename) !== "image") return;
    const size = file.size ?? 0;
    photos.push({
      key: `${share.key}:${index}`,
      share,
      file,
      thumbnailUrl: photos.length === 0 ? share.thumbnailUrl : null,
      previewable: size > 0 && size <= CARD_IMAGE_MAX_BYTES,
    });
  });
  return photos;
}

/** This place's shares as an album: runs of single pictures, sections, and the shares without pictures. */
export function albumLayout(shares: SpaceShare[]): AlbumLayout {
  const blocks: AlbumBlock[] = [];
  const photos: AlbumPhoto[] = [];
  const others: SpaceShare[] = [];
  let run: AlbumEntry[] | null = null;
  const addToRun = (entry: AlbumEntry, key: string) => {
    if (!run) {
      run = [];
      blocks.push({ type: "run", key, entries: run });
    }
    run.push(entry);
  };
  for (const share of shares) {
    if (!share.loaded && !share.unavailable) {
      addToRun({ type: "pending", key: share.key }, share.key);
      continue;
    }
    const own = albumPhotos(share);
    photos.push(...own);
    if (own.length === 0) {
      others.push(share);
    } else if (own.length === 1) {
      addToRun({ type: "photo", photo: own[0] }, share.key);
    } else {
      run = null;
      blocks.push({ type: "section", key: share.key, share, photos: own });
    }
  }
  return { blocks, photos, others };
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** "3 photos, 1 other file": a section heading's small print. */
export function sectionSummary(share: SpaceShare, photos: number): string {
  const rest = share.files.length - photos;
  return plural(photos, "photo") + (rest > 0 ? `, ${plural(rest, "other file")}` : "");
}

/** What a share without pictures says under its title. */
export function otherShareNote(share: SpaceShare): string {
  if (share.deleted) return "Deleted by its publisher";
  if (share.unreadable) return "This share can't be read";
  if (share.unavailable) return "Not available right now";
  if (share.files.length === 0) return `No files, by ${share.user}`;
  const first = share.files[0];
  const kind = fileKindLabel(fileKind(first.mimetype, first.filename));
  const more = share.files.length - 1;
  return `${kind}${more > 0 ? ` and ${more} more` : ""}, by ${share.user}`;
}

const monthYear = (time: number) => new Date(time).toLocaleDateString(undefined, { month: "short", year: "numeric" });

/** The months the photos were shared in, or "" when it can't be known for all of them. */
export function albumDates(photos: AlbumPhoto[], items: Pick<SpaceItems, "hasMore" | "pending">): string {
  if (items.hasMore || items.pending > 0) return "";
  const times = photos.map((photo) => Number(photo.share.body?.created)).filter((time) => Number.isFinite(time) && time > 0);
  if (times.length === 0) return "";
  const from = monthYear(Math.min(...times));
  const to = monthYear(Math.max(...times));
  return from === to ? from : `${from} to ${to}`;
}

/** The hero's small line: how much is here, and when from. */
export function heroSummary(
  photos: AlbumPhoto[],
  items: Pick<SpaceItems, "hasMore" | "pending">,
  counts: { shares: number; folders: number }
): string {
  const parts: string[] = [];
  if (photos.length > 0) {
    const more = items.hasMore || items.pending > 0;
    parts.push(more ? `${photos.length}+ photos` : plural(photos.length, "photo"));
  } else if (counts.shares > 0) {
    parts.push(plural(counts.shares, "share"));
  }
  if (counts.folders > 0) parts.push(plural(counts.folders, "folder"));
  const dates = albumDates(photos, items);
  if (dates) parts.push(dates);
  return parts.join(" · ");
}

/** The picture a hero without a cover uses: a thumbnail if any share has one, else the first small picture. */
export function heroPhoto(photos: AlbumPhoto[]): AlbumPhoto | null {
  return photos.find((photo) => photo.thumbnailUrl) ?? photos.find((photo) => photo.previewable) ?? null;
}
