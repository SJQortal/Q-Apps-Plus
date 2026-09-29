import { Avatar, Box, Skeleton, useTheme } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import QORTicon from "../../assets/icons/CoinIcons/qort.png";
import { BountyDisplay } from "../../components/common/BountyDisplay.tsx";
import { IssueIcon, IssueIcons } from "../../components/common/IssueIcon.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import { getIconsFromObject } from "../../constants/Categories/CategoryFunctions.ts";
import { QSUPPORT_FILE_BASE } from "../../constants/Identifiers.ts";
import { fontSizeExLarge } from "../../constants/Misc.ts";
import { verifyAllPayments } from "../../constants/PublishFees/VerifyPayment.ts";
import { useFetchIssues } from "../../hooks/useFetchIssues.tsx";
import { Issue } from "../../state/features/fileSlice.ts";
import { RootState } from "../../state/store";
import { BountyData, getBountyAmounts } from "../../utils/qortalRequests.ts";
import { formatDate } from "../../utils/time";
import { queue } from "../../wrappers/GlobalWrapper";
import {
  BottomParent,
  IssueCard,
  IssueContainer,
  NameAndDateContainer,
  VideoCardName,
  VideoCardTitle,
  VideoUploadDate,
} from "./IssueList-styles.tsx";

interface VideoListProps {
  mode?: string;
}
export const IssueListComponentLevel = ({ mode }: VideoListProps) => {
  const { name: paramName } = useParams();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const firstFetch = useRef(false);
  const afterFetch = useRef(false);
  const hashMapVideos = useSelector(
    (state: RootState) => state.file.hashMapFiles
  );

  const [issues, setIssues] = React.useState<Issue[]>([]);

  const navigate = useNavigate();
  const { getIssue, getNewIssues, checkNewIssues, checkAndUpdateIssue } =
    useFetchIssues();

  const getIssues = React.useCallback(async () => {
    try {
      const offset = issues.length;
      //                 `/arbitrary/resources/search?mode=ALL&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}&limit=${videoLimit}`;
      const url = `/arbitrary/resources/search?mode=ALL&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}&limit=50&service=DOCUMENT&query=${QSUPPORT_FILE_BASE}_&name=${paramName}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();

      const structureData = responseData.map((issue: any): Issue => {
        return {
          title: issue?.metadata?.title,
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

      const copiedIssues: Issue[] = [...issues];
      structureData.forEach((issue: Issue) => {
        const index = issues.findIndex(p => p.id === issue.id);
        if (index !== -1) {
          copiedIssues[index] = issue;
        } else {
          copiedIssues.push(issue);
        }
      });

      const verifiedIssuePromises: Promise<Issue>[] = [];

      for (const content of copiedIssues) {
        if (content.user && content.id) {
          const res = checkAndUpdateIssue(content);
          const getIssueData = getIssue(content.user, content.id, content);
          if (res) queue.push(() => getIssueData);

          verifiedIssuePromises.push(getIssueData);
        }
      }

      const issueData = await Promise.all(verifiedIssuePromises);
      const verifiedIssues = await verifyAllPayments(issueData);
      const bountyIssues = await getBountyAmounts(verifiedIssues);
      console.log("bountyIssues: ", bountyIssues);
      setIssues(bountyIssues);
    } catch (error) {
      console.log(error);
    }
  }, [issues, hashMapVideos]);

  const getIssuesHandler = React.useCallback(async () => {
    if (!firstFetch.current || !afterFetch.current) return;
    await getIssues();
  }, [getIssues]);

  const getIssuesHandlerMount = React.useCallback(async () => {
    if (firstFetch.current) return;
    firstFetch.current = true;
    await getIssues();
    afterFetch.current = true;
    setIsLoading(false);
  }, [getIssues]);

  useEffect(() => {
    if (!firstFetch.current) {
      getIssuesHandlerMount();
    }
  }, [getIssuesHandlerMount]);

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <IssueContainer>
        {issues.map((issue: any, index: number) => {
          const existingFile = hashMapVideos[issue?.id];
          let hasHash = false;
          let issueObj = issue;
          if (existingFile) {
            issueObj = existingFile;
            hasHash = true;
          }
          const bountyData: BountyData = {
            ...issueObj.bountyData,
            ...issue.bountyData,
          };
          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: "75px",
                position: "relative",
              }}
              key={issueObj.id}
            >
              {hasHash ? (
                <>
                  <IssueCard
                    onClick={() => {
                      navigate(`/issue/${issueObj?.user}/${issueObj?.id}`);
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "280px",
                        }}
                      >
                        <IssueIcons
                          issueData={issueObj}
                          style={{ marginRight: "20px" }}
                          showBackupIcon={true}
                        />
                      </div>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "250px",
                          fontSize: fontSizeExLarge,
                          fontFamily: "Cairo",
                          letterSpacing: "0.4px",
                          color: theme.palette.text.primary,
                          userSelect: "none",
                        }}
                      >
                        <BountyDisplay
                          bountyData={bountyData}
                          divStyle={{ marginLeft: "20px" }}
                        />
                      </Box>
                      <VideoCardTitle
                        sx={{ fontWeight: "bold", width: "500px" }}
                      >
                        {issueObj.title}
                      </VideoCardTitle>
                    </Box>
                    {issue?.feeData?.isPaid && (
                      <IssueIcon
                        iconSrc={QORTicon}
                        style={{ marginRight: "20px" }}
                      />
                    )}
                    <BottomParent>
                      <NameAndDateContainer
                        sx={{ width: "200px", height: "100%" }}
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/channel/${issueObj?.user}`);
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            width: "200px",
                          }}
                        >
                          <Avatar
                            sx={{ height: 24, width: 24, marginRight: "10px" }}
                            src={`/arbitrary/THUMBNAIL/${issueObj?.user}/qortal_avatar`}
                            alt={`${issueObj?.user}'s avatar`}
                          />
                          <VideoCardName
                            sx={{
                              ":hover": {
                                textDecoration: "underline",
                              },
                            }}
                          >
                            {issueObj?.user}
                          </VideoCardName>
                        </div>

                        {issueObj?.created && (
                          <VideoUploadDate>
                            {formatDate(issueObj.created)}
                          </VideoUploadDate>
                        )}
                      </NameAndDateContainer>
                    </BottomParent>
                  </IssueCard>
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
      </IssueContainer>
      <LazyLoad onLoadMore={getIssuesHandler} isLoading={isLoading}></LazyLoad>
    </Box>
  );
};
