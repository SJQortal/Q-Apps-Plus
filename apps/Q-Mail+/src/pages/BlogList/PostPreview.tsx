import React, { useMemo, useState } from 'react'
import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  CardMedia,
  Typography,
  Box,
  Button,
  Tooltip,
  useTheme
} from '@mui/material'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { styled } from '@mui/system'

import {
  CardContentContainer,
  StyledCard,
  StyledCardContent,
  TitleText,
  AuthorText,
  StyledCardHeader,
  StyledCardCol,
  IconsBox,
  BlockIconContainer,
  BookmarkIconContainer
} from './PostPreview-styles'
import moment from 'moment'
import {
  blockUser,
  BlogPost,
  removeFavorites,
  removeSubscription,
  upsertFavorites
} from '../../state/features/blogSlice'
import { useDispatch, useSelector } from 'react-redux'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import { AppDispatch, RootState } from '../../state/store'
import BlockIcon from '@mui/icons-material/Block'
import { CustomIcon } from '../../components/common/CustomIcon'
interface BlogPostPreviewProps {
  title: string
  createdAt: number | string
  author: string
  postImage?: string
  description: any
  blogPost: BlogPost
  onClick?: () => void
  isValid?: boolean
}

const BlogPostPreview: React.FC<BlogPostPreviewProps> = ({
  title,
  createdAt,
  author,
  postImage,
  description,
  onClick,
  blogPost,
  isValid
}) => {
  const [avatarUrl, setAvatarUrl] = React.useState<string>('')
  const [showIcons, setShowIcons] = React.useState<boolean>(false)

  const dispatch = useDispatch<AppDispatch>()
  const theme = useTheme()
  const favoritesLocal = useSelector(
    (state: RootState) => state.blog.favoritesLocal
  )
  const [isOpenAlert, setIsOpenAlert] = useState<boolean>(false)
  const subscriptions = useSelector(
    (state: RootState) => state.blog.subscriptions
  )
  const username = useSelector((state: RootState) => state.auth?.user?.name)
  const formatDate = (unixTimestamp: number): string => {
    const date = moment(unixTimestamp, 'x').fromNow()

    return date
  }

  function extractTextFromSlate(nodes: any) {
    if (!Array.isArray(nodes)) return ''
    let text = ''

    for (const node of nodes) {
      if (node.text) {
        text += node.text
      } else if (node.children) {
        text += extractTextFromSlate(node.children)
      }
    }

    return text
  }
  const getAvatar = React.useCallback(async () => {
    try {
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: author,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar'
      })

      setAvatarUrl(url)
    } catch (error) {}
  }, [author])

  React.useEffect(() => {
    getAvatar()
  }, [])

  const isFavorite = useMemo(() => {
    if (!favoritesLocal) return false
    return favoritesLocal.find((fav) => fav?.id === blogPost?.id)
  }, [favoritesLocal, blogPost?.id])

  const blockUserFunc = async (user: string) => {
    if (user === 'Q-Blog') return
    if (subscriptions.includes(user) && username) {
      try {
        const listName = `q-blog-subscriptions-${username}`

        const response = await qortalRequest({
          action: 'DELETE_LIST_ITEM',
          list_name: listName,
          item: user
        })
        if (response === true) {
          dispatch(removeSubscription(user))
        }
      } catch (error) {}
    }

    try {
      const response = await qortalRequest({
        action: 'ADD_LIST_ITEMS',
        list_name: 'blockedNames_q-blog',
        items: [user]
      })

      if (response === true) {
        dispatch(blockUser(user))
        dispatch(removeFavorites(blogPost.id))
      }
    } catch (error) {}
  }

  const continueToPost = () => {
    if (isValid === false) {
      setIsOpenAlert(true)
      return
    }
    if (!onClick) return
    onClick()
  }

  const handleClose = () => {
    setIsOpenAlert(false)
  }

  return (
    <>
      <StyledCard
        onClick={continueToPost}
        onMouseEnter={() => setShowIcons(true)}
        onMouseLeave={() => setShowIcons(false)}
      >
        {postImage && (
          <Box sx={{ padding: '2px' }}>
            <img
              src={postImage}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '8px'
              }}
            />
          </Box>
        )}
        <CardContentContainer>
          <StyledCardHeader
            sx={{
              '& .MuiCardHeader-content': {
                overflow: 'hidden'
              }
            }}
          >
            <Box>
              <Avatar src={avatarUrl} alt={`${author}'s avatar`} />
            </Box>
            <StyledCardCol>
              <TitleText
                color={theme.palette.text.primary}
                noWrap
                variant="body1"
              >
                {title}
              </TitleText>
              <AuthorText
                color={
                  theme.palette.mode === 'light'
                    ? theme.palette.text.secondary
                    : '#d6e8ff'
                }
              >
                {author}
              </AuthorText>
            </StyledCardCol>
          </StyledCardHeader>
          <StyledCardContent>
            <Typography variant="body2" color={theme.palette.text.primary}>
              {description}
            </Typography>
            <Box sx={{ textAlign: 'flex-start', width: '100%' }}>
              <Typography variant="h6" color={theme.palette.text.primary}>
                {formatDate(+createdAt)}
              </Typography>
            </Box>
          </StyledCardContent>
        </CardContentContainer>
      </StyledCard>
      <IconsBox
        sx={{ opacity: showIcons ? 1 : 0 }}
        onMouseEnter={() => setShowIcons(true)}
        onMouseLeave={() => setShowIcons(false)}
      >
        {username && isFavorite && (
          <Tooltip title="Remove from favorites" placement="top">
            <BookmarkIconContainer
              onMouseEnter={() => setShowIcons(true)}
              onMouseLeave={() => setShowIcons(false)}
            >
              <BookmarkIcon
                sx={{
                  color: 'red'
                }}
                onClick={() => {
                  dispatch(removeFavorites(blogPost.id))
                }}
              />
            </BookmarkIconContainer>
          </Tooltip>
        )}
        {username && !isFavorite && (
          <Tooltip title="Save to favorites" placement="top">
            <BookmarkIconContainer
              onMouseEnter={() => setShowIcons(true)}
              onMouseLeave={() => setShowIcons(false)}
            >
              <BookmarkBorderIcon
                onClick={() => {
                  dispatch(upsertFavorites([blogPost]))
                }}
              />
            </BookmarkIconContainer>
          </Tooltip>
        )}
        <Tooltip title="Block user content" placement="top">
          <BlockIconContainer
            onMouseEnter={() => setShowIcons(true)}
            onMouseLeave={() => setShowIcons(false)}
          >
            <BlockIcon
              onClick={() => {
                blockUserFunc(blogPost.user)
              }}
            />
          </BlockIconContainer>
        </Tooltip>
      </IconsBox>

      <Dialog
        open={isOpenAlert}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Invalid Content Structure
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This post seems to contain an invalid content structure. Click
            continue to proceed
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          <Button onClick={onClick} autoFocus>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BlogPostPreview
