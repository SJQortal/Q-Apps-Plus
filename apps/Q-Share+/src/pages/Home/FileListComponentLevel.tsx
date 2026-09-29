import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import AttachFileIcon from "@mui/icons-material/AttachFile";

import { Avatar, Box, Skeleton, useTheme } from "@mui/material";
import { useFetchFiles } from "../../hooks/useFetchFiles.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import {
  BottomParent,
  FileContainer,
  NameContainer,
  VideoCard,
  VideoCardName,
  VideoCardTitle,
  VideoUploadDate,
} from "./FileList-styles.tsx";
import { formatDate } from "../../utils/time";
import { Video } from "../../state/features/fileSlice.ts";
import { queue } from "../../wrappers/GlobalWrapper";
import { QSHARE_FILE_BASE } from "../../constants/Identifiers.ts";
import { formatBytes } from "../FileContent/FileContent.tsx";
import { getIconsFromObject } from "../../constants/Categories/CategoryFunctions.ts";

interface VideoListProps {
  mode?: string;
}
export const FileListComponentLevel = ({ mode }: VideoListProps) => {
  const { name: paramName } = useParams();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const firstFetch = useRef(false);
  const afterFetch = useRef(false);
  const hashMapVideos = useSelector(
    (state: RootState) => state.file.hashMapFiles
  );

  const [videos, setVideos] = React.useState<Video[]>([]);

  const navigate = useNavigate();
  const { getFile, getNewFiles, checkNewFiles, checkAndUpdateFile } =
    useFetchFiles();

  const getVideos = React.useCallback(async () => {
    try {
      const offset = videos.length;
      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QSHARE_FILE_BASE}&limit=50&includemetadata=false&reverse=true&excludeblocked=true&name=${paramName}&exactmatchnames=true&offset=${offset}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();

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

      const copiedVideos: Video[] = [...videos];
      structureData.forEach((video: Video) => {
        const index = videos.findIndex(p => p.id === video.id);
        if (index !== -1) {
          copiedVideos[index] = video;
        } else {
          copiedVideos.push(video);
        }
      });
      setVideos(copiedVideos);

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
  }, [videos, hashMapVideos]);

  const getVideosHandler = React.useCallback(async () => {
    if (!firstFetch.current || !afterFetch.current) return;
    await getVideos();
  }, [getVideos]);

  const getVideosHandlerMount = React.useCallback(async () => {
    if (firstFetch.current) return;
    firstFetch.current = true;
    await getVideos();
    afterFetch.current = true;
    setIsLoading(false);
  }, [getVideos]);

  useEffect(() => {
    if (!firstFetch.current) {
      getVideosHandlerMount();
    }
  }, [getVideosHandlerMount]);

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <FileContainer>
        {videos.map((file: any, index: number) => {
          const existingFile = hashMapVideos[file?.id];
          let hasHash = false;
          let fileObj = file;
          if (existingFile) {
            fileObj = existingFile;
            hasHash = true;
          }

          const icon = getIconsFromObject(fileObj);

          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: "75px",
                position: "relative",
              }}
              key={fileObj.id}
            >
              {hasHash ? (
                <>
                  <VideoCard
                    onClick={() => {
                      navigate(`/share/${fileObj?.user}/${fileObj?.id}`);
                    }}
                    sx={{
                      height: "100%",
                      width: "100%",
                      display: "flex",
                      gap: "25px",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        gap: "25px",
                        alignItems: "center",
                      }}
                    >
                      {icon ? (
                        <img
                          src={icon}
                          width="50px"
                          style={{
                            borderRadius: "5px",
                          }}
                        />
                      ) : (
                        <AttachFileIcon />
                      )}
                      <VideoCardTitle
                        sx={{
                          width: "100px",
                        }}
                      >
                        {formatBytes(
                          fileObj?.files.reduce(
                            (acc, cur) => acc + (cur?.size || 0),
                            0
                          )
                        )}
                      </VideoCardTitle>
                      <VideoCardTitle>{fileObj.title}</VideoCardTitle>
                    </Box>
                    <BottomParent>
                      <NameContainer
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/channel/${fileObj?.user}`);
                        }}
                      >
                        <Avatar
                          sx={{ height: 24, width: 24 }}
                          src={`/arbitrary/THUMBNAIL/${fileObj?.user}/qortal_avatar`}
                          alt={`${fileObj?.user}'s avatar`}
                        />
                        <VideoCardName
                          sx={{
                            ":hover": {
                              textDecoration: "underline",
                            },
                          }}
                        >
                          {fileObj?.user}
                        </VideoCardName>
                      </NameContainer>

                      {fileObj?.created && (
                        <VideoUploadDate>
                          {formatDate(fileObj.created)}
                        </VideoUploadDate>
                      )}
                    </BottomParent>
                  </VideoCard>
                </>
              ) : (
                <Skeleton
                  variant="rectangular"
                  style={{
                    width: "100%",
                    height: "100%",
                    paddingBottom: "10px",
                    objectFit: "contain",
                    visibility: "visible",
                    borderRadius: "8px",
                  }}
                />
              )}
            </Box>
          );
        })}
      </FileContainer>
      <LazyLoad onLoadMore={getVideosHandler} isLoading={isLoading}></LazyLoad>
    </Box>
  );
};
