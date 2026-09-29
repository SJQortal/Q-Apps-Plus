import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  QSUPPORT_FILE_BASE,
  QSUPPORT_PLAYLIST_BASE,
} from "../constants/Identifiers.ts";
import { log } from "../constants/Misc.ts";
import { verifyAllPayments } from "../constants/PublishFees/VerifyPayment.ts";
import {
  addFiles,
  addToHashMap,
  Issue,
  removeFromHashMap,
  setCountNewFiles,
  upsertFiles,
  upsertFilesBeginning,
  upsertFilteredFiles,
} from "../state/features/fileSlice.ts";
import {
  setFilesPerNamePublished,
  setIsLoadingGlobal,
  setTotalFilesPublished,
  setTotalNamesPublished,
  setUserAvatarHash,
} from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { fetchAndEvaluateIssues } from "../utils/fetchVideos";
import { getBountyAmounts } from "../utils/qortalRequests.ts";
import { queue } from "../wrappers/GlobalWrapper";

export const useFetchIssues = () => {
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

  const checkAndUpdateIssue = React.useCallback(
    (video: Issue) => {
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
      const url = await qortalRequest({
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
    } catch (error) {
      console.log(error);
    }
  }, []);

  const getIssue = async (
    user: string,
    issueID: string,
    content: any,
    retries = 0
  ) => {
    try {
      const res = await fetchAndEvaluateIssues({
        user,
        videoId: issueID,
        content,
      });
      res?.isValid
        ? dispatch(addToHashMap(res))
        : dispatch(removeFromHashMap(issueID));
      return res;
    } catch (error) {
      retries = retries + 1;
      if (retries < 2) {
        // 3 is the maximum number of retries here, you can adjust it to your needs
        queue.push(() => getIssue(user, issueID, content, retries + 1));
      } else {
        console.error("Failed to get issue after 3 attempts", error);
      }
    }
  };

  const getNewIssues = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true));

      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QSUPPORT_FILE_BASE}&limit=20&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true`;
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

      const structureData = fetchAll.map((video: any): Issue => {
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
          const res = checkAndUpdateIssue(content);
          if (res) {
            queue.push(() => getIssue(content.user, content.id, content));
          }
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [videos, hashMapFiles]);

  const getIssues = React.useCallback(
    async (
      filters = {},
      reset?: boolean,
      resetFilters?: boolean,
      limit?: number
    ) => {
      try {
        const {
          name = "",
          categories = "",
          QappName = "",
          keywords = "",
          type = "",
        }: any = resetFilters ? {} : filters;
        let offset = videos.length;
        if (reset) {
          offset = 0;
        }
        const videoLimit = limit || 0;
        let defaultUrl = `/arbitrary/resources/search?mode=ALL&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}&limit=${videoLimit}`;

        if (name) {
          defaultUrl += `&name=${name}`;
        }

        if (categories) {
          defaultUrl += "&description=";
          if (log) console.log("categories: ", categories);
          if (categories) defaultUrl += categories;

          if (log) console.log("description: ", defaultUrl);
        }
        if (QappName) {
          defaultUrl += `&query=${QappName}`;
        }
        if (log) console.log("defaultURL: ", defaultUrl);
        if (keywords) {
          defaultUrl = defaultUrl + `&query=${keywords}`;
        }
        if (type === "playlists") {
          defaultUrl = defaultUrl + `&service=PLAYLIST`;
          defaultUrl = defaultUrl + `&identifier=${QSUPPORT_PLAYLIST_BASE}`;
        } else {
          defaultUrl = defaultUrl + `&service=DOCUMENT`;
          defaultUrl = defaultUrl + `&identifier=${QSUPPORT_FILE_BASE}`;
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

        let structureData = responseData.map((issue: any): Issue => {
          return {
            title: issue?.metadata?.title,
            service: issue?.service,
            category: issue?.metadata?.category,
            categoryName: issue?.metadata?.categoryName,
            tags: issue?.metadata?.tags || [],
            description: issue?.metadata?.description,
            created: issue?.created,
            updated: issue?.updated,
            user: issue.name,
            videoImage: "",
            id: issue.identifier,
          };
        });
        const verifiedIssuePromises: Promise<Issue>[] = [];
        for (const content of structureData) {
          if (content.user && content.id) {
            const res = checkAndUpdateIssue(content);
            const issue: Promise<Issue> = getIssue(
              content.user,
              content.id,
              content
            );
            verifiedIssuePromises.push(issue);
            if (res) {
              queue.push(() => issue);
            }
          }
        }

        const issues = await Promise.all(verifiedIssuePromises);
        const [verifiedIssues, bountyIssues] = await Promise.all([
          verifyAllPayments(issues),
          getBountyAmounts(issues),
        ]);

        structureData = structureData.map((issue, index) => {
          return {
            ...issue,
            feeData: verifiedIssues[index]?.feeData,
            bountyData: bountyIssues[index]?.bountyData,
          };
        });

        if (reset) dispatch(addFiles(structureData));
        else dispatch(upsertFiles(structureData));
      } catch (error) {
        console.log({ error });
      }
    },
    [videos, hashMapFiles]
  );

  const getIssuesFiltered = React.useCallback(
    async (filterValue: string) => {
      try {
        const offset = filteredVideos.length;
        const replaceSpacesWithUnderscore = filterValue.replace(/ /g, "_");

        const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${replaceSpacesWithUnderscore}&identifier=${QSUPPORT_FILE_BASE}&limit=10&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}`;
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
        const structureData = responseData.map((video: any): Issue => {
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
            const res = checkAndUpdateIssue(content);
            if (res) {
              queue.push(() => getIssue(content.user, content.id, content));
            }
          }
        }
      } catch (error) {
        console.log(error);
      }
    },
    [filteredVideos, hashMapFiles]
  );

  const checkNewIssues = React.useCallback(async () => {
    try {
      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QSUPPORT_FILE_BASE}&limit=20&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true`;
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
    } catch (error) {
      console.log(error);
    }
  }, [videos]);

  const getIssuesCount = React.useCallback(async () => {
    try {
      const url = `/arbitrary/resources/search?mode=ALL&includemetadata=false&limit=0&service=DOCUMENT&identifier=${QSUPPORT_FILE_BASE}`;

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
    }
  }, []);

  return {
    getIssues,
    checkAndUpdateIssue,
    getIssue,
    hashMapFiles,
    getNewIssues,
    checkNewIssues,
    getIssuesFiltered,
    getIssuesCount,
  };
};
