import { heldShare, type HeldShares } from "../../../state/features/fileSlice";
import { fileKind } from "../../../utils/fileKind";
import type { CollectionItem, CollectionSpaceId } from "../../../utils/collections";

/** One kind makes a collection "mostly" that from this share of its files. */
const MOSTLY = 0.6;
/** Shares looked at for a suggestion: enough to tell, and cheap to do while the dialog is open. */
const SAMPLE = 40;

interface FileLike {
  mimetype?: string;
  filename?: string;
}

/** The space that suits these files, or null when no kind stands out. */
export function suggestSpace(files: FileLike[]): CollectionSpaceId | null {
  const counts: Record<CollectionSpaceId, number> = { music: 0, cinema: 0, library: 0, album: 0 };
  for (const file of files) {
    const kind = fileKind(file?.mimetype, file?.filename);
    if (kind === "audio") counts.music++;
    else if (kind === "video") counts.cinema++;
    else if (kind === "image") counts.album++;
    else if (kind === "pdf" || kind === "document" || kind === "text") counts.library++;
  }
  const [best, count] = (Object.entries(counts) as [CollectionSpaceId, number][]).sort((a, b) => b[1] - a[1])[0];
  return count > 0 && count / files.length >= MOSTLY ? best : null;
}

/** The suggestion from the share bodies already held: it never fetches one. */
export function suggestSpaceForItems(held: HeldShares, items: CollectionItem[]): CollectionSpaceId | null {
  const files = items.slice(0, SAMPLE).flatMap((item) => {
    const body = heldShare(held, item.name, item.identifier) as { files?: unknown } | undefined;
    return Array.isArray(body?.files) ? (body.files as FileLike[]) : [];
  });
  return files.length > 0 ? suggestSpace(files) : null;
}
