/**
 * Waits for a QDN resource to be READY on the local node.
 *
 * - one GET_QDN_RESOURCE_STATUS up front; when not READY, one
 *   GET_QDN_RESOURCE_PROPERTIES asks Core to fetch it from peers;
 * - then polls the status every 5 s through `usePolling`, which pauses while
 *   the tab is hidden, never overlaps calls, and backs off when a tick throws
 *   or when the status is MISSING_DATA/FAILED (so a message whose sender is
 *   offline costs one call every 40 s, not every 5 s, and nothing leaks on
 *   unmount: Bugs #4 and #6);
 * - `retry()` asks Core again and resumes a fast poll.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling';
import {
  fetchResourceStatus,
  isStalledStatus,
  isTerminalStatus,
  startResourceDownload,
  type ResourceStatus,
} from '../../utils/attachmentCache';
import type { AttachmentRef } from '../../utils/attachmentMeta';

export type ResourceRef = Pick<AttachmentRef, 'name' | 'service' | 'identifier'>;

export type ResourcePhase = 'idle' | 'checking' | 'waiting' | 'ready' | 'error';

export interface ResourceReadyState {
  phase: ResourcePhase;
  status: ResourceStatus | null;
  error: string | null;
}

export interface UseResourceReadyOptions {
  enabled?: boolean;
  intervalMs?: number;
  maxIntervalMs?: number;
  /** Consecutive failed status calls before giving up with an error. */
  maxFailures?: number;
}

export const RESOURCE_POLL_MS = 5000;
export const RESOURCE_POLL_MAX_MS = 40000;
const DEFAULT_MAX_FAILURES = 6;

const idle: ResourceReadyState = { phase: 'idle', status: null, error: null };

export function useResourceReady(ref: ResourceRef | null | undefined, options: UseResourceReadyOptions = {}) {
  const { enabled = true, intervalMs = RESOURCE_POLL_MS, maxIntervalMs = RESOURCE_POLL_MAX_MS, maxFailures = DEFAULT_MAX_FAILURES } = options;
  const [state, setState] = useState<ResourceReadyState>(idle);
  const [runKey, setRunKey] = useState(0);
  const failuresRef = useRef(0);
  const aliveRef = useRef(true);
  const key = ref ? `${ref.name}/${ref.service}/${ref.identifier}` : '';

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const applyStatus = useCallback(
    (status: ResourceStatus) => {
      if (!aliveRef.current) return;
      if (status.status === 'READY') {
        setState({ phase: 'ready', status, error: null });
      } else if (status.status === 'NOT_PUBLISHED') {
        setState({ phase: 'error', status, error: 'This file was not published, or the publisher removed it.' });
      } else {
        setState({ phase: 'waiting', status, error: null });
      }
    },
    []
  );

  // Initial check (and re-check on retry).
  useEffect(() => {
    if (!enabled || !ref) {
      setState(idle);
      return;
    }
    let cancelled = false;
    failuresRef.current = 0;
    setState((prev) => ({ phase: 'checking', status: prev.status, error: null }));
    void (async () => {
      try {
        const status = await fetchResourceStatus(ref);
        if (cancelled) return;
        if (!isTerminalStatus(status.status)) {
          await startResourceDownload(ref);
        }
        if (cancelled) return;
        applyStatus(status);
      } catch {
        if (cancelled) return;
        // Could not read the status: poll, which backs off on repeated failure.
        setState({ phase: 'waiting', status: null, error: null });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` stands in for `ref`, which callers often rebuild per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, runKey, applyStatus]);

  const refRef = useRef(ref);
  refRef.current = ref;

  usePolling(
    async () => {
      const current = refRef.current;
      if (!current) return;
      try {
        const status = await fetchResourceStatus(current);
        failuresRef.current = 0;
        applyStatus(status);
        // A stalled download backs the poll off (×2 up to maxIntervalMs).
        return !isStalledStatus(status.status);
      } catch (error) {
        failuresRef.current += 1;
        if (failuresRef.current >= maxFailures && aliveRef.current) {
          setState((prev) => ({ phase: 'error', status: prev.status, error: 'Could not reach the node to check this file.' }));
        }
        throw error;
      }
    },
    { intervalMs, maxIntervalMs, enabled: enabled && Boolean(ref) && state.phase === 'waiting' }
  );

  const retry = useCallback(() => {
    failuresRef.current = 0;
    setRunKey((k) => k + 1);
  }, []);

  return { ...state, retry };
}
