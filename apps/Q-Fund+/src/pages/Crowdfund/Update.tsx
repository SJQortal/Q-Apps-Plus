import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { Avatar, Box, useTheme } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import CircularProgress from "@mui/material/CircularProgress";
import { formatDate } from "../../utils/time";
import { DisplayHtml } from "../../components/common/DisplayHtml";
import FileElement from "../../components/common/FileElement";
import { setIsLoadingGlobal } from "../../state/features/globalSlice";
import { addToHashMap } from "../../state/features/crowdfundSlice";
import {
  CrowdfundSubTitle,
  CrowdfundTitle,
} from "../../components/Crowdfund/Crowdfund-styles";
import AudioPlayer from "../../components/common/AudioPlayer";
import { NewUpdate } from "../../components/Crowdfund/NewUpdate";
import {
  AttachmentCol,
  CrowdfundUpdateDate,
  FileAttachmentContainer,
  FileAttachmentFont,
  UpdateCol,
  UpdateContainer,
  UpdateLoadingBox,
  UpdateNameRow,
  UpdateRow,
  PlayerBox,
} from "./Update-styles";

export const Update = ({ updateObj }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { name } = useParams();

  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );

  const avatarUrl = useMemo(() => {
    let url = "";
    if (name && userAvatarHash[name]) {
      url = userAvatarHash[name];
    }

    return url;
  }, [userAvatarHash, name]);
  const [crowdfundData, setCrowdfundData] = useState<any>(null);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const hashMapCrowdfunds = useSelector(
    (state: RootState) => state.crowdfund.hashMapCrowdfunds
  );

  const editContent = useMemo(() => {
    if (!crowdfundData) return null;
    const content = {
      title: crowdfundData?.title,
      inlineContent: crowdfundData?.inlineContent,
      attachments: crowdfundData?.attachments,
      user: crowdfundData?.user,
    };
    return content;
  }, [crowdfundData]);

  const getCrowdfundData = React.useCallback(async updateObj => {
    try {
      let resourceData = updateObj;
      resourceData = {
        title: resourceData?.metadata?.title,
        category: resourceData?.metadata?.category,
        categoryName: resourceData?.metadata?.categoryName,
        tags: resourceData?.metadata?.tags || [],
        description: resourceData?.metadata?.description,
        created: resourceData?.created,
        updated: resourceData?.updated,
        user: resourceData.name,
        id: resourceData.identifier,
      };

      const responseData = await qortalRequest({
        action: "FETCH_QDN_RESOURCE",
        name: updateObj.name,
        service: "DOCUMENT",
        identifier: updateObj.identifier,
      });

      if (responseData && !responseData.error) {
        const combinedData = {
          ...resourceData,
          ...responseData,
        };

        setCrowdfundData(combinedData);
        dispatch(addToHashMap(combinedData));
      }
    } catch (error) {
      console.log(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, []);

  useEffect(() => {
    if (updateObj) {
      const existingCrowdfund = hashMapCrowdfunds[updateObj.identifier];

      if (existingCrowdfund) {
        setCrowdfundData(existingCrowdfund);
      } else {
        getCrowdfundData(updateObj);
      }
    }
  }, [updateObj]);

  if (!crowdfundData)
    return (
      <UpdateLoadingBox>
        <CircularProgress />
      </UpdateLoadingBox>
    );
  return (
    <>
      <NewUpdate
        editContent={editContent}
        editId={updateObj.identifier}
        onSubmit={content => {
          setCrowdfundData(content);
        }}
        crowdfundName={name || ""}
      />
      <UpdateContainer>
        <UpdateCol>
          <UpdateRow>
            <UpdateNameRow>
              <Avatar src={avatarUrl} alt={`${name}'s avatar`} />
              {name}
            </UpdateNameRow>
            <UpdateCol style={{ gap: 0 }}>
              <CrowdfundTitle
                sx={{
                  textAlign: "center",
                }}
              >
                {crowdfundData?.title}
              </CrowdfundTitle>
              {crowdfundData?.created && (
                <CrowdfundUpdateDate>
                  {formatDate(crowdfundData.created)}
                </CrowdfundUpdateDate>
              )}
            </UpdateCol>
          </UpdateRow>
          <Box sx={{ padding: "10px 5px" }}>
            <DisplayHtml html={crowdfundData?.inlineContent} />
          </Box>
          <AttachmentCol>
            {crowdfundData?.attachments?.length > 0 && (
              <>
                <CrowdfundSubTitle>Attachments</CrowdfundSubTitle>
              </>
            )}
            {crowdfundData?.attachments?.map(attachment => {
              if (attachment?.service === "AUDIO")
                return (
                  <AudioPlayer
                    key={attachment.identifier}
                    fullFile={attachment}
                    filename={attachment.filename}
                    name={attachment.name}
                    identifier={attachment.identifier}
                    service="AUDIO"
                    jsonId={crowdfundData?.id}
                    user={crowdfundData?.user}
                  />
                );

              return (
                <PlayerBox
                  key={attachment.identifier}
                  sx={{
                    minHeight: "55px",
                  }}
                >
                  <FileAttachmentContainer>
                    <AttachFileIcon
                      sx={{
                        height: "16px",
                        width: "auto",
                      }}
                    ></AttachFileIcon>
                    <FileAttachmentFont>
                      {attachment?.filename}
                    </FileAttachmentFont>
                    <FileElement
                      fileInfo={attachment}
                      title={attachment?.filename}
                      customStyles={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <DownloadIcon />
                    </FileElement>
                  </FileAttachmentContainer>
                </PlayerBox>
              );
            })}
          </AttachmentCol>
        </UpdateCol>
      </UpdateContainer>
    </>
  );
};
