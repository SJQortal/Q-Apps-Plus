/**
 * Files on their way into a composer (the picker, a drop on the attach row
 * or on the editor), as the composers keep them. The extension comes from
 * the file's name first and then from its type, the order publishing uses
 * (NewMessage/NewThread build `filename` from the name's extension), so a
 * file whose type the browser doesn't know (.apk, .odp, an empty type) is not
 * flagged as having no extension when its name has one.
 */
import { extensionFromFilename, extensionFromMimeType } from "../../utils/fileExtension";

export interface ComposeFileItem {
  file: File;
  mimetype: string | null;
  extension: string | null;
}

export const extensionOfFile = (file: File): string | null =>
  extensionFromFilename(file.name) || extensionFromMimeType(file.type) || null;

export function composeItemsFromFiles(files: File[]): ComposeFileItem[] {
  return files.map(file => ({ file, mimetype: file.type || null, extension: extensionOfFile(file) }));
}

/** Splits files at a size limit: the ones to attach, and the names of those that are too big. */
export function withinSizeLimit(files: File[], maxBytes: number): { accepted: File[]; tooBig: string[] } {
  const accepted: File[] = [];
  const tooBig: string[] = [];
  files.forEach(file => (file.size > maxBytes ? tooBig.push(file.name) : accepted.push(file)));
  return { accepted, tooBig };
}
