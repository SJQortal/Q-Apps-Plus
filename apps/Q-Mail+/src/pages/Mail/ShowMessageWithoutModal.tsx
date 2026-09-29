import React, { useEffect, useState } from "react";
import { ReusableModal } from "../../components/modals/ReusableModal";
import { Box, Button, Input, Typography, useTheme } from "@mui/material";
import { BuilderButton } from "../CreatePost/CreatePost-styles";
import BlogEditor from "../../components/editor/BlogEditor";
import EmailIcon from "@mui/icons-material/Email";
import { Descendant } from "slate";
import ShortUniqueId from "short-unique-id";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DOMPurify from "dompurify";
import { setNotification } from "../../state/features/notificationsSlice";
import {
  objectToBase64,
  objectToUint8Array,
  objectToUint8ArrayFromResponse,
  uint8ArrayToBase64,
} from "../../utils/toBase64";
import ReadOnlySlate from "../../components/editor/ReadOnlySlate";
import MailThread from "./MailThread";
import { AvatarWrapper } from "./MailTable";
import { formatFullTimestamp } from "../../utils/time";
import FileElement from "../../components/FileElement";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import AttachmentMailSVG from "../../assets/svgs/AttachmentMail.svg";
import MoreSVG from "../../assets/svgs/More.svg";
import {
  MailAttachmentImg,
  MoreImg,
  MoreP,
  SingleTheadMessageParent,
  SingleThreadParent,
  ThreadInfoColumn,
  ThreadInfoColumnNameP,
  ThreadInfoColumnTime,
  ThreadInfoColumnbyP,
  ThreadSingleLastMessageP,
  ThreadSingleLastMessageSpanP,
  ThreadSingleTitle,
} from "./Mail-styles";
import { Spacer } from "../../components/common/Spacer";
const initialValue: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];
const uid = new ShortUniqueId();

export const ShowMessage = ({ message }: any) => {
  const [expandAttachments, setExpandAttachments] = useState<boolean>(false);

  const theme = useTheme();
  let cleanHTML = "";
  if (message?.htmlContent) {
    cleanHTML = DOMPurify.sanitize(message.htmlContent);
  }

  return (
    <SingleTheadMessageParent
      sx={{
        height: "auto",
        alignItems: "flex-start",
        cursor: "default",
        borderRadius: '35px 4px 4px 4px'
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: '100%'
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",

          }}
        >
          <AvatarWrapper
            isAlias={false}
            height="50px"
            user={message?.name}
            fallback={message?.name}
          ></AvatarWrapper>
          <ThreadInfoColumn>
            <ThreadInfoColumnNameP>{message?.name}</ThreadInfoColumnNameP>
            <ThreadInfoColumnTime>
              {formatFullTimestamp(message?.created)}
            </ThreadInfoColumnTime>
          </ThreadInfoColumn>
          <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
         {message?.attachments?.length > 0 && (
          <Box
            sx={{
              width: "100%",
              marginTop: "10px",
            }}
          >
            {message?.attachments
              .map((file: any, index: number) => {
                const isFirst = index === 0
                return (
                  <Box
                    sx={{
                      display: expandAttachments ? "flex" : !expandAttachments && isFirst ? 'flex' : 'none',
                      alignItems: "center",
                      justifyContent: "flex-start",
                      width: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        cursor: "pointer",
                        width: "auto",
                      }}
                    >
                      <FileElement
                        fileInfo={{ ...file, mimeTypeSaved: file?.type }}
                        title={file?.filename}
                        mode="mail"
                        otherUser={message?.user}
                      >
                        <MailAttachmentImg src={AttachmentMailSVG} />

                        <Typography
                          sx={{
                            fontSize: "1rem",
                            transition: '0.2s all',
                            "&:hover": {
                              color: 'var(--qmail-thread-link-hover)',
                              textDecoration: 'underline'
                            }
                          }}
                        >
                          {file?.originalFilename || file?.filename}
                        </Typography>
                      </FileElement>
                      {message?.attachments?.length > 1 && isFirst && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          onClick={() => {
                            setExpandAttachments(prev => !prev);
                          }}
                        >
                          <MoreImg
                            sx={{
                              marginLeft: "5px",
                              transform: expandAttachments
                                ? "rotate(180deg)"
                                : "unset",
                            }}
                            src={MoreSVG}
                          />
                          <MoreP>
                            {expandAttachments ? 'hide' : `(${message?.attachments?.length - 1} more)`}
                            
                          </MoreP>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })
              }
          </Box>
        )}
      
      </div>
        </Box>
        <Spacer height="20px" />

        {message?.textContent && (
          <ReadOnlySlate content={message.textContent} mode="mail" />
        )}
        {message?.textContentV2 && (
          <DisplayHtml html={message?.textContentV2} />
        )}
        {message?.htmlContent && (
          <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />
        )}
      </Box>

      
     
    </SingleTheadMessageParent>
  );
};
