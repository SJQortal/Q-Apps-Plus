import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useStore } from "react-redux";
import { setAddToDownloads, updateDownloads } from "../state/features/globalSlice";
import { RootState } from "../state/store";

/**
 * Download status machine. One entry per file identifier lives in
 * `state.global.downloads` as `{ name, service, identifier, properties, url?, status? }`.
 *
 *   (no entry)           the file has not been requested on this visit
 *     │ downloadVideo()  → GET_QDN_RESOURCE_PROPERTIES + GET_QDN_RESOURCE_URL ask the
 *     ▼                    node to start fetching; polling begins
 *   entry, no status     first GET_QDN_RESOURCE_STATUS not back yet ("Fetching from peers… 0%")
 *     ▼ every POLL_MS while the tab is visible
 *   NOT_STARTED / DOWNLOADING (percentLoaded 0–100)  chunks arriving from peers
 *     │ percent unchanged for STALL_MS
 *     ▼
 *   REFETCHING           (app-side status) polling pauses REFETCH_PAUSE_MS, then a
 *     │                  GET_QDN_RESOURCE_PROPERTIES call nudges the node and polling resumes
 *     ▼
 *   DOWNLOADED / BUILDING  every chunk is local; the node assembles the file
 *     ▼
 *   READY                polling stops; the row offers Save (SAVE_FILE)
 *
 * MISSING_DATA keeps polling (peers may still come online) and shows as stalled.
 * NOT_PUBLISHED, BLOCKED, UNSUPPORTED and BUILD_FAILED stop polling as failures and
 * can be started again. Six consecutive status errors stop polling too.
 * `retryDownload` resumes a paused or stopped poller. Every timer is cleared on unmount.
 */

export const POLL_MS = 5_000;
export const STALL_MS = 25_000;
export const REFETCH_PAUSE_MS = 25_000;
const MAX_FAILURES = 6;

export const FAILED_STATUSES = new Set(["NOT_PUBLISHED", "BLOCKED", "UNSUPPORTED", "BUILD_FAILED"]);
export const STALLED_STATUSES = new Set(["REFETCHING", "MISSING_DATA"]);
export const BUILDING_STATUSES = new Set(["DOWNLOADED", "BUILDING"]);

export type DownloadPhase = "idle" | "fetching" | "stalled" | "building" | "ready" | "failed";

/** Where a download entry is in the machine above. `hasEntry` false means it was never started. */
export function downloadPhase(status: string | undefined, hasEntry: boolean): DownloadPhase {
  if (!hasEntry) return "idle";
  if (!status) return "fetching";
  if (status === "READY") return "ready";
  if (FAILED_STATUSES.has(status)) return "failed";
  if (STALLED_STATUSES.has(status)) return "stalled";
  if (BUILDING_STATUSES.has(status)) return "building";
  return "fetching";
}

export function isFailedStatus(status: string | undefined): boolean {
  return Boolean(status && FAILED_STATUSES.has(status));
}

/** Short status line for rows and the downloads panel. */
export function downloadStatusText(status: string | undefined, percent: number, hasEntry = true): string {
  switch (downloadPhase(status, hasEntry)) {
    case "idle":
      return "Not fetched";
    case "ready":
      return "Ready to save";
    case "building":
      return "Building file…";
    case "stalled":
      return status === "MISSING_DATA" ? `Waiting for peers… ${percent}%` : `Stalled, retrying… ${percent}%`;
    case "failed":
      if (status === "NOT_PUBLISHED") return "Not found on the network";
      if (status === "BUILD_FAILED") return "Could not build the file";
      if (status === "BLOCKED") return "Publisher is blocked";
      return "This file type is not supported";
    default:
      return `Fetching from peers… ${percent}%`;
  }
}

interface Props {
  children: React.ReactNode;
}

export interface IDownloadVideoParams {
  name: string;
  service: string;
  identifier: string;
  properties: any;
}

export interface IResourceRef {
  name: string;
  service: string;
  identifier: string;
}

interface MyContextInterface {
  downloadVideo: (params: IDownloadVideoParams) => void;
  /** Nudge a stalled or stopped download without adding a new entry. */
  retryDownload: (params: IResourceRef) => void;
}

const defaultValues: MyContextInterface = {
  downloadVideo: () => {},
  retryDownload: () => {},
};
export const MyContext = React.createContext<MyContextInterface>(defaultValues);

interface Poller {
  stop: () => void;
  nudge: () => void;
}

const DownloadWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const pollers = useRef(new Map<string, Poller>());

  useEffect(() => {
    const active = pollers.current;
    return () => {
      active.forEach((p) => p.stop());
      active.clear();
    };
  }, []);

  const fetchResource = useCallback(async ({ name, service, identifier }: IResourceRef) => {
    try {
      await qortalRequest({ action: "GET_QDN_RESOURCE_PROPERTIES", name, service, identifier });
    } catch {
      /* the status poll reports the outcome */
    }
  }, []);

  const fetchVideoUrl = useCallback(
    async ({ name, service, identifier }: IResourceRef) => {
      try {
        fetchResource({ name, service, identifier });
        const url = await qortalRequest({ action: "GET_QDN_RESOURCE_URL", service, name, identifier });
        if (url) dispatch(updateDownloads({ name, service, identifier, url }));
      } catch {
        /* the status poll reports the outcome */
      }
    },
    [dispatch, fetchResource]
  );

  const startPolling = useCallback(
    ({ name, service, identifier }: IResourceRef) => {
      pollers.current.get(identifier)?.stop();
      let isCalling = false;
      let paused = false;
      let percentLoaded = -1;
      let stalledFor = 0;
      let failures = 0;
      let pauseTimer: ReturnType<typeof setTimeout> | null = null;

      const setStatus = (status: any) => dispatch(updateDownloads({ name, service, identifier, status }));

      const stop = () => {
        clearInterval(intervalId);
        if (pauseTimer) clearTimeout(pauseTimer);
        pauseTimer = null;
        if (pollers.current.get(identifier)?.stop === stop) pollers.current.delete(identifier);
      };

      const nudge = () => {
        if (pauseTimer) clearTimeout(pauseTimer);
        pauseTimer = null;
        paused = false;
        stalledFor = 0;
        fetchResource({ name, service, identifier });
      };

      const intervalId = setInterval(async () => {
        if (isCalling || paused) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        isCalling = true;
        try {
          const res = await qortalRequest({ action: "GET_QDN_RESOURCE_STATUS", name, service, identifier });
          if (!res) return;
          failures = 0;
          const status: string | undefined = res.status;
          if (status === "READY" || isFailedStatus(status)) {
            setStatus(res);
            stop();
            return;
          }
          const percent = typeof res.percentLoaded === "number" ? res.percentLoaded : null;
          if (percent !== null && !BUILDING_STATUSES.has(status ?? "")) {
            if (percent === percentLoaded && percent < 100) stalledFor += POLL_MS;
            else stalledFor = 0;
            percentLoaded = percent;
            if (stalledFor >= STALL_MS) {
              // Nothing arrived for a while: show it, pause, then ask the node again.
              stalledFor = 0;
              paused = true;
              setStatus({ ...res, status: "REFETCHING" });
              pauseTimer = setTimeout(() => {
                pauseTimer = null;
                paused = false;
                fetchResource({ name, service, identifier });
              }, REFETCH_PAUSE_MS);
              return;
            }
          }
          setStatus(res);
        } catch {
          failures += 1;
          if (failures >= MAX_FAILURES) stop();
        } finally {
          isCalling = false;
        }
      }, POLL_MS);

      pollers.current.set(identifier, { stop, nudge });
    },
    [dispatch, fetchResource]
  );

  const downloadVideo = useCallback(
    ({ name, service, identifier, properties }: IDownloadVideoParams) => {
      const existing = store.getState().global?.downloads?.[identifier];
      if (existing && !isFailedStatus(existing?.status?.status)) return;
      dispatch(setAddToDownloads({ name, service, identifier, properties }));
      startPolling({ name, service, identifier });
      fetchVideoUrl({ name, service, identifier });
    },
    [dispatch, fetchVideoUrl, startPolling, store]
  );

  const retryDownload = useCallback(
    ({ name, service, identifier }: IResourceRef) => {
      const poller = pollers.current.get(identifier);
      if (poller) {
        poller.nudge();
        return;
      }
      startPolling({ name, service, identifier });
      fetchVideoUrl({ name, service, identifier });
    },
    [fetchVideoUrl, startPolling]
  );

  const value = useMemo(() => ({ downloadVideo, retryDownload }), [downloadVideo, retryDownload]);

  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
};

export default DownloadWrapper;
