import { Box, Button, TextField } from '@mui/material'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../state/store'
import ShortUniqueId from 'short-unique-id'
import { setNotification } from '../../../state/features/notificationsSlice'
import { toBase64 } from '../../../utils/toBase64'
const uid = new ShortUniqueId()
interface CommentEditorProps {
  postId: string
  onSubmit: (obj: any) => void
  isReply?: boolean
  commentId?: string
  isEdit?: boolean
  commentMessage?: string
}

function utf8ToBase64(inputString: string): string {
  // Encode the string as UTF-8
  const utf8String = encodeURIComponent(inputString).replace(
    /%([0-9A-F]{2})/g,
    (match, p1) => String.fromCharCode(Number('0x' + p1))
  )

  // Convert the UTF-8 encoded string to base64
  const base64String = btoa(utf8String)
  return base64String
}

export const CommentEditor = ({
  onSubmit,
  postId,
  isReply,
  commentId,
  isEdit,
  commentMessage
}: CommentEditorProps) => {
  const [value, setValue] = useState<string>('')
  const dispatch = useDispatch()
  const { user } = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    if (isEdit && commentMessage) {
      setValue(commentMessage)
    }
  }, [isEdit, commentMessage])
  const publishComment = async (identifier: string) => {
    let address
    let name
    let errorMsg = ''

    address = user?.address
    name = user?.name || ''

    if (!address) {
      errorMsg = "Cannot post: your address isn't available"
    }
    if (!name) {
      errorMsg = 'Cannot post without a name'
    }

    if (value.length > 200) {
      errorMsg = 'Comment needs to be under 200 characters'
    }

    if (errorMsg) {
      dispatch(
        setNotification({
          msg: errorMsg,
          alertType: 'error'
        })
      )
      throw new Error(errorMsg)
    }

    try {
      const base64 = utf8ToBase64(value)
      const resourceResponse = await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        name: name,
        service: 'BLOG_COMMENT',
        data64: base64,
        identifier: identifier
      })
      dispatch(
        setNotification({
          msg: 'Comment successfully published',
          alertType: 'success'
        })
      )
      return resourceResponse
    } catch (error: any) {
      let notificationObj = null
      if (typeof error === 'string') {
        notificationObj = {
          msg: error || 'Failed to publish comment',
          alertType: 'error'
        }
      } else if (typeof error?.error === 'string') {
        notificationObj = {
          msg: error?.error || 'Failed to publish comment',
          alertType: 'error'
        }
      } else {
        notificationObj = {
          msg: error?.message || 'Failed to publish comment',
          alertType: 'error'
        }
      }
      if (!notificationObj) throw new Error('Failed to publish comment')

      dispatch(setNotification(notificationObj))
      throw new Error('Failed to publish comment')
    }
  }
  const handleSubmit = async () => {
    try {
      const id = uid()

      let identifier = `qcomment_v1_qblog_${postId.slice(-12)}_${id}`
      if (isReply && commentId) {
        identifier = `qcomment_v1_qblog_${postId.slice(
          -12
        )}_reply_${commentId.slice(-6)}_${id}`
      }
      if (isEdit && commentId) {
        identifier = commentId
      }
      await publishComment(identifier)
      onSubmit({
        created: Date.now(),
        identifier,
        message: value,
        service: 'BLOG_COMMENT',
        name: user?.name
      })
      setValue('')
    } catch (error) {}
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        marginTop: '15px',
        width: '90%'
      }}
    >
      <TextField
        id="standard-multiline-flexible"
        label="Your comment"
        multiline
        maxRows={4}
        variant="filled"
        value={value}
        inputProps={{
          maxLength: 200,
          style: {
            fontSize: '1rem'
          }
        }}
        InputLabelProps={{ style: { fontSize: '1.125rem' } }}
        onChange={(e) => setValue(e.target.value)}
      />

      <Button variant="contained" onClick={handleSubmit}>
        {isReply ? 'Submit reply' : isEdit ? 'Edit' : 'Submit comment'}
      </Button>
    </Box>
  )
}
