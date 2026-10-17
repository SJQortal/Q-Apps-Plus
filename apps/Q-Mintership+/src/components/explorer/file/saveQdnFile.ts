/**
 * Save File (Simon, 2026-10-17): hands a public QDN file to Hub's
 * SAVE_FILE, which asks the user where to keep it. It signs nothing,
 * publishes nothing and costs nothing; the Explorer's other Hub request is
 * OPEN_NEW_TAB. Adapted from Q-Share+ (components/common/FileElement.tsx,
 * saveFromNode), as docs/QORTAL.md pitfall 17 says:
 *
 * - desktop Hub, under 100 MB: the bytes as a blob, which Hub saves
 *   straight to Downloads;
 * - GO, and files of 100 MB or more: by `location`, so Hub streams the
 *   file from the node itself (in GO, unless its name has no letter or
 *   digit, which GO would save as a nameless file);
 * - a file inside a resource of several files: a blob (a `location` has no
 *   file path);
 * - a Hub that answers "Missing fields: blob" (it takes no `location`)
 *   gets the blob.
 *
 * Outside Hub (a browser, the dev server) it is an ordinary download link.
 * A "no" in Hub's prompt is not an error: it resolves 'declined'.
 */
import { hasQortalRequest, qortal } from '../../../qortal/client';
import { fileUrl, readFileBlob, type QdnResourceRef } from '../../../data/explorer/qdnFile';
import { errorMessage, isHubDecline } from '../../../utils/hubErrors';

export interface SavedFile {
  /** A file inside a resource of several files; null for the resource's own file. */
  filepath: string | null;
  filename: string;
  mime: string;
  size: number | null;
}

export type SaveResult = 'saved' | 'declined';

const STREAM_FROM_BYTES = 100 * 1024 * 1024;

const isGo = (userAgent: string) => /Android/i.test(userAgent);

/** False when GO would save it by `location` with no name (it keeps only A–Z, a–z, 0–9, space, _ and -). */
export function keepsNameByLocation(filename: string): boolean {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return /[A-Za-z0-9]/.test(stem.normalize('NFD'));
}

/** Whether Hub should fetch the file itself (`location`) rather than take a blob. */
export function savesByLocation(file: SavedFile, userAgent: string): boolean {
  if (file.filepath) return false;
  if (isGo(userAgent)) return keepsNameByLocation(file.filename);
  return file.size === null || file.size >= STREAM_FROM_BYTES;
}

/** An older Hub's "Missing fields: blob" (the field's name is never translated). */
function asksForBlob(error: unknown): boolean {
  return /\bblob\b/i.test(errorMessage(error, ''));
}

function downloadLink(ref: QdnResourceRef, file: SavedFile): void {
  const link = document.createElement('a');
  link.href = fileUrl(ref, file.filepath);
  link.download = file.filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function saveQdnFile(ref: QdnResourceRef, file: SavedFile): Promise<SaveResult> {
  if (!hasQortalRequest()) {
    downloadLink(ref, file);
    return 'saved';
  }
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  try {
    if (savesByLocation(file, userAgent)) {
      try {
        await qortal({
          action: 'SAVE_FILE',
          filename: file.filename,
          mimeType: file.mime,
          location: {
            service: ref.service,
            name: ref.name,
            identifier: ref.identifier ?? 'default',
          },
        });
        return 'saved';
      } catch (error) {
        // Only a Hub without `location` falls back: after a "no" a second prompt would be wrong.
        if (!asksForBlob(error)) throw error;
      }
    }
    const blob = await readFileBlob(ref, file.filepath, file.mime);
    await qortal({ action: 'SAVE_FILE', blob, filename: file.filename, mimeType: file.mime });
    return 'saved';
  } catch (error) {
    if (isHubDecline(error)) return 'declined';
    throw error;
  }
}
