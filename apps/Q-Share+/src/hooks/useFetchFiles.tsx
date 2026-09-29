import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addFiles,
  addToHashMap,
  setCountNewFiles,
  upsertFiles,
  upsertFilesBeginning,
  Video,
  upsertFilteredFiles,
} from "../state/features/fileSlice.ts";
import { setIsLoadingGlobal, setUserAvatarHash } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { fetchAndEvaluateVideos } from "../utils/fetchVideos";
import { QSHARE_PLAYLIST_BASE, QSHARE_FILE_BASE } from "../constants/Identifiers.ts";
import { queue } from "../wrappers/GlobalWrapper";
import { getCategoriesFetchString } from "../components/common/CategoryList/CategoryList.tsx";
import { QDN_PAGE, QdnResourceSummary, searchQdn } from "../utils/qdnSearch";

/** A list row built from a search result; the JSON body arrives later via getFile. */
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
  };
}

export const useFetchFiles = () => {
  const dispatch = useDispatch();
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
  }, []);

  const getFile = async (user: string, videoId: string, content: any, retries: number = 0) => {
    try {
      const res = await fetchAndEvaluateVideos({ user, videoId, content });
      dispatch(addToHashMap(res));
    } catch (error) {
      retries = retries + 1;
      if (retries < 2) {
        queue.push(() => getFile(user, videoId, content, retries + 1));
      } else {
        console.error("Failed to get share after 3 attempts", error);
      }
    }
  };

  const queueBodies = React.useCallback(
    (rows: Video[]) => {
      for (const content of rows) {
        if (content.user && content.id && checkAndUpdateFile(content)) {
          queue.push(() => getFile(content.user, content.id, content));
        }
      }
    },
    [checkAndUpdateFile]
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
  }, [videos, hashMapFiles]);

  const getFiles = React.useCallback(
    async (filters = {}, reset?: boolean, resetFilers?: boolean, limit?: number) => {
      const { name = "", categories = [], keywords = "", type = "", sort = "newest", following = false }: any = resetFilers ? {} : filters;
      const offset = reset ? 0 : videos.length;
      const isPlaylists = type === "playlists";
      const responseData = await searchQdn(
        {
          service: isPlaylists ? "PLAYLIST" : "DOCUMENT",
          identifier: isPlaylists ? QSHARE_PLAYLIST_BASE : QSHARE_FILE_BASE,
          name: name || undefined,
          description: categories.length > 0 ? getCategoriesFetchString(categories) : undefined,
          query: keywords || undefined,
          offset,
          limit: limit || QDN_PAGE,
          reverse: sort !== "oldest",
          followedonly: Boolean(following),
        },
        { fresh: Boolean(reset) }
      );
      const structureData = responseData.map(summaryToVideo);
      if (reset) dispatch(addFiles(structureData));
      else dispatch(upsertFiles(structureData));
      queueBodies(structureData);
      return structureData.length;
    },
    [videos, hashMapFiles]
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
    [filteredVideos, hashMapFiles]
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
  }, [videos]);

  return {
    getFiles,
    checkAndUpdateFile,
    getFile,
    getAvatar,
    hashMapFiles,
    getNewFiles,
    checkNewFiles,
    getFilesFiltered,
  };
};
