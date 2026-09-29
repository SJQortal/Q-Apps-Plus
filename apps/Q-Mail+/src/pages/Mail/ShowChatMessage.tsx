import React, { useEffect, useState } from 'react'
import { ReusableModal } from '../../components/modals/ReusableModal'
import { Box, Button, Input, Typography, useTheme } from '@mui/material'
import { BuilderButton } from '../CreatePost/CreatePost-styles'
import BlogEditor from '../../components/editor/BlogEditor'
import EmailIcon from '@mui/icons-material/Email'
import { Descendant } from 'slate'
import ShortUniqueId from 'short-unique-id'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import DOMPurify from 'dompurify'
import { setNotification } from '../../state/features/notificationsSlice'
import {
  objectToBase64,
  objectToUint8Array,
  objectToUint8ArrayFromResponse,
  uint8ArrayToBase64
} from '../../utils/toBase64'
import ReadOnlySlate from '../../components/editor/ReadOnlySlate'
import MailThread from './MailThread'
import { AvatarWrapper } from './MailTable'
import { formatFullTimestamp } from '../../utils/time'
import FileElement from '../../components/FileElement'
const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: '' }]
  }
]
const uid = new ShortUniqueId()

export const ShowChatMessage = ({ message }: any) => {
  const theme = useTheme()
  let cleanHTML = ''
  if (message?.messageHTML) {
    cleanHTML = DOMPurify.sanitize(message?.messageHTML)
  }
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        marginBottom: '15px'
      }}
      id={message.signature}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 1,
          flexGrow: 1,
          overflow: 'auto',
          width: '100%',
          maxWidth: '90%',
          background: theme.palette.background.default,
          padding: '10px',
          borderRadius: '5px'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AvatarWrapper user={message?.senderName} />
            <Typography
              sx={{
                fontSize: '1rem'
              }}
            >
              {message?.senderName}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Typography
              sx={{
                fontSize: '1rem'
              }}
            >
              {formatFullTimestamp(message?.timestamp)}
            </Typography>
          </Box>
        </Box>

        {cleanHTML && (
          <div
            style={{
              width: '100%'
            }}
            dangerouslySetInnerHTML={{ __html: cleanHTML }}
          />
        )}
      </Box>
    </Box>
  )
}
