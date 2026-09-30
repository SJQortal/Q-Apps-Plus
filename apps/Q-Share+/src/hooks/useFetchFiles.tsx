import React from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  addFiles,
  addToHashMap,
  markUnavailable,
  setCountNewFiles,
  upsertFiles,
  upsertFilesBeginning,
  Video,
  upsertFilteredFiles,
} from "../state/features/fileSlice.ts";
import { setIsLoadingGlobal, setUserAvatarHash } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { fetchAndEvaluateVideos } from "../utils/fetchVideos";
import { QSHARE_FILE_BASE } from "../constants/Identifiers.ts";
import { queue } from "../utils/queue";
import { getCategoriesFetchString } from "../components/common/CategoryList/CategoryList.tsx";
import { QDN_PAGE, QdnResourceSummary, searchQdn } from "../utils/qdnSearch";
import { isNameHidden } from "../utils/settings";

/**
 * Q-Share writes the category ids at the start of the QDN description,
 * "**cat:4;sub:421**…", so a row can show its category icon before the body lands.
 */
export function categoriesFromQdnDescription(description?: string): Record<string, string> {
  const head = description?.match(/^\*\*([^*]*)\*\*/)?.[1];
  const out: Record<string, string> = {};
  for (const part of head?.split(";") ?? []) {
    const [key, value] = part.split(":");
    if (!value) continue;
    if (key === "cat") out.category = value;
    else if (key === "sub") out.subcategory = value;
    else if (/^sub\d+$/.test(key)) out[`subcategory${key.slice(3)}`] = value;
  }
  return out;
}

/**
 * A readable title for a share with no QDN metadata, from its identifier:
 * "qshare_file_qorterminator-2-visual_WiRAxt_metadata" → "Qorterminator 2 visual".
 */
export function shareTitleFromIdentifier(identifier: string): string {
  const slug = identifier
    .replace(/^qshare_file_/, "")
    .replace(/_metadata$/, "")
    .replace(/_[^_]*$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Untitled share";
}

/**
 * A list row built from a search result (searched with metadata, so it has a
 * title and date at once); the JSON body arrives later via getFile.
 */
export function summaryToVideo(video: QdnResourceSummary): Video {
  return {
    title: video?.metadata?.title,
    service: video?.service,
    category: video?.metadata?.category,
    categoryName: video?.metadata?.categoryName,
    tags: video?.metadata?.tags || [],
    description: video?.metadata?.description,
    created: video?.created,
    updated: video?.updated,
    user: video.name,
    videoImage: "",
    id: video.identifier,
    ...categoriesFromQdnDescription(video?.metadata?.description),
  };
}

/** Share ids whose body is queued or being fetched, so a list never queues one twice. */
const bodiesInFlight = new Set<string>();

/** The search row says the share changed after the copy in the hash map. */
const updatedSince = (row: { updated?: number | string } | undefined, held: Video) =>
  Boolean(row?.updated && (!held.updated || row.updated > held.updated));

/**
 * Fetch one share's JSON body into the hash map, with two more tries through
 * the queue. After the last one the share is marked unavailable, so its row
 * says so instead of loading forever (a MISSING_DATA body answers "Data
 * unavailable" after ~15 s, an empty one "Empty response").
 */
async function fetchShareBody(
  dispatch: (action: unknown) => unknown,
  getState: () => RootState,
  user: string,
  videoId: string,
  content: any,
  attempt = 0
): Promise<void> {
  // While this waited in the queue, the share page (a row opens before its
  // body lands), a collection or another list may have fetched it.
  const held = getState().file.hashMapFiles[videoId];
  if (held && !updatedSince(content, held)) {
    bodiesInFlight.delete(videoId);
    return;
  }
  try {
    const res = await fetchAndEvaluateVideos({ user, videoId, content });
    bodiesInFlight.delete(videoId);
    dispatch(addToHashMap(res));
  } catch {
    if (attempt < 2) {
      queue.push(() => fetchShareBody(dispatch, getState, user, videoId, content, attempt + 1));
    } else {
      bodiesInFlight.delete(videoId);
      dispatch(markUnavailable(videoId));
    }
  }
}

/**
 * `files` without the shares whose body turned out to be deleted or unreadable
 * (see isShareBody): Home and profile lists leave them out. The selector
 * returns a string of ids, so a body landing re-renders the caller only when
 * that set changes.
 */
export function useListedFiles(files: Video[]): Video[] {
  const gone = useSelector((state: RootState) => {
    let ids = "";
    for (const file of files) {
      if (state.file.hashMapFiles[file.id]?.isValid === false) ids += `${file.id}\n`;
    }
    return ids;
  });
  return React.useMemo(() => {
    if (!gone) return files;
    const drop = new Set(gone.split("\n"));
    return files.filter((file) => !drop.has(file.id));
  }, [files, gone]);
}

export const useFetchFiles = () => {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const hashMapFiles = useSelector((state: RootState) => state.file.hashMapFiles);
  const videos = useSelector((state: RootState) => state.file.files);
  const filteredVideos = useSelector((state: RootState) => state.file.filteredFiles);

  const checkAndUpdateFile = React.useCallback(
    (video: Video) => {
      const existingVideo = hashMapFiles[video.id];
      if (!existingVideo) return true;
      // Re-fetch when the search says the share was updated after the copy we hold.
      return Boolean(
        video?.updated && (!existingVideo?.updated || video.updated > existingVideo.updated)
      );
    },
    [hashMapFiles]
  );

  const getAvatar = React.useCallback(async (author: string) => {
    try {
      const url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: author,
        service: "THUMBNAIL",
        identifier: "qortal_avatar",
      });
      dispatch(setUserAvatarHash({ name: author, url }));
    } catch (error) {
      /* avatar is optional */
    }
  }, [dispatch]);

  const getFile = React.useCallback(
    (user: string, videoId: string, content: any) => fetchShareBody(dispatch, store.getState, user, videoId, content),
    [dispatch, store]
  );

  /**
   * Queue the bodies a list still needs. Rows of hidden names are never shown,
   * so they are skipped: one name can fill 90% of a Latest page. A search
   * retries shares marked unavailable; `retryUnavailable: false` (coming back
   * to a list) leaves them alone.
   */
  const queueBodies = React.useCallback(
    (rows: Video[], retryUnavailable = true) => {
      const { unavailableFiles } = store.getState().file;
      for (const content of rows) {
        if (!content.user || !content.id || isNameHidden(content.user)) continue;
        if (bodiesInFlight.has(content.id) || !checkAndUpdateFile(content)) continue;
        if (!retryUnavailable && unavailableFiles[content.id]) continue;
        bodiesInFlight.add(content.id);
        queue.push(() => getFile(content.user, content.id, content));
      }
    },
    [checkAndUpdateFile, getFile, store]
  );

  const getNewFiles = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true));
      const responseData = await searchQdn(
        { service: "DOCUMENT", query: QSHARE_FILE_BASE, limit: QDN_PAGE },
        { fresh: true }
      );
      const latestVideo = videos[0];
      if (!latestVideo) return;
      const findVideo = responseData.findIndex((item) => item?.identifier === latestVideo?.id);
      let fetchAll = responseData;
      let willFetchAll = true;
      if (findVideo !== -1) {
        willFetchAll = false;
        fetchAll = responseData.slice(0, findVideo);
      }
      const structureData = fetchAll.map(summaryToVideo);
      if (!willFetchAll) dispatch(upsertFilesBeginning(structureData));
      if (willFetchAll) dispatch(addFiles(structureData));
      setTimeout(() => {
        dispatch(setCountNewFiles(0));
      }, 1000);
      queueBodies(structureData);
    } catch (error) {
      /* the list keeps what it has */
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [videos, dispatch, queueBodies]);

  const getFiles = React.useCallback(
    async (filters = {}, reset?: boolean, resetFilers?: boolean, limit?: number, isCurrent?: () => boolean) => {
      const { name = "", categories = [], keywords = "", sort = "newest", following = false }: any = resetFilers ? {} : filters;
      const offset = reset ? 0 : videos.length;
      const responseData = await searchQdn(
        {
          service: "DOCUMENT",
          identifier: QSHARE_FILE_BASE,
          name: name || undefined,
          description: categories.length > 0 ? getCategoriesFetchString(categories) : undefined,
          query: keywords || undefined,
          offset,
          limit: limit || QDN_PAGE,
          reverse: sort !== "oldest",
          followedonly: Boolean(following),
          includemetadata: true,
        },
        { fresh: Boolean(reset) }
      );
      const structureData = responseData.map(summaryToVideo);
      // Superseded by a newer search while waiting: leave the list alone.
      if (isCurrent && !isCurrent()) return structureData.length;
      if (reset) dispatch(addFiles(structureData));
      else dispatch(upsertFiles(structureData));
      queueBodies(structureData);
      return structureData.length;
    },
    [videos, dispatch, queueBodies]
  );

  const getFilesFiltered = React.useCallback(
    async (filterValue: string) => {
      try {
        const offset = filteredVideos.length;
        const replaceSpacesWithUnderscore = filterValue.replace(/ /g, "_");
        const responseData = await searchQdn({
          service: "DOCUMENT",
          query: replaceSpacesWithUnderscore,
          identifier: QSHARE_FILE_BASE,
          limit: 10,
          offset,
        });
        const structureData = responseData.map(summaryToVideo);
        dispatch(upsertFilteredFiles(structureData));
        queueBodies(structureData);
      } catch (error) {
        /* keep the current list */
      }
    },
    [filteredVideos, dispatch, queueBodies]
  );

  const checkNewFiles = React.useCallback(async () => {
    try {
      const responseData = await searchQdn(
        { service: "DOCUMENT", query: QSHARE_FILE_BASE, limit: QDN_PAGE },
        { fresh: true }
      );
      const latestVideo = videos[0];
      if (!latestVideo) return;
      const findVideo = responseData.findIndex((item) => item?.identifier === latestVideo?.id);
      if (findVideo === -1) {
        dispatch(setCountNewFiles(responseData.length));
        return;
      }
      dispatch(setCountNewFiles(responseData.slice(0, findVideo).length));
    } catch (error) {
      /* ignore */
    }
  }, [videos, dispatch]);

  return {
    getFiles,
    checkAndUpdateFile,
    getFile,
    getAvatar,
    hashMapFiles,
    getNewFiles,
    checkNewFiles,
    getFilesFiltered,
    queueBodies,
  };
};
