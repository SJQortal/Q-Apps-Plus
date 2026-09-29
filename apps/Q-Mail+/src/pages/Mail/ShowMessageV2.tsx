import React, { useState } from "react";
import { Box, IconButton, Typography, useMediaQuery } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DOMPurify from "dompurify";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import ReadOnlySlate from "../../components/editor/ReadOnlySlate";
import { AvatarWrapper } from "./MailTable";
import { formatFullTimestamp } from "../../utils/time";
import FileElement from "../../components/FileElement";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { Spacer } from "../../components/common/Spacer";
import {
  MailAttachmentImg,
  MoreImg,
  MoreP,
  ShowMessageButton,
  ShowMessageButtonImg,
  ShowMessageButtonP,
  ShowMessageNameP,
  ShowMessageSubjectP,
  ShowMessageTimeP,
} from "./Mail-styles";
import ReplySVG from "../../assets/svgs/Reply.svg";
import ForwardSVG from "../../assets/svgs/Forward.svg";
import AttachmentMailSVG from "../../assets/svgs/AttachmentMail.svg";
import MoreSVG from "../../assets/svgs/More.svg";
import { ShowMessageV2Replies } from "./ShowMessageV2Replies";
import { updateMessageDetails } from "../../utils/helpers";

export const ShowMessageV2 = ({
  setIsOpen,
  message,
  setReplyTo,
  alias,
  setForwardInfo,
  onClose,
}: any) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const isMobile = useMediaQuery("(max-width:950px)");
  const [expandAttachments, setExpandAttachments] = useState<boolean>(false);

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    if (typeof setIsOpen === "function") {
      setIsOpen(false);
    }
  };

  const handleReply = () => {
    setReplyTo(message);
  };

  const handleForwardedMessage = () => {
    if (!username) return;
    let secondpart = "";
    if (message?.textContentV2) {
      secondpart = message.textContentV2;
    }
    if (message?.htmlContent) {
      secondpart = DOMPurify.sanitize(message.htmlContent);
    }
    let newTo = username;
    if (alias) {
      newTo = `${alias} (alias inbox)`;
    }
    const firstPart = updateMessageDetails(
      message?.user,
      message?.subject || "",
      newTo
    );
    const fullMessage = firstPart + secondpart;
    setForwardInfo(fullMessage);
  };

  let cleanHTML = "";
  if (message?.htmlContent) {
    cleanHTML = DOMPurify.sanitize(message.htmlContent);
  }

  const replyAndForwardButtons = (
    <>
      <ShowMessageButton
        sx={{
          padding: "6px 12px",
          minWidth: "unset",
        }}
        onClick={handleReply}
      >
        <ShowMessageButtonImg src={ReplySVG} />
        <ShowMessageButtonP>Reply</ShowMessageButtonP>
      </ShowMessageButton>
      <ShowMessageButton
        sx={{
          padding: "6px 12px",
          minWidth: "unset",
        }}
        onClick={handleForwardedMessage}
      >
        <ShowMessageButtonP>Forward</ShowMessageButtonP>
        <ShowMessageButtonImg src={ForwardSVG} />
      </ShowMessageButton>
    </>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <Box
        sx={{
          width: "100%",
          padding: "0 15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              minWidth: 0,
              flex: 1,
            }}
          >
            <AvatarWrapper height="50px" user={message?.user} />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "1px",
                justifyContent: "flex-start",
                minWidth: 0,
              }}
            >
              <ShowMessageNameP>{message?.user}</ShowMessageNameP>
              <ShowMessageTimeP sx={{ marginTop: "2px" }}>
                to: {message?.to}
              </ShowMessageTimeP>
              <ShowMessageTimeP>
                {formatFullTimestamp(message?.createdAt)}
              </ShowMessageTimeP>
            </Box>
          </Box>

          {!isMobile && (
            <ShowMessageSubjectP
              sx={{
                flex: 1,
                minWidth: 0,
                wordBreak: "break-word",
              }}
            >
              {message?.subject || "- no subject"}
            </ShowMessageSubjectP>
          )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            {!isMobile && replyAndForwardButtons}
            <IconButton
              aria-label="Close message"
              onClick={handleClose}
              sx={{
                borderRadius: "4px",
                border: "0.5px solid var(--qmail-message-button-border)",
                color: "var(--qmail-message-button-text)",
                backgroundColor: "var(--qmail-message-button-bg)",
                "&:hover": {
                  background: "var(--qmail-message-button-hover)",
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {isMobile && (
          <ShowMessageSubjectP
            sx={{
              width: "100%",
              minWidth: 0,
              wordBreak: "break-word",
            }}
          >
            {message?.subject || "- no subject"}
          </ShowMessageSubjectP>
        )}

        {isMobile && (
          <Box
            sx={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {replyAndForwardButtons}
          </Box>
        )}

        {message?.attachments?.length > 0 && (
          <Box
            sx={{
              width: "100%",
              marginTop: "6px",
            }}
          >
            {message?.attachments.map((file: any, index: number) => {
              const isFirst = index === 0;
              return (
                <Box
                  key={`${file?.filename || "attachment"}-${index}`}
                  sx={{
                    display:
                      expandAttachments || (!expandAttachments && isFirst)
                        ? "flex"
                        : "none",
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
                          transition: "0.2s all",
                          "&:hover": {
                            textDecoration: "underline",
                          },
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
                          setExpandAttachments((prev) => !prev);
                        }}
                      >
                        <MoreImg
                          sx={{
                            marginLeft: "5px",
                            transform: expandAttachments ? "rotate(180deg)" : "unset",
                          }}
                          src={MoreSVG}
                        />
                        <MoreP>
                          {expandAttachments
                            ? "hide"
                            : `(${message?.attachments?.length - 1} more)`}
                        </MoreP>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        <Spacer height="7px" />
        {message?.textContentV2 && <DisplayHtml html={message?.textContentV2} />}
        {message?.htmlContent && <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />}
      </Box>

      <Spacer height="20px" />
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {message?.generalData?.threadV2 &&
          [...(message?.generalData?.threadV2 || [])]
            .sort((a, b) => {
              if (!a.data || !b.data) return 0;
              return a.data.createdAt - b.data.createdAt;
            })
            .map((msg) => {
              if (!msg?.data) return null;
              return <ShowMessageV2Replies key={msg.data.id} message={msg.data} />;
            })}
        <Box
          sx={{
            width: "100%",
            padding: "15px",
          }}
        >
          {message?.textContent && <ReadOnlySlate content={message.textContent} mode="mail" />}
        </Box>
      </Box>
    </Box>
  );
};
