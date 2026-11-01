import { useCallback, useEffect, useMemo, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { thumbnailUrl } from "../../../components/common/ShareArt";
import { previewKind } from "../../../components/common/FilePreview";
import { shareTitleFromIdentifier, useFetchFiles } from "../../../hooks/useFetchFiles";
import { heldShare, shareKey, type Video } from "../../../state/features/fileSlice";
import type { Track } from "../../../state/features/playerSlice";
import type { RootState } from "../../../state/store";
import { fileKind } from "../../../utils/fileKind";
import { shareThumbnail, type ShareThumbnail } from "../../../utils/publishPayload";
import { QDN_PAGE } from "../../../utils/qdnSearch";
import { shareTracks } from "../../FileContent/PlaylistCard";
import type { ShareFile } from "../../FileContent/FileRow";

/** One share of a collection, as far as its body has landed. */
export interface SpaceShare {
  /** shareKey: unique per publisher and identifier, for React keys. */
  key: string;
  /** Pass this to onMove, onRemove and FileList. */
  row: Video;
  /** The publisher's name. */
  user: string;
  identifier: string;
  /** "" only while the body is still on its way (draw a skeleton). */
  title: string;
  /** The body as held, undefined until it lands, for anything else in it (category, created…). */
  body: Video | undefined;
  /** The body has landed. */
  loaded: boolean;
  /** Not landed after its tries. Its page still opens, and has Retry. */
  unavailable: boolean;
  /** Replaced by a delete marker: say "Deleted by its publisher". */
  deleted: boolean;
  /** A body that isn't a share: say "This share can't be read". */
  unreadable: boolean;
  files: ShareFile[];
  thumbnail: ShareThumbnail | null;
  /** Without async=true: hand it to useQdnImage, never straight to an img. */
  thumbnailUrl: string | null;
  /** Audio the player can play, in the share's order, for usePlaylistControls. */
  audio: Track[];
  /** Video the app can play inline. */
  videos: ShareFile[];
  images: ShareFile[];
  /** PDFs, text and office or ebook files. */
  documents: ShareFile[];
}

/** What useSpaceItems returns: the shares shown so far, and how to show more. */
export interface SpaceItems {
  /** The first pages of this place's shares, in the collection's order, hidden names left out. */
  shares: SpaceShare[];
  /** All this place's shares, hidden names left out. Bodies past `shares` aren't fetched. */
  total: number;
  /** Shares in `shares` whose body hasn't landed yet. */
  pending: number;
  hasMore: boolean;
  /** Show and load the next page. */
  showMore: () => void;
}

const DOCUMENT_KINDS = new Set(["pdf", "text", "document"]);

/** A share's row and held body in the shape spaces read. Pure, for tests. */
export function toSpaceShare(row: Video, body: Video | undefined, unavailable: boolean): SpaceShare {
  const gone = body?.isValid === false;
  const raw = (body as { files?: unknown } | undefined)?.files;
  const files = Array.isArray(raw) ? (raw as ShareFile[]).filter((file) => file && typeof file === "object") : [];
  const held = body?.title ?? "";
  // Some deletes also retitle the share "deleted".
  const title = gone && /^deleted$/i.test(held) ? "" : held;
  const thumbnail = gone ? null : shareThumbnail(body);
  return {
    key: shareKey(row.user, row.id),
    row,
    user: row.user,
    identifier: row.id,
    title: title || (body || unavailable ? shareTitleFromIdentifier(row.id) : ""),
    body,
    loaded: Boolean(body),
    unavailable: !body && unavailable,
    deleted: gone && Boolean(body?.deleted),
    unreadable: gone && !body?.deleted,
    files,
    thumbnail,
    thumbnailUrl: thumbnail ? thumbnailUrl(thumbnail) : null,
    audio: shareTracks(files),
    videos: files.filter((file) => previewKind(file) === "video"),
    images: files.filter((file) => fileKind(file.mimetype, file.filename) === "image"),
    documents: files.filter((file) => DOCUMENT_KINDS.has(fileKind(file.mimetype, file.filename))),
  };
}

/**
 * This place's shares for a space, a page at a time: only the rows shown have
 * their bodies queued, through the same queue as every list (nothing already
 * held or queued is fetched again, and no search is made). A body landing
 * re-renders the space.
 */
export function useSpaceItems(rows: Video[], pageSize: number = QDN_PAGE): SpaceItems {
  const [shown, setShown] = useState(pageSize);
  const { queueBodies } = useFetchFiles();
  const visible = useMemo(() => rows.slice(0, shown), [rows, shown]);

  // As on the standard page: shares already marked unavailable are left alone.
  useEffect(() => {
    queueBodies(visible, false);
  }, [visible, queueBodies]);

  const bodies = useSelector(
    (state: RootState) => visible.map((row) => heldShare(state.file, row.user, row.id)),
    shallowEqual
  );
  const missing = useSelector(
    (state: RootState) => visible.map((row) => Boolean(state.file.unavailableFiles[shareKey(row.user, row.id)])),
    shallowEqual
  );
  const shares = useMemo(
    () => visible.map((row, index) => toSpaceShare(row, bodies[index], missing[index])),
    [visible, bodies, missing]
  );
  const showMore = useCallback(() => setShown((count) => count + pageSize), [pageSize]);

  return {
    shares,
    total: rows.length,
    pending: shares.filter((share) => !share.loaded && !share.unavailable).length,
    hasMore: rows.length > shown,
    showMore,
  };
}
