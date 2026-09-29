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
import {
  setIsLoadingGlobal,
  setUserAvatarHash,
  setTotalFilesPublished,
  setTotalNamesPublished,
  setFilesPerNamePublished,
} from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { fetchAndEvaluateVideos } from "../utils/fetchVideos";
import {
  QSHARE_PLAYLIST_BASE,
  QSHARE_FILE_BASE,
} from "../constants/Identifiers.ts";
import { RequestQueue } from "../utils/queue";
import { queue } from "../wrappers/GlobalWrapper";
import { getCategoriesFetchString } from "../components/common/CategoryList/CategoryList.tsx";

export const useFetchFiles = () => {
  const dispatch = useDispatch();
  const hashMapFiles = useSelector(
    (state: RootState) => state.file.hashMapFiles
  );
  const videos = useSelector((state: RootState) => state.file.files);
  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );
  const filteredVideos = useSelector(
    (state: RootState) => state.file.filteredFiles
  );

  const totalFilesPublished = useSelector(
    (state: RootState) => state.global.totalFilesPublished
  );
  const totalNamesPublished = useSelector(
    (state: RootState) => state.global.totalNamesPublished
  );
  const filesPerNamePublished = useSelector(
    (state: RootState) => state.global.filesPerNamePublished
  );

  const checkAndUpdateFile = React.useCallback(
    (video: Video) => {
      const existingVideo = hashMapFiles[video.id];
      if (!existingVideo) {
        return true;
      } else if (
        video?.updated &&
        existingVideo?.updated &&
        (!existingVideo?.updated || video?.updated) > existingVideo?.updated
      ) {
        return true;
      } else {
        return false;
      }
    },
    [hashMapFiles]
  );

  const getAvatar = React.useCallback(async (author: string) => {
    try {
      let url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: author,
        service: "THUMBNAIL",
        identifier: "qortal_avatar",
      });

      dispatch(
        setUserAvatarHash({
          name: author,
          url,
        })
      );
    } catch (error) {}
  }, []);

  const getFile = async (
    user: string,
    videoId: string,
    content: any,
    retries: number = 0
  ) => {
    try {
      const res = await fetchAndEvaluateVideos({
        user,
        videoId,
        content,
      });

      dispatch(addToHashMap(res));
    } catch (error) {
      retries = retries + 1;
      if (retries < 2) {
        // 3 is the maximum number of retries here, you can adjust it to your needs
        queue.push(() => getFile(user, videoId, content, retries + 1));
      } else {
        console.error("Failed to get video after 3 attempts", error);
      }
    }
  };

  const getNewFiles = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true));

      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QSHARE_FILE_BASE}&limit=20&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();

      // const responseData = await qortalRequest({
      //   action: "SEARCH_QDN_RESOURCES",
      //   mode: "ALL",
      //   service: "DOCUMENT",
      //   query: "${QTUBE_VIDEO_BASE}",
      //   limit: 20,
      //   includeMetadata: true,
      //   reverse: true,
      //   excludeBlocked: true,
      //   exactMatchNames: true,
      //   name: names
      // })
      const latestVideo = videos[0];
      if (!latestVideo) return;
      const findVideo = responseData?.findIndex(
        (item: any) => item?.identifier === latestVideo?.id
      );
      let fetchAll = responseData;
      let willFetchAll = true;
      if (findVideo !== -1) {
        willFetchAll = false;
        fetchAll = responseData.slice(0, findVideo);
      }

      const structureData = fetchAll.map((video: any): Video => {
        return {
          title: video?.metadata?.title,
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
      });
      if (!willFetchAll) {
        dispatch(upsertFilesBeginning(structureData));
      }
      if (willFetchAll) {
        dispatch(addFiles(structureData));
      }
      setTimeout(() => {
        dispatch(setCountNewFiles(0));
      }, 1000);
      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdateFile(content);
          if (res) {
            queue.push(() => getFile(content.user, content.id, content));
          }
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [videos, hashMapFiles]);

  const getFiles = React.useCallback(
    async (
      filters = {},
      reset?: boolean,
      resetFilers?: boolean,
      limit?: number
    ) => {
      try {
        const {
          name = "",
          categories = [],
          keywords = "",
          type = "",
        }: any = resetFilers ? {} : filters;
        let offset = videos.length;
        if (reset) {
          offset = 0;
        }
        const videoLimit = limit || 50;
        let defaultUrl = `/arbitrary/resources/search?mode=ALL&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}&limit=${videoLimit}`;

        if (name) {
          defaultUrl += `&name=${name}`;
        }

        if (categories.length > 0) {
          defaultUrl += "&description=" + getCategoriesFetchString(categories);
        }

        if (keywords) {
          defaultUrl = defaultUrl + `&query=${keywords}`;
        }
        if (type === "playlists") {
          defaultUrl = defaultUrl + `&service=PLAYLIST`;
          defaultUrl = defaultUrl + `&identifier=${QSHARE_PLAYLIST_BASE}`;
        } else {
          defaultUrl = defaultUrl + `&service=DOCUMENT`;
          defaultUrl = defaultUrl + `&identifier=${QSHARE_FILE_BASE}`;
        }

        // const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QTUBE_VIDEO_BASE}&limit=${videoLimit}&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}`
        const url = defaultUrl;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseData = await response.json();

        // const responseData = await qortalRequest({
        //   action: "SEARCH_QDN_RESOURCES",
        //   mode: "ALL",
        //   service: "DOCUMENT",
        //   query: "${QTUBE_VIDEO_BASE}",
        //   limit: 20,
        //   includeMetadata: true,
        //   offset: offset,
        //   reverse: true,
        //   excludeBlocked: true,
        //   exactMatchNames: true,
        //   name: names
        // })
        const structureData = responseData.map((video: any): Video => {
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
        });
        if (reset) {
          dispatch(addFiles(structureData));
        } else {
          dispatch(upsertFiles(structureData));
        }
        for (const content of structureData) {
          if (content.user && content.id) {
            const res = checkAndUpdateFile(content);
            if (res) {
              queue.push(() => getFile(content.user, content.id, content));
            }
          }
        }
      } catch (error) {
        console.log({ error });
      } finally {
      }
    },
    [videos, hashMapFiles]
  );

  const getFilesFiltered = React.useCallback(
    async (filterValue: string) => {
      try {
        const offset = filteredVideos.length;
        const replaceSpacesWithUnderscore = filterValue.replace(/ /g, "_");

        const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${replaceSpacesWithUnderscore}&identifier=${QSHARE_FILE_BASE}&limit=10&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseData = await response.json();

        // const responseData = await qortalRequest({
        //   action: "SEARCH_QDN_RESOURCES",
        //   mode: "ALL",
        //   service: "DOCUMENT",
        //   query: replaceSpacesWithUnderscore,
        //   identifier: "${QTUBE_VIDEO_BASE}",
        //   limit: 20,
        //   includeMetadata: true,
        //   offset: offset,
        //   reverse: true,
        //   excludeBlocked: true,
        //   exactMatchNames: true,
        //   name: names
        // })
        const structureData = responseData.map((video: any): Video => {
          return {
            title: video?.metadata?.title,
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
        });
        dispatch(upsertFilteredFiles(structureData));

        for (const content of structureData) {
          if (content.user && content.id) {
            const res = checkAndUpdateFile(content);
            if (res) {
              queue.push(() => getFile(content.user, content.id, content));
            }
          }
        }
      } catch (error) {
      } finally {
      }
    },
    [filteredVideos, hashMapFiles]
  );

  const checkNewFiles = React.useCallback(async () => {
    try {
      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QSHARE_FILE_BASE}&limit=20&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();
      // const responseData = await qortalRequest({
      //   action: "SEARCH_QDN_RESOURCES",
      //   mode: "ALL",
      //   service: "DOCUMENT",
      //   query: "${QTUBE_VIDEO_BASE}",
      //   limit: 20,
      //   includeMetadata: true,
      //   reverse: true,
      //   excludeBlocked: true,
      //   exactMatchNames: true,
      //   name: names
      // })
      const latestVideo = videos[0];
      if (!latestVideo) return;
      const findVideo = responseData?.findIndex(
        (item: any) => item?.identifier === latestVideo?.id
      );
      if (findVideo === -1) {
        dispatch(setCountNewFiles(responseData.length));
        return;
      }
      const newArray = responseData.slice(0, findVideo);
      dispatch(setCountNewFiles(newArray.length));
      return;
    } catch (error) {}
  }, [videos]);

  const getFilesCount = React.useCallback(async () => {
    try {
      let url = `/arbitrary/resources/search?mode=ALL&includemetadata=false&limit=0&service=DOCUMENT&identifier=${QSHARE_FILE_BASE}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();

      const totalFilesPublished = responseData.length;
      const uniqueNames = new Set(responseData.map(video => video.name));
      const totalNamesPublished = uniqueNames.size;
      const filesPerNamePublished = (
        totalFilesPublished / totalNamesPublished
      ).toFixed(2);

      dispatch(setTotalFilesPublished(totalFilesPublished));
      dispatch(setTotalNamesPublished(totalNamesPublished));
      dispatch(setFilesPerNamePublished(filesPerNamePublished));
    } catch (error) {
      console.log({ error });
    } finally {
    }
  }, []);

  return {
    getFiles,
    checkAndUpdateFile,
    getFile,
    hashMapFiles,
    getNewFiles,
    checkNewFiles,
    getFilesFiltered,
    getFilesCount,
  };
};
