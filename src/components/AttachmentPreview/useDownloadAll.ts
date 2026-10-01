/**
 * "Download all": fetch, decrypt and SAVE_FILE each attachment of a message
 * one after the other (Hub shows one save dialog per file). Waits for a
 * resource that peers still hold with a polite 5 s check, backing off, and
 * can be cancelled between files.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchResourceStatus, isTerminalStatus, loadAttachment, saveAttachment, startResourceDownload } from '../../utils/attachmentCache';
import type { AttachmentRef } from '../../utils/attachmentMeta';
import { RESOURCE_POLL_MAX_MS, RESOURCE_POLL_MS } from './useResourceReady';

export interface DownloadAllProgress {
  active: boolean;
  /** 1-based index of the file being saved. */
  current: number;
  total: number;
  saved: number;
  failed: string[];
}

const idle: DownloadAllProgress = { active: false, current: 0, total: 0, saved: 0, failed: [] };

/** Resolves when the resource is READY; rejects on NOT_PUBLISHED, cancel or after `maxWaitMs`. */
export async function waitForResource(
  ref: AttachmentRef,
  options: { signal?: AbortSignal; maxWaitMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<void> {
  const { signal, maxWaitMs = 10 * 60 * 1000 } = options;
  const sleep = options.sleep || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = Date.now();
  let delay = RESOURCE_POLL_MS;
  let first = true;
  for (;;) {
    if (signal?.aborted) throw new Error('Cancelled');
    let status = '';
    try {
      status = (await fetchResourceStatus(ref)).status;
    } catch {
      status = '';
    }
    if (status === 'READY') return;
    if (status === 'NOT_PUBLISHED') throw new Error('This file was not published.');
    if (first) {
      first = false;
      await startResourceDownload(ref);
    }
    if (Date.now() - started > maxWaitMs) throw new Error('Peers did not deliver this file in time.');
    await sleep(delay);
    if (!isTerminalStatus(status) && (status === 'MISSING_DATA' || status === 'FAILED' || status === '')) {
      delay = Math.min(RESOURCE_POLL_MAX_MS, delay * 2);
    } else {
      delay = RESOURCE_POLL_MS;
    }
  }
}

export async function downloadAllSequential(
  attachments: AttachmentRef[],
  options: { signal?: AbortSignal; onProgress?: (progress: DownloadAllProgress) => void; sleep?: (ms: number) => Promise<void> } = {}
): Promise<DownloadAllProgress> {
  const progress: DownloadAllProgress = { active: true, current: 0, total: attachments.length, saved: 0, failed: [] };
  const report = () => options.onProgress?.({ ...progress, failed: [...progress.failed] });
  for (let i = 0; i < attachments.length; i++) {
    if (options.signal?.aborted) break;
    const ref = attachments[i];
    progress.current = i + 1;
    report();
    try {
      await waitForResource(ref, { signal: options.signal, sleep: options.sleep });
      const entry = await loadAttachment(ref);
      await saveAttachment(entry, ref);
      progress.saved += 1;
    } catch (error) {
      if (options.signal?.aborted) break;
      progress.failed.push(ref.originalFilename || ref.filename || ref.identifier);
    }
  }
  progress.active = false;
  report();
  return progress;
}

export function useDownloadAll(attachments: AttachmentRef[] | undefined | null) {
  const [progress, setProgress] = useState<DownloadAllProgress>(idle);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const run = useCallback(async () => {
    const list = (attachments || []).filter((a) => a?.identifier && a?.name && a?.service);
    if (!list.length || abortRef.current) return idle;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      return await downloadAllSequential(list, { signal: controller.signal, onProgress: setProgress });
    } finally {
      abortRef.current = null;
      setProgress((p) => ({ ...p, active: false }));
    }
  }, [attachments]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { progress, run, cancel };
}
