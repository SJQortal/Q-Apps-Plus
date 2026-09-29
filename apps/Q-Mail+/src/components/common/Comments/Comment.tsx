import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme
} from '@mui/material'
import React, { useCallback, useState } from 'react'
import { CommentEditor } from './CommentEditor'
import { CardContentContainerComment } from '../../../pages/BlogList/PostPreview-styles'
import { StyledCardHeaderComment } from '../../../pages/BlogList/PostPreview-styles'
import { StyledCardColComment } from '../../../pages/BlogList/PostPreview-styles'
import { AuthorTextComment } from '../../../pages/BlogList/PostPreview-styles'
import { StyledCardContentComment } from '../../../pages/BlogList/PostPreview-styles'
import { useSelector } from 'react-redux'
import { RootState } from '../../../state/store'
import Portal from '../Portal'
import { Tipping } from '../Tipping/Tipping'
interface CommentProps {
  comment: any
  postId: string
  onSubmit: (obj?: any, isEdit?: boolean) => void
}
export const Comment = ({ comment, postId, onSubmit }: CommentProps) => {
  const [isReplying, setIsReplying] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const { user } = useSelector((state: RootState) => state.auth)
  const [currentEdit, setCurrentEdit] = useState<any>(null)
  const handleSubmit = useCallback((comment: any, isEdit?: boolean) => {
    onSubmit(comment, isEdit)
    setCurrentEdit(null)
    setIsReplying(false)
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        flexDirection: 'column'
      }}
    >
      {currentEdit && (
        <Portal>
          <Dialog
            open={!!currentEdit}
            onClose={() => setCurrentEdit(null)}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title"></DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  width: '300px',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <CommentEditor
                  onSubmit={(obj) => handleSubmit(obj, true)}
                  postId={postId}
                  isEdit
                  commentId={currentEdit?.identifier}
                  commentMessage={currentEdit?.message}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setCurrentEdit(null)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </Portal>
      )}
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column'
        }}
      >
        <CommentCard
          name={comment?.name}
          message={comment?.message}
          replies={comment?.replies || []}
          setCurrentEdit={setCurrentEdit}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '20px',
              justifyContent: 'flex-end'
            }}
          >
            <Button
              size="small"
              variant="contained"
              onClick={() => setIsReplying(true)}
            >
              reply
            </Button>
            {user?.name === comment?.name && (
              <Button
                size="small"
                variant="contained"
                onClick={() => setCurrentEdit(comment)}
              >
                edit
              </Button>
            )}
            {isReplying && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setIsReplying(false)
                  setIsEditing(false)
                }}
              >
                close
              </Button>
            )}
          </Box>
        </CommentCard>
        {/* <Typography variant="body1"> {comment?.message}</Typography> */}
      </Box>

      <Box
        sx={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {isReplying && (
          <CommentEditor
            onSubmit={handleSubmit}
            postId={postId}
            isReply
            commentId={comment.identifier}
          />
        )}
      </Box>
    </Box>
  )
}

const CommentCard = ({
  message,
  created,
  name,
  replies,
  children,
  setCurrentEdit
}: any) => {
  const [avatarUrl, setAvatarUrl] = React.useState<string>('')
  const { user } = useSelector((state: RootState) => state.auth)

  const theme = useTheme()

  const getAvatar = React.useCallback(async (author: string) => {
    try {
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: author,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar'
      })

      setAvatarUrl(url)
    } catch (error) {}
  }, [])

  React.useEffect(() => {
    getAvatar(name)
  }, [name])
  return (
    <CardContentContainerComment>
      <StyledCardHeaderComment
        sx={{
          '& .MuiCardHeader-content': {
            overflow: 'hidden'
          }
        }}
      >
        <Box>
          <Avatar src={avatarUrl} alt={`${name}'s avatar`} />
        </Box>
        <StyledCardColComment>
          <AuthorTextComment
            color={
              theme.palette.mode === 'light'
                ? theme.palette.text.secondary
                : '#d6e8ff'
            }
          >
            {name}
          </AuthorTextComment>
        </StyledCardColComment>
        {name && (
          <Tipping
            name={name}
            onSubmit={() => {
              // setNameTip('')
            }}
            onClose={() => {
              // setNameTip('')
            }}
            onlyIcon={true}
          />
        )}
      </StyledCardHeaderComment>
      <StyledCardContentComment>
        <Typography
          variant="body2"
          color={theme.palette.text.primary}
          sx={{
            fontSize: '1rem'
          }}
        >
          {message}
        </Typography>
      </StyledCardContentComment>
      <Box
        sx={{
          paddingLeft: '15px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {replies?.map((reply: any) => {
          return (
            <Box
              key={reply?.identifier}
              sx={{
                display: 'flex',
                border: '1px solid grey',
                borderRadius: '10px',
                marginTop: '8px'
              }}
            >
              <CommentCard
                name={reply?.name}
                message={reply?.message}
                setCurrentEdit={setCurrentEdit}
              >
                {user?.name === reply?.name && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => setCurrentEdit(reply)}
                    sx={{
                      width: '30px',
                      alignSelf: 'flex-end',
                      background: theme.palette.primary.light
                    }}
                  >
                    edit
                  </Button>
                )}
              </CommentCard>
              {/* <Typography variant="body2"> {reply?.message}</Typography> */}
            </Box>
          )
        })}
      </Box>
      {children}
    </CardContentContainerComment>
  )
}
