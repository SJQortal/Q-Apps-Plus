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
import { sizeWords } from '../../../rules/explorer/txWords';
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

/** Packing stops past this many bytes in all: the files are held in the page while packed. */
export const ZIP_ALL_MAX_BYTES = 200 * 1024 * 1024;

/** Files read from the node at once while packing. */
const PACK_LANES = 4;

export class TooBigToPackError extends Error {
  constructor(maxBytes = ZIP_ALL_MAX_BYTES) {
    super(`its files come to more than ${sizeWords(maxBytes)}, too much to pack into one ZIP here`);
    this.name = 'TooBigToPackError';
  }
}

/**
 * Save File on a resource of several files (Simon, 2026-10-17: "assembled
 * into a .zip and still be downloadable"): each file read from the node by
 * its path (4 at a time, each in the list's place in the archive), packed
 * into one ZIP (utils/zip.ts: stored, named as listed, folders kept) and
 * handed to Hub's SAVE_FILE as a blob, on desktop and in GO alike (a
 * `location` can't make a ZIP). `onProgress` hears how many are read;
 * `signal` stops it (the viewer closing). A file the node can't give, or
 * more than ZIP_ALL_MAX_BYTES in all, stops it with an error before Hub
 * is asked, so an error naming a file is never taken for a "no".
 */
export async function saveQdnFilesAsZip(
  ref: QdnResourceRef,
  files: readonly string[],
  zipName: string,
  options: {
    onProgress?: (read: number) => void;
    signal?: AbortSignal;
    /** Tests: a smaller limit than ZIP_ALL_MAX_BYTES. */
    maxBytes?: number;
  } = {}
): Promise<SaveResult> {
  const maxBytes = options.maxBytes ?? ZIP_ALL_MAX_BYTES;
  const { zipParts } = await import('../../../utils/zip');
  // One failure stops the other lanes too.
  const stop = new AbortController();
  const stopAll = () => stop.abort();
  options.signal?.addEventListener('abort', stopAll, { once: true });
  if (options.signal?.aborted) stop.abort();
  const parts: Uint8Array[] = new Array(files.length);
  let read = 0;
  let total = 0;
  // What the node says is coming, checked before a file is read whole.
  let announced = 0;
  let next = 0;
  const lane = async () => {
    while (next < files.length) {
      if (stop.signal.aborted) throw new DOMException('Stopped', 'AbortError');
      const index = next++;
      const response = await fetch(fileUrl(ref, files[index]), { signal: stop.signal });
      if (!response.ok)
        throw new Error(`your node answered ${response.status} for ${files[index]}`);
      const length = Number(response.headers.get('Content-Length'));
      if (Number.isFinite(length) && length > 0) {
        announced += length;
        if (announced > maxBytes) throw new TooBigToPackError(maxBytes);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Another lane failed meanwhile: no word of progress after it.
      if (stop.signal.aborted) throw new DOMException('Stopped', 'AbortError');
      total += bytes.length;
      if (total > maxBytes) throw new TooBigToPackError(maxBytes);
      parts[index] = bytes;
      read += 1;
      options.onProgress?.(read);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PACK_LANES, files.length) }, lane));
  } catch (error) {
    stop.abort();
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', stopAll);
  }
  // The Blob is made of the pieces themselves: the files once in it, never a third copy.
  const pieces = zipParts(files.map((name, i) => ({ name, data: parts[i] })));
  const blob = new Blob(pieces as BlobPart[], { type: 'application/zip' });
  parts.length = 0;
  if (!hasQortalRequest()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'saved';
  }
  try {
    await qortal({ action: 'SAVE_FILE', blob, filename: zipName, mimeType: 'application/zip' });
    return 'saved';
  } catch (error) {
    if (isHubDecline(error)) return 'declined';
    throw error;
  }
}

/** The ZIP's name: the resource's name, and its identifier when it has one ("AA Maps.zip", "AA Maps - beta.zip"). */
export function zipNameOf(ref: QdnResourceRef): string {
  const clean = (value: string) =>
    value
      .replace(/[\\/:*?"<>|]/g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();
  const stem = [clean(ref.name), ref.identifier ? clean(ref.identifier) : '']
    .filter(Boolean)
    .join(' - ')
    .slice(0, 100);
  return `${stem || 'files'}.zip`;
}
