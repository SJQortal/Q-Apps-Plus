/**
 * One file of a ready QDN resource, read just enough to show it: its size
 * and type (a one-byte read), then its first bytes, which settle its kind
 * (rules/explorer/qdnFiles.ts resolveFileKind). A file that is text, or
 * may be, is read up to TEXT_MAX_BYTES at once (the head and the text in
 * one read); anything else up to HEAD_BYTES, the rest left to its view
 * (a picture, a video or a sound streams from its URL; a PDF is read
 * whole; a ZIP from its end; binary data shows its head as hex).
 */
import { useEffect, useState } from 'react';
import {
  fileUrl,
  probeFile,
  readFileStart,
  resourceKey,
  type QdnResourceRef,
} from '../../../data/explorer/qdnFile';
import {
  declaredKind,
  resolveFileKind,
  TEXT_KINDS,
  type FileKind,
} from '../../../rules/explorer/qdnFiles';

/** Bytes read to tell what a file is. */
export const HEAD_BYTES = 4 * 1024;
/** A text file shows at most its first 512 KB. */
export const TEXT_MAX_BYTES = 512 * 1024;

export interface FileView {
  kind: FileKind;
  mime: string;
  /** Its size in bytes, when the node said. */
  size: number | null;
  /** Its URL on the node (for <img>, <video>, <audio> and a download link). */
  url: string;
  /** Its first bytes: all of a text up to TEXT_MAX_BYTES, else HEAD_BYTES. */
  head: Uint8Array;
  /** More of the file follows `head`. */
  more: boolean;
}

export type FileViewState =
  { phase: 'loading' } | { phase: 'ready'; file: FileView } | { phase: 'error'; error: unknown };

export function useFileView(
  ref: QdnResourceRef | null,
  options: {
    /** A file inside a resource of several files. */
    filepath: string | null;
    /** The file's name and type as its publisher gave them. */
    filename: string | null;
    mimeType: string | null;
    enabled: boolean;
  }
): FileViewState & { retry: () => void } {
  const [state, setState] = useState<FileViewState>({ phase: 'loading' });
  const [run, setRun] = useState(0);
  const key = ref ? resourceKey(ref) : '';
  const { filepath, filename, mimeType, enabled } = options;

  useEffect(() => {
    if (!enabled || !ref) return;
    let stopped = false;
    setState({ phase: 'loading' });
    void (async () => {
      try {
        const probe = await probeFile(ref, filepath);
        const facts = {
          service: ref.service,
          filename,
          mimeType: mimeType ?? probe.contentType,
        };
        const declared = declaredKind(facts);
        // Maybe text: read as much as a text shows; otherwise only enough to tell.
        const textLike = declared === null || TEXT_KINDS.has(declared);
        let read = await readFileStart(
          ref,
          filepath,
          textLike ? TEXT_MAX_BYTES : HEAD_BYTES,
          probe.size
        );
        const found = resolveFileKind({ ...facts, head: read.bytes.subarray(0, HEAD_BYTES) });
        if (!textLike && TEXT_KINDS.has(found.kind) && read.truncated)
          read = await readFileStart(ref, filepath, TEXT_MAX_BYTES, probe.size);
        if (stopped) return;
        setState({
          phase: 'ready',
          file: {
            kind: found.kind,
            mime: found.mime,
            size: probe.size,
            url: fileUrl(ref, filepath),
            head: read.bytes,
            more: read.truncated,
          },
        });
      } catch (error) {
        if (!stopped) setState({ phase: 'error', error });
      }
    })();
    return () => {
      stopped = true;
    };
    // The ref is read through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, filepath, filename, mimeType, run]);

  return { ...state, retry: () => setRun((value) => value + 1) };
}
