import React, { useEffect, useMemo, useState } from "react";
import { ReusableModal } from "../../components/modals/ReusableModal";
import { Box, Button, Input, Typography } from "@mui/material";
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
import MailThreadWithoutCalling from "./MailThreadWithoutCalling";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { Spacer } from "../../components/common/Spacer";
import { MailAttachmentImg, MoreImg, MoreP, ShowMessageButton, ShowMessageButtonImg, ShowMessageButtonP, ShowMessageNameP, ShowMessageSubjectP, ShowMessageTimeP } from "./Mail-styles";
import ReplySVG from '../../assets/svgs/Reply.svg'
import ForwardSVG from '../../assets/svgs/Forward.svg'
import MoreSVG from "../../assets/svgs/More.svg";
import AttachmentMailSVG from "../../assets/svgs/AttachmentMail.svg";


const initialValue: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];
const uid = new ShortUniqueId();

export const ShowMessageV2Replies = ({
  message,
}: any) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [expandAttachments, setExpandAttachments] = useState<boolean>(false);


  const [isExpanded, setIsExpanded] = useState(false);


  const isUser = useMemo(()=> {
    return username === message?.user
  }, [username, message])



  let cleanHTML = "";
  if (message?.htmlContent) {
    cleanHTML = DOMPurify.sanitize(message.htmlContent);
  }

  return (
    <Box sx={{
      padding: !isUser ? '0px 15px' : 'unset',
      flexShrink: 0,
      width: '100%'
    }}
    className={isUser ? "" : "reply-other"}
    >
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        borderRadius: "4px",
        background: !isUser ? "var(--qmail-reply-other-bg)" : "unset",
        color: !isUser ? "var(--qmail-reply-other-text)" : "inherit",
        padding: "7px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          gap: 1,
          flexGrow: 1,
          overflow: "auto",
          width: "100%",
          padding: "0 15px",
        }}
      >
        <Box
        onClick={()=> {
          setIsExpanded((prev)=> !prev)
        }}
          sx={{
            cursor: 'pointer',
            display: "flex",
            gap: '20px',
            justifyContent: "flex-start",
            alignItems: "flex-start",
            width: "100%",
            flexDirection: !isUser ? 'row-reverse' : 'unset'
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: "6px"
            }}
          >
            <AvatarWrapper height="40px" user={message?.user} />
            <Box sx={{
            display: "flex",
            flexDirection: 'column',
            gap: '1px',
            justifyContent: "flex-start",
            maxWidth: '160px',
            minWidth: '120px'

          }}>
            <ShowMessageNameP
          sx={{
            color: !isUser ? "var(--qmail-reply-other-text)" : "unset"
          }}
            >
              {message?.user}
            </ShowMessageNameP>
            <ShowMessageTimeP
            sx={{
              color: !isUser ? "var(--qmail-reply-other-text)" : "unset"
            }}
            >
              {formatFullTimestamp(message?.createdAt)}
            </ShowMessageTimeP>
            
            </Box>
            
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <ShowMessageSubjectP
            sx={{
              color: !isUser ? "var(--qmail-reply-other-text)" : "unset"
            }}
            >
              {message?.subject}
            </ShowMessageSubjectP>
           
          </Box>
        </Box>
        {isExpanded && (
          <>
            {message?.attachments?.length > 0 && (
          <Box
            sx={{
              width: "100%",
              marginTop: "10px",
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
                            ({message?.attachments?.length - 1} more)
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
          </Box>
        )}
        <Spacer height="7px" />
        {message?.textContentV2 && (
          <DisplayHtml
            html={message?.textContentV2}
            textColor={
              !isUser
                ? "var(--qmail-reply-other-text)"
                : "var(--qmail-thread-text)"
            }
          />
        )}
          </>
        )}
      
      </Box>
    
    </Box>
    </Box>
  );
};
