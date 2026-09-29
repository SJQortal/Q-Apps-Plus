import React, { useCallback, useEffect, useMemo, useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  MailMessageRowContainer,
  MailMessageRowInfo,
  MailMessageRowInfoImg,
  MailMessageRowInfoStatusNotDecrypted,
  MailMessageRowInfoStatusRead,
  MailMessageRowProfile,
  MessageExtraDate,
  MessageExtraInfo,
  MessageExtraName,
} from "./Mail-styles";
import { AvatarWrapper } from "./MailTable";
import { formatFullTimestamp } from "../../utils/time";
import LockSVG from '../../assets/svgs/Lock.svg'
import AttachmentSVG from '../../assets/svgs/Attachment.svg'
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { base64ToUint8Array, uint8ArrayToObject } from "../../utils/toBase64";
import { Box, CircularProgress, IconButton, Tooltip, useMediaQuery } from "@mui/material";
import { parseSentRecipientFromIdentifier } from "./mailIdentifier";

const subjectDecryptCache = new Map<string, string>()
let subjectDecryptQueue: Promise<void> = Promise.resolve()

const decryptSubjectQueued = async (encryptedSubject: string): Promise<string> => {
  if (!encryptedSubject) return ""
  if (subjectDecryptCache.has(encryptedSubject)) {
    return subjectDecryptCache.get(encryptedSubject) || ""
  }

  let resolved = ""
  await new Promise<void>((resolve, reject) => {
    subjectDecryptQueue = subjectDecryptQueue
      .then(async () => {
        const requestEncryptSubject: any = {
          action: "DECRYPT_DATA",
          encryptedData: encryptedSubject,
        }
        const resDecryptSubject = await qortalRequest(requestEncryptSubject)
        const decryptToUnit8ArraySubject = base64ToUint8Array(resDecryptSubject)
        const responseDataSubject = uint8ArrayToObject(decryptToUnit8ArraySubject)
        resolved =
          typeof responseDataSubject === "string"
            ? responseDataSubject
            : responseDataSubject !== null && responseDataSubject !== undefined
              ? String(responseDataSubject)
              : ""
        subjectDecryptCache.set(encryptedSubject, resolved)
        resolve()
      })
      .catch(error => {
        reject(error)
      })
  })

  return resolved
}

interface MailMessageRowProp {
  messageData: any;
  openMessage: (user: string, id: string, content: any, alias?: string) => void;
  isOpen?: boolean;
  isFromSent?: boolean
  onDeleteMessage?: (message: any) => void | boolean | Promise<void | boolean>;
  isDeleting?: boolean;
  compact?: boolean;
  useFullTimestamp?: boolean;
}
export const MailMessageRow = ({
  messageData,
  openMessage,
  isOpen,
  isFromSent,
  onDeleteMessage,
  isDeleting = false,
  compact = false,
  useFullTimestamp = true,
}: MailMessageRowProp) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name)
  const [subjectInHashDecrypted, setSubjectInHashDecrypted] = useState<null | string>(null)
  const [hasAttachment, setHasAttachment] = useState<null | boolean>(null)
  const [sentToNameInfo, setSentToNameInfo] = useState({
    name: ""
  })
    const isMobile = useMediaQuery("(max-width:950px)");
  
  const [alias, setAlias] = useState<null | string>(null)

  const identifier = messageData?.id || messageData?.identifier
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  );
  const hashMapSavedSubjects = useSelector(
    (state: RootState) => state.mail.hashMapSavedSubjects
  );
  const subjectInHash = hashMapSavedSubjects[identifier]
  const data = hashMapMailMessages[identifier]

  useEffect(() => {
    setSubjectInHashDecrypted(null)
    setHasAttachment(null)
    setAlias(null)
    setSentToNameInfo({ name: "" })
  }, [identifier])

  const getSentToName = useCallback(async (id: string)=> {
    try {
      setAlias(null)
      setSentToNameInfo({ name: "" })
      const { recipientName, recipientAddress } =
        parseSentRecipientFromIdentifier(id);
      if(!recipientAddress && recipientName){
        setAlias(recipientName)
        return
      }
      if(!recipientName || !recipientAddress) return
      setSentToNameInfo({ name: recipientName })
      const response = await qortalRequest({
        action: "SEARCH_NAMES",
        query: recipientName,
        prefix: true, 
        limit: 10,
        reverse: false
      })
      const normalizedRecipientAddress = recipientAddress.toLowerCase()
      const findName = response?.find((item: any)=> {
        const owner = typeof item?.owner === "string" ? item.owner.toLowerCase() : ""
        const candidateName = typeof item?.name === "string" ? item.name.toLowerCase() : ""
        return (
          owner.endsWith(normalizedRecipientAddress) &&
          candidateName.startsWith(recipientName.toLowerCase())
        )
      })
      if(findName){
        setSentToNameInfo({
          name: findName.name
        })
      }
    } catch (error) {
      
    }
  }, [])
  useEffect(()=> {
    if(isFromSent && identifier){
      getSentToName(identifier)
    }
  }, [isFromSent, identifier, getSentToName])
  let isEncrypted = true;
  let hasAttachments = null
  let subject = ""
  const isMarkedRead = Array.isArray(messageData?.generalData?.threadV2)
    ? messageData.generalData.threadV2.length > 0
    : false;
  if(subjectInHashDecrypted !== null){
    subject = subjectInHashDecrypted || "- no subject"
    hasAttachments = hasAttachment || false
  }
  if(data && data?.isValid && !data?.unableToDecrypt){
      isEncrypted = false
      subject = data?.subject || "- no subject"
      hasAttachments = (data?.attachments || [])?.length > 0
  }


const getSubjectFromHash = useCallback(async (subjectValue: string, hasAttachmentParam: boolean) => {
  if(subjectValue === undefined || subjectValue === null) throw new Error('no subject')
  if(subjectValue === ""){
    setSubjectInHashDecrypted("")
    setHasAttachment(hasAttachmentParam)
    return
  }
  let decryptedSubject = ""
  try {
    decryptedSubject = await decryptSubjectQueued(subjectValue)
  } catch (error) {
    // Fallback for cases where stored subject may already be plaintext.
    decryptedSubject = subjectValue
  }
  setSubjectInHashDecrypted(decryptedSubject)
  setHasAttachment(hasAttachmentParam)
}, [])


useEffect(()=> {
  if(!isEncrypted) return

  if(subjectInHashDecrypted !== null) return
  if(!subjectInHash || subjectInHash?.subject === undefined || subjectInHash?.subject === null ) return
  void getSubjectFromHash(subjectInHash?.subject, !!subjectInHash?.attachments)
}, [isEncrypted, subjectInHashDecrypted, subjectInHash, getSubjectFromHash])

const name = useMemo(()=> {
  if(isFromSent){
    return sentToNameInfo?.name || ""
  }
  return messageData?.user
}, [sentToNameInfo, isFromSent, messageData])

  const createdAtLabel = useMemo(() => {
    return formatFullTimestamp(messageData?.createdAt)
  }, [messageData?.createdAt])

  const shouldBoldUnread = !isFromSent && isEncrypted && !isMarkedRead;

  const handleDeleteClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.preventDefault()
      if (!isFromSent || !onDeleteMessage || isDeleting) return
      await onDeleteMessage(messageData)
    },
    [isDeleting, isFromSent, messageData, onDeleteMessage]
  )
 
  if (compact) {
    return (
      <MailMessageRowContainer
        sx={{
          background: isOpen ? "var(--qmail-shell-hover-strong)" : "unset",
          alignItems: "center",
          borderRadius: "10px",
          padding: "8px 12px",
          outline: "1px solid var(--qmail-shell-border)",
          marginTop: "0px",
        }}
        onClick={() => {
          if (!identifier) return
          openMessage(
            messageData?.user,
            identifier,
            messageData,
            isFromSent ? alias || name : username
          )
        }}
      >
        <MailMessageRowInfo
          sx={{
            width: "100%",
            gap: "10px",
          }}
        >
          <MessageExtraDate
            sx={{
              color: "var(--qmail-thread-muted)",
              minWidth: {
                xs: "unset",
                md: "168px",
              },
              flexShrink: 0,
            }}
          >
            {createdAtLabel}
          </MessageExtraDate>
          {subject ? (
            <MailMessageRowInfoStatusRead
              sx={{
                fontWeight: shouldBoldUnread ? 600 : 300,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {subject}
            </MailMessageRowInfoStatusRead>
          ) : isEncrypted ? (
            <MailMessageRowInfoStatusNotDecrypted
              sx={{
                fontWeight: shouldBoldUnread ? 900 : 300,
              }}
            >
              ACCESS TO DECRYPT
            </MailMessageRowInfoStatusNotDecrypted>
          ) : null}
        </MailMessageRowInfo>
        {isFromSent && onDeleteMessage && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Tooltip title="Delete sent message">
              <span>
                <IconButton
                  size="small"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  aria-label="Delete sent message"
                  sx={{
                    color: "var(--qmail-danger-text)",
                    border: "1px solid var(--qmail-shell-border)",
                    background: "var(--qmail-shell-hover)",
                    "&:hover": {
                      background: "var(--qmail-shell-hover-strong)",
                    },
                    "&.Mui-disabled": {
                      color: "var(--qmail-shell-muted)",
                      borderColor: "var(--qmail-shell-border)",
                    },
                  }}
                >
                  {isDeleting ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <DeleteOutlineIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </MailMessageRowContainer>
    )
  }

  return (
    <MailMessageRowContainer sx={{
      background: isOpen ? 'var(--qmail-shell-hover-strong)' : 'unset',
      flexDirection: isMobile ? 'column': 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      borderRadius: isMobile ? '10px' : "56px 5px 10px 56px",
      padding: isMobile ? '5px' : 'center',
      outline: isMobile ? '1px solid var(--qmail-shell-border)' : 'none',
      marginTop: isMobile ? '10px' : '0px'
    }} onClick={()=> {
        if(!identifier) return
        openMessage(messageData?.user, identifier, messageData, isFromSent ? (alias || name) : username)
    }}>
      <MailMessageRowProfile>
        <AvatarWrapper isAlias={!!alias} height="50px" user={name} fallback={alias || name}></AvatarWrapper>
        <MessageExtraInfo>
          <MessageExtraName sx={{
            fontWeight: shouldBoldUnread ? "900" : "300"
          }}>{isFromSent ? "To: " : ""} {alias || name}</MessageExtraName>
          <MessageExtraDate>{createdAtLabel}</MessageExtraDate>
        </MessageExtraInfo>
      </MailMessageRowProfile>
      <MailMessageRowInfo>
        {hasAttachments ?  <MailMessageRowInfoImg src={AttachmentSVG} /> : hasAttachments === false ? null : isEncrypted ?  <MailMessageRowInfoImg src={LockSVG} />   : null}
       

        {subject ? (
          <MailMessageRowInfoStatusRead
            sx={{
              fontWeight: shouldBoldUnread ? 600 : 300,
            }}
          >
            {subject}
          </MailMessageRowInfoStatusRead>
        )  : isEncrypted ? (
          <MailMessageRowInfoStatusNotDecrypted
            sx={{
              fontWeight: shouldBoldUnread ? 900 : 300,
            }}
          >
            ACCESS TO DECRYPT
          </MailMessageRowInfoStatusNotDecrypted>
        ) : null}
      </MailMessageRowInfo>
      {isFromSent && onDeleteMessage && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Tooltip title="Delete sent message">
            <span>
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                aria-label="Delete sent message"
                sx={{
                  color: "var(--qmail-danger-text)",
                  border: "1px solid var(--qmail-shell-border)",
                  background: "var(--qmail-shell-hover)",
                  "&:hover": {
                    background: "var(--qmail-shell-hover-strong)",
                  },
                  "&.Mui-disabled": {
                    color: "var(--qmail-shell-muted)",
                    borderColor: "var(--qmail-shell-border)",
                  },
                }}
              >
                {isDeleting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DeleteOutlineIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
    </MailMessageRowContainer>
  );
};
