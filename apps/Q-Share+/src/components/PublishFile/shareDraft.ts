/**
 * Pure helpers for the files a Share or Update dialog holds before they are
 * published. No React in here, so the rules (10 files, duplicates skipped,
 * 2 GB each) are unit-tested on their own.
 */
import type { FileRejection } from "react-dropzone";
import { fileMaxSize } from "../../constants/Misc";
import type { FileRef, ShareFileInput } from "../../utils/publishPayload";

export const MAX_FILES = 10;
export const MAX_FILE_SIZE_LABEL = `${fileMaxSize} GB`;

export interface DraftFile {
  /** Stable key for React lists and removal. */
  key: string;
  name: string;
  size: number;
  mimetype: string;
  /** A file picked on this device, still to publish. */
  file?: File;
  /** A file already on QDN (when updating a share); passed through unchanged. */
  existing?: FileRef;
}

export function draftFromFile(file: File): DraftFile {
  return { key: `new:${file.name}:${file.size}`, name: file.name, size: file.size, mimetype: file.type, file };
}

export function draftFromRef(ref: FileRef): DraftFile {
  return {
    key: `qdn:${ref.identifier}`,
    name: ref.filename,
    size: Number(ref.size) || 0,
    mimetype: ref.mimetype || "",
    existing: ref,
  };
}

export interface AddFilesResult {
  files: DraftFile[];
  /** Names that were already in the list (same name and size) and were skipped. */
  duplicates: string[];
  /** How many files did not fit under the 10-file limit. */
  overLimit: number;
}

/** Appends new files, skipping duplicates (same name and size) and anything past 10. */
export function addDraftFiles(current: DraftFile[], incoming: File[]): AddFilesResult {
  const files = [...current];
  const duplicates: string[] = [];
  let overLimit = 0;
  const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
  for (const file of incoming) {
    const signature = `${file.name}:${file.size}`;
    if (seen.has(signature)) {
      duplicates.push(file.name);
      continue;
    }
    if (files.length >= MAX_FILES) {
      overLimit += 1;
      continue;
    }
    seen.add(signature);
    files.push(draftFromFile(file));
  }
  return { files, duplicates, overLimit };
}

export function totalDraftSize(files: DraftFile[]): number {
  return files.reduce((sum, f) => sum + (f.size || 0), 0);
}

export function toPublishInputs(files: DraftFile[]): ShareFileInput[] {
  return files.map((f) => (f.existing ? { existing: f.existing } : { file: f.file as File }));
}

/** Short, sentence-case warnings for what a drop did not add. */
export function describeAddResult(result: AddFilesResult): string[] {
  const out: string[] = [];
  if (result.duplicates.length === 1) out.push(`${result.duplicates[0]} is already in the list.`);
  else if (result.duplicates.length > 1) out.push(`${result.duplicates.length} files were already in the list.`);
  if (result.overLimit > 0) {
    out.push(
      `A share holds up to ${MAX_FILES} files, so ${result.overLimit} ${result.overLimit === 1 ? "was" : "were"} not added.`
    );
  }
  return out;
}

/** Warnings for the files react-dropzone rejected, and whether one was too large. */
export function describeRejections(rejections: FileRejection[]): { warnings: string[]; tooLarge: boolean } {
  const tooLarge = rejections.filter((r) => r.errors.some((e) => e.code === "file-too-large"));
  const tooMany = rejections.some((r) => r.errors.some((e) => e.code === "too-many-files"));
  const warnings: string[] = [];
  if (tooLarge.length === 1) warnings.push(`${tooLarge[0].file.name} is over ${MAX_FILE_SIZE_LABEL} and was not added.`);
  else if (tooLarge.length > 1) warnings.push(`${tooLarge.length} files are over ${MAX_FILE_SIZE_LABEL} and were not added.`);
  if (tooMany) warnings.push(`Choose up to ${MAX_FILES} files at a time.`);
  return { warnings, tooLarge: tooLarge.length > 0 };
}

/** The message for a failed publish, the way the original app reads errors. */
export function publishErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error || fallback;
  const e = error as { error?: unknown; message?: unknown } | null;
  if (typeof e?.error === "string") return e.error || fallback;
  if (typeof e?.message === "string") return e.message || fallback;
  return fallback;
}
