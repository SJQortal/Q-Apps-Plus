/**
 * An attachment's decrypted bytes for a component: waits for the resource
 * (useResourceReady), then fetches + decrypts once through the session cache
 * (utils/attachmentCache). A second component asking for the same identifier
 * gets the cached Blob with zero Qortal calls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCachedAttachment,
  loadAttachment,
  saveAttachment,
  type CachedAttachment,
} from '../../utils/attachmentCache';
import type { AttachmentRef } from '../../utils/attachmentMeta';
import { useResourceReady } from './useResourceReady';

export type AttachmentPhase = 'idle' | 'fetching' | 'decrypting' | 'ready' | 'error';

export interface UseAttachmentOptions {
  /** Start fetching on mount instead of waiting for `start()`. */
  auto?: boolean;
}

export function useAttachment(ref: AttachmentRef | null | undefined, options: UseAttachmentOptions = {}) {
  const { auto = false } = options;
  const identifier = ref?.identifier || '';
  const [started, setStarted] = useState<boolean>(auto);
  const [entry, setEntry] = useState<CachedAttachment | null>(() => (identifier ? getCachedAttachment(identifier) || null : null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const refRef = useRef(ref);
  refRef.current = ref;

  // A new attachment: pick up its cached bytes, or reset.
  useEffect(() => {
    setEntry(identifier ? getCachedAttachment(identifier) || null : null);
    setLoadError(null);
    setDecrypting(false);
    setStarted(auto);
  }, [identifier, auto]);

  const needsResource = started && !entry && Boolean(ref);
  const resource = useResourceReady(needsResource ? ref : null, { enabled: needsResource });

  useEffect(() => {
    if (!needsResource || resource.phase !== 'ready') return;
    const current = refRef.current;
    if (!current) return;
    let cancelled = false;
    setDecrypting(true);
    setLoadError(null);
    loadAttachment(current)
      .then((loaded) => {
        if (cancelled) return;
        setEntry(loaded);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error && error.message ? error.message : 'This file could not be opened.');
      })
      .finally(() => {
        if (!cancelled) setDecrypting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsResource, resource.phase, identifier, loadKey]);

  const start = useCallback(() => setStarted(true), []);

  const retry = useCallback(() => {
    setLoadError(null);
    setStarted(true);
    if (resource.phase === 'ready') setLoadKey((k) => k + 1);
    else resource.retry();
  }, [resource]);

  /** Resolves false when the user declined Hub's save prompt (not an error). */
  const save = useCallback(async (): Promise<boolean> => {
    const current = refRef.current;
    let target = entry;
    if (!target && current) target = await loadAttachment(current);
    if (!target) throw new Error('Nothing to save yet.');
    return saveAttachment(target, current || undefined);
  }, [entry]);

  const phase: AttachmentPhase = entry
    ? 'ready'
    : loadError || resource.phase === 'error'
      ? 'error'
      : decrypting
        ? 'decrypting'
        : started
          ? 'fetching'
          : 'idle';

  const status = resource.status;
  return useMemo(
    () => ({
      phase,
      entry,
      status: status?.status || '',
      percent: status?.percentLoaded,
      error: loadError || resource.error,
      start,
      retry,
      save,
    }),
    [phase, entry, status, loadError, resource.error, start, retry, save]
  );
}
