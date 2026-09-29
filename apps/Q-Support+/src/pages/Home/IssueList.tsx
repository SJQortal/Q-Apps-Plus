import BlockIcon from "@mui/icons-material/Block";
import EditIcon from "@mui/icons-material/Edit";
import { Avatar, Box, Skeleton, useTheme } from "@mui/material";
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import QORTicon from "../../assets/icons/CoinIcons/qort.png";
import { BountyDisplay } from "../../components/common/BountyDisplay.tsx";
import { IssueIcon, IssueIcons } from "../../components/common/IssueIcon.tsx";
import {
  getIconsFromObject,
  getnamesFromObject,
} from "../../constants/Categories/CategoryFunctions.ts";
import { fontSizeExLarge } from "../../constants/Misc.ts";
import {
  blockUser,
  Issue,
  setEditFile,
} from "../../state/features/fileSlice.ts";
import { RootState } from "../../state/store.ts";
import { BountyData } from "../../utils/qortalRequests.ts";
import { formatDate } from "../../utils/time.ts";
import {
  BlockIconContainer,
  IconsBox,
  IssueCard,
  IssueContainer,
  NameAndDateContainer,
  VideoCardName,
  VideoCardTitle,
  VideoUploadDate,
} from "./IssueList-styles.tsx";

interface FileListProps {
  issues: Issue[];
  sortOption: string;
}
export const IssueList = ({ issues, sortOption }: FileListProps) => {
  const hashMapIssues = useSelector(
    (state: RootState) => state.file.hashMapFiles
  );
  const theme = useTheme();
  const [showIcons, setShowIcons] = useState(null);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const blockUserFunc = async (user: string) => {
    if (user === "Q-Support") return;

    try {
      const response = await qortalRequest({
        action: "ADD_LIST_ITEMS",
        list_name: "blockedNames",
        items: [user],
      });

      if (response === true) {
        dispatch(blockUser(user));
      }
    } catch (error) {
      console.log(error);
    }
  };

  const filteredIssues = useMemo(() => {
    return issues.filter((issue: any) => hashMapIssues[issue.id]?.isValid);
  }, [issues, hashMapIssues]);

  const ts = (value: number | string | undefined): number => {
    if (value == null) return 0;
    return typeof value === "number"
      ? value
      : Date.parse(value);
  };

  const sortedIssues = useMemo(() => {
    const sorted = [...filteredIssues];
    switch (sortOption) {
      case "Oldest":
        sorted.sort((a, b) => ts(a.created) - ts(b.created));
        break;
      case "User":
        sorted.sort((a, b) => (a.user || "").localeCompare(b.user || "", undefined, { sensitivity: "base" }));
        break;
      case "Bounty":
        sorted.sort((a, b) => {
          const bountyA = Number(a.bountyData?.amount) || 0;
          const bountyB = Number(b.bountyData?.amount) || 0;
          if (bountyA === bountyB) {
            return ts(b.created) - ts(a.created);
          }
          return bountyB - bountyA;
        });
        break;
      case "Newest":
      default:
        sorted.sort((a, b) => ts(b.created) - ts(a.created));
    }
    return sorted;
  }, [filteredIssues, sortOption]);

  return (
    <IssueContainer>
      {sortedIssues.map((issue: Issue, index: number) => {
        const existingFile = hashMapIssues[issue.id];
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
            onMouseEnter={() => setShowIcons(issueObj.id)}
            onMouseLeave={() => setShowIcons(null)}
          >
            {hasHash ? (
              <>
                <IconsBox
                  sx={{
                    opacity: showIcons === issueObj.id ? 1 : 0,
                    zIndex: 2,
                  }}
                >
                  {issueObj?.user === username && (
                    <BlockIconContainer
                      onClick={() => {
                        dispatch(setEditFile(issueObj));
                      }}
                    >
                      <EditIcon />
                      Edit Issue
                    </BlockIconContainer>
                  )}

                  {issueObj?.user !== username && (
                    <BlockIconContainer
                      onClick={() => {
                        blockUserFunc(issueObj?.user);
                      }}
                    >
                      <BlockIcon />
                      Block User
                    </BlockIconContainer>
                  )}
                </IconsBox>
                <IssueCard
                  onClick={() => {
                    navigate(`/issue/${issueObj?.user}/${issueObj?.id}`);
                  }}
                  sx={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
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
                        justifyContent: "left",
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
                    <VideoCardTitle sx={{ fontWeight: "bold", width: "400px" }}>
                      {issueObj.title}
                    </VideoCardTitle>
                  </Box>

                  {issue?.feeData?.isPaid && (
                    <IssueIcon
                      iconSrc={QORTicon}
                      style={{ marginRight: "20px" }}
                    />
                  )}

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
                        {formatDate(ts(issueObj.created))}
                      </VideoUploadDate>
                    )}
                  </NameAndDateContainer>
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
  );
};
