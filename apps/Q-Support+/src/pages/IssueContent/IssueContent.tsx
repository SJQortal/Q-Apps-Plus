import DownloadIcon from "@mui/icons-material/Download";
import { Avatar, Box, Typography, useTheme } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import QORTicon from "../../assets/icons/CoinIcons/qort.png";
import { BountyDisplay } from "../../components/common/BountyDisplay.tsx";
import {
  Category,
  getCategoriesFromObject,
} from "../../components/common/CategoryList/CategoryList.tsx";
import { CommentSection } from "../../components/common/Comments/CommentSection";
import { Donate } from "../../components/common/Donate/Donate.tsx";
import FileElement from "../../components/common/FileElement";
import { IssueIcon, IssueIcons } from "../../components/common/IssueIcon.tsx";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { allCategoryData } from "../../constants/Categories/Categories.ts";
import {
  getIconsFromObject,
  getnamesFromObject,
} from "../../constants/Categories/CategoryFunctions.ts";
import { QSUPPORT_FILE_BASE } from "../../constants/Identifiers.ts";
import { fontSizeExLarge } from "../../constants/Misc.ts";
import {
  appendIsPaidToFeeData,
  verifyPayment,
} from "../../constants/PublishFees/VerifyPayment.ts";
import { addToHashMap } from "../../state/features/fileSlice.ts";
import { setIsLoadingGlobal } from "../../state/features/globalSlice";
import { RootState } from "../../state/store";
import { getAvatarFromName } from "../../utils/qortalRequests.ts";
import { formatDate } from "../../utils/time";
import {
  categoryNamesToString,
  getCategoryNames,
  getIconsAndLabels,
} from "./IssueContent-functions.ts";
import {
  AuthorTextComment,
  FileAttachmentContainer,
  FileAttachmentFont,
  FileDescription,
  FilePlayerContainer,
  FileTitle,
  ImageContainer,
  Spacer,
  StyledCardColComment,
  StyledCardHeaderComment,
} from "./IssueContent-styles.tsx";

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export const IssueContent = () => {
  const { name, id } = useParams();
  const [isExpandedDescription, setIsExpandedDescription] =
    useState<boolean>(false);
  const [descriptionHeight, setDescriptionHeight] = useState<null | number>(
    null
  );
  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );
  const contentRef = useRef(null);

  const avatarUrl = useMemo(() => {
    let url = "";
    if (name && userAvatarHash[name]) {
      url = userAvatarHash[name];
    }

    return url;
  }, [userAvatarHash, name]);
  const navigate = useNavigate();
  const theme = useTheme();

  const [issueData, setIssueData] = useState<any>(null);
  const [playlistData, setPlaylistData] = useState<any>(null);

  const hashMapVideos = useSelector(
    (state: RootState) => state.file.hashMapFiles
  );
  const videoReference = useMemo(() => {
    if (!issueData) return null;
    const { videoReference } = issueData;
    if (
      videoReference?.identifier &&
      videoReference?.name &&
      videoReference?.service
    ) {
      return videoReference;
    } else {
      return null;
    }
  }, [issueData]);

  const videoCover = useMemo(() => {
    if (!issueData) return null;
    const { videoImage } = issueData;
    return videoImage || null;
  }, [issueData]);
  const dispatch = useDispatch();

  const getIssueData = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !id) return;
      dispatch(setIsLoadingGlobal(true));

      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${QSUPPORT_FILE_BASE}&limit=1&includemetadata=true&reverse=true&excludeblocked=true&name=${name}&exactmatchnames=true&offset=0&identifier=${id}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseDataSearch = await response.json();

      if (responseDataSearch?.length > 0) {
        let resourceData = responseDataSearch[0];
        resourceData = {
          title: resourceData?.metadata?.title,
          category: resourceData?.metadata?.category,
          categoryName: resourceData?.metadata?.categoryName,
          tags: resourceData?.metadata?.tags || [],
          description: resourceData?.metadata?.description,
          created: resourceData?.created,
          updated: resourceData?.updated,
          user: resourceData.name,
          videoImage: "",
          id: resourceData.identifier,
        };

        const responseData = await qortalRequest({
          action: "FETCH_QDN_RESOURCE",
          name: name,
          service: "DOCUMENT",
          identifier: id,
        });

        if (responseData && !responseData.error) {
          const combinedData = {
            ...resourceData,
            ...responseData,
          };

          verifyPayment(combinedData).then(feeData => {
            const dataWithFees = appendIsPaidToFeeData(combinedData, feeData);
            console.log("dataWithFees: ", dataWithFees);
            setIssueData(dataWithFees);
            dispatch(addToHashMap(combinedData));
            checkforPlaylist(name, id, combinedData?.code);
          });
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, []);

  const checkforPlaylist = React.useCallback(async (name, id, code) => {
    try {
      if (!name || !id || !code) return;

      const url = `/arbitrary/resources/search?mode=ALL&service=PLAYLIST&description=c:${code}&limit=1&includemetadata=true&reverse=true&excludeblocked=true&name=${name}&exactmatchnames=true&offset=0`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseDataSearch = await response.json();

      if (responseDataSearch?.length > 0) {
        let resourceData = responseDataSearch[0];
        resourceData = {
          title: resourceData?.metadata?.title,
          category: resourceData?.metadata?.category,
          categoryName: resourceData?.metadata?.categoryName,
          tags: resourceData?.metadata?.tags || [],
          description: resourceData?.metadata?.description,
          created: resourceData?.created,
          updated: resourceData?.updated,
          name: resourceData.name,
          videoImage: "",
          identifier: resourceData.identifier,
          service: resourceData.service,
        };

        const responseData = await qortalRequest({
          action: "FETCH_QDN_RESOURCE",
          name: resourceData.name,
          service: resourceData.service,
          identifier: resourceData.identifier,
        });

        if (responseData && !responseData.error) {
          const combinedData = {
            ...resourceData,
            ...responseData,
          };
          const videos = [];
          if (combinedData?.videos) {
            for (const vid of combinedData.videos) {
              const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&identifier=${vid.identifier}&limit=1&includemetadata=true&reverse=true&name=${vid.name}&exactmatchnames=true&offset=0`;
              const response = await fetch(url, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });
              const responseDataSearchVid = await response.json();

              if (responseDataSearchVid?.length > 0) {
                const resourceData2 = responseDataSearchVid[0];
                videos.push(resourceData2);
              }
            }
          }
          combinedData.videos = videos;
          setPlaylistData(combinedData);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    if (name && id) {
      const existingVideo = hashMapVideos[id];

      if (existingVideo) {
        verifyPayment(existingVideo).then(feeData => {
          setIssueData(appendIsPaidToFeeData(existingVideo, feeData));
          checkforPlaylist(name, id, existingVideo?.code);
        });
      } else {
        getIssueData(name, id);
      }
    }
  }, [id, name]);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.offsetHeight;
      const maxDescriptionHeight = 200;
      if (height > maxDescriptionHeight) {
        // Assuming 100px is your threshold
        setDescriptionHeight(maxDescriptionHeight);
      }
    }
  }, [issueData]);

  const categoriesDisplay = useMemo(() => {
    if (issueData) {
      const categoryNames = getCategoryNames(issueData);
      return categoryNamesToString(categoryNames, issueData?.QappName);
    }
    return "No Issue Data";
  }, [issueData]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        padding: "20px 10px",
      }}
    >
      <FilePlayerContainer
        sx={{
          marginBottom: "30px",
        }}
      >
        <Spacer height="15px" />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {issueData && (
              <IssueIcons
                issueData={issueData}
                style={{ marginRight: "20px" }}
              />
            )}
          </div>
          <FileTitle
            variant="h1"
            color="textPrimary"
            sx={{
              textAlign: "center",
            }}
          >
            {issueData?.title}
          </FileTitle>
          {issueData?.feeData?.isPaid && (
            <IssueIcon iconSrc={QORTicon} style={{ marginLeft: "10px" }} />
          )}
        </div>
        {issueData?.created && (
          <Typography
            variant="h4"
            sx={{
              fontSize: "18px",
            }}
            color={theme.palette.text.primary}
          >
            {formatDate(issueData.created)}
          </Typography>
        )}

        <Spacer height="15px" />
        <Box
          sx={{
            cursor: "pointer",
          }}
          onClick={() => {
            navigate(`/channel/${name}`);
          }}
        >
          <StyledCardHeaderComment
            sx={{
              "& .MuiCardHeader-content": {
                overflow: "hidden",
              },
            }}
          >
            <Box>
              <Avatar
                src={`/arbitrary/THUMBNAIL/${name}/qortal_avatar`}
                alt={`${name}'s avatar`}
              />
            </Box>
            <StyledCardColComment>
              <AuthorTextComment
                color={
                  theme.palette.mode === "light"
                    ? theme.palette.text.secondary
                    : "#d6e8ff"
                }
              >
                {name}
              </AuthorTextComment>
            </StyledCardColComment>
          </StyledCardHeaderComment>
        </Box>
        <Spacer height="15px" />
        <Box sx={{ display: "flex", direction: "row", alignItems: "center" }}>
          {issueData?.bountyData && (
            <div style={{ fontWeight: "bold" }}>
              <BountyDisplay
                bountyData={issueData?.bountyData}
                timeDisplay={"BOTH"}
                fontStyle={{ fontSize: fontSizeExLarge, fontWeight: "bold" }}
              />
              {(issueData?.bountyData?.sourceCodeLink ||
                issueData?.bountyData?.crowdfundLink) && (
                <>
                  <div>Relevant Links:</div>
                  <div style={{ fontWeight: "bold" }}>
                    <div>{issueData?.bountyData?.crowdfundLink}</div>
                    <div>{issueData?.bountyData?.sourceCodeLink}</div>
                  </div>
                </>
              )}
              <Donate crowdfundLink={issueData?.bountyData?.crowdfundLink} />
            </div>
          )}
        </Box>
        <Spacer height="15px" />
        <Box>
          <Typography
            sx={{
              fontWeight: "bold",
              userSelect: "none",
            }}
          >
            {categoriesDisplay}
          </Typography>
        </Box>
        <ImageContainer>
          {issueData?.images &&
            issueData.images.map(image => {
              return (
                <img
                  key={image}
                  src={image}
                  width={`${1080 / issueData.images.length}px`}
                  style={{
                    marginRight: "10px",
                    marginBottom: "10px",
                    objectFit: "contain",
                    maxHeight: "50vh",
                  }}
                />
              );
            })}
        </ImageContainer>
        <Spacer height="15px" />
        <Box
          sx={{
            background: theme.palette.mode === "dark" ? "#333333" : "#CCCCCC",
            borderRadius: "5px",
            padding: "5px",
            width: "100%",
            cursor: !descriptionHeight
              ? "default"
              : isExpandedDescription
                ? "default"
                : "pointer",
            position: "relative",
          }}
          className={
            !descriptionHeight ? "" : isExpandedDescription ? "" : "hover-click"
          }
        >
          {descriptionHeight && !isExpandedDescription && (
            <Box
              sx={{
                position: "absolute",
                top: "0px",
                right: "0px",
                left: "0px",
                bottom: "0px",
                cursor: "pointer",
              }}
              onClick={() => {
                if (isExpandedDescription) return;
                setIsExpandedDescription(true);
              }}
            />
          )}
          <Box
            ref={contentRef}
            sx={{
              height: !descriptionHeight
                ? "auto"
                : isExpandedDescription
                  ? "auto"
                  : "30vh",
              overflow: "hidden",
            }}
          >
            {issueData?.htmlDescription ? (
              <DisplayHtml html={issueData?.htmlDescription} />
            ) : (
              <FileDescription
                variant="body1"
                color="textPrimary"
                sx={{
                  cursor: "default",
                }}
              >
                {issueData?.fullDescription}
              </FileDescription>
            )}
          </Box>
          {descriptionHeight && (
            <Typography
              onClick={() => {
                setIsExpandedDescription(prev => !prev);
              }}
              sx={{
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
                paddingLeft: "15px",
                paddingTop: "15px",
              }}
            >
              {isExpandedDescription ? "Show less" : "...more"}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "flex-start",
            flexDirection: "column",
            gap: "25px",
            marginTop: "25px",
          }}
        >
          {issueData?.files?.map((file, index) => {
            return (
              <FileAttachmentContainer
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                }}
                key={file.toString() + index}
              >
                <FileAttachmentFont>{file.filename}</FileAttachmentFont>
                <Box
                  sx={{
                    display: "flex",
                    gap: "25px",
                    alignItems: "center",
                  }}
                >
                  <FileAttachmentFont>
                    {formatBytes(file?.size || 0)}
                  </FileAttachmentFont>
                  <FileElement
                    fileInfo={{
                      ...file,
                      filename: file?.filename,
                      mimeType: file?.mimetype,
                    }}
                    jsonId={id}
                    title={file?.filename}
                    customStyles={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <DownloadIcon />
                  </FileElement>
                </Box>
              </FileAttachmentContainer>
            );
          })}
        </Box>
      </FilePlayerContainer>

      <Box
        sx={{
          display: "flex",
          gap: "20px",
          width: "100%",
          maxWidth: "1200px",
        }}
      >
        <CommentSection postId={id || ""} postName={name || ""} />
      </Box>
    </Box>
  );
};
