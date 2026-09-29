import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CommentEditor } from './CommentEditor'
import { Comment } from './Comment'
import { Box, Button, Drawer, Typography, useTheme } from '@mui/material'
import { styled } from '@mui/system'
import CloseIcon from '@mui/icons-material/Close'
import { useSelector } from 'react-redux'
import { RootState } from '../../../state/store'
import CommentIcon from '@mui/icons-material/Comment'
interface CommentSectionProps {
  postId: string
}

const Panel = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding-bottom: 10px;
  height: 100%;
  overflow: hidden;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #888;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: #555;
  }
`
export const CommentSection = ({ postId }: CommentSectionProps) => {
  const [listComments, setListComments] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const { user } = useSelector((state: RootState) => state.auth)
  const [newMessages, setNewMessages] = useState(0)
  const theme = useTheme()
  const onSubmit = (obj?: any, isEdit?: boolean) => {
    if (isEdit) {
      setListComments((prev: any[]) => {
        const findCommentIndex = prev.findIndex(
          (item) => item?.identifier === obj?.identifier
        )
        if (findCommentIndex === -1) return prev

        const newArray = [...prev]
        newArray[findCommentIndex] = obj
        return newArray
      })

      return
    }
    setListComments((prev) => [
      ...prev,
      {
        ...obj
      }
    ])
  }
  const getComments = useCallback(
    async (isNewMessages?: boolean, numberOfComments?: number) => {
      let offset: number = 0
      if (isNewMessages && numberOfComments) {
        offset = numberOfComments
      }
      const query = `qcomment_v1_qblog_${postId.slice(-12)}`
      const params = new URLSearchParams({
        mode: 'ALL',
        service: 'BLOG_COMMENT',
        query,
        limit: '20',
        includemetadata: 'true',
        offset: String(offset),
        reverse: 'false',
        excludeblocked: 'true'
      })
      const url = `/arbitrary/resources/search?${params.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      let comments: any[] = []
      for (const comment of responseData) {
        if (comment.identifier && comment.name) {
          const url = `/arbitrary/BLOG_COMMENT/${encodeURIComponent(
            comment.name
          )}/${encodeURIComponent(comment.identifier)}`
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })

          const responseData2 = await response.text()
          if (responseData) {
            comments.push({
              message: responseData2,
              ...comment
            })
          }
        }
      }
      if (isNewMessages) {
        setListComments((prev) => [...prev, ...comments])
        setNewMessages(0)
      } else {
        setListComments(comments)
      }

      try {
      } catch (error) {}
    },
    []
  )

  useEffect(() => {
    getComments()
  }, [getComments])

  const structuredCommentList = useMemo(() => {
    return listComments.reduce((acc, curr, index, array) => {
      if (curr?.identifier?.includes('_reply_')) {
        return acc
      }
      acc.push({
        ...curr,
        replies: array.filter((comment) =>
          comment.identifier.includes(`_reply_${curr.identifier.slice(-6)}`)
        )
      })
      return acc
    }, [])
  }, [listComments])

  const interval = useRef<any>(null)

  const checkNewComments = useCallback(async () => {
    try {
      const offset = listComments.length
      const query = `qcomment_v1_qblog_${postId.slice(-12)}`
      const params = new URLSearchParams({
        mode: 'ALL',
        service: 'BLOG_COMMENT',
        query,
        limit: '20',
        includemetadata: 'true',
        offset: String(offset),
        reverse: 'false',
        excludeblocked: 'true'
      })
      const url = `/arbitrary/resources/search?${params.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      setNewMessages(responseData.length)
    } catch (error) {}
  }, [listComments, postId])

  const checkNewMessagesFunc = useCallback(() => {
    let isCalling = false
    interval.current = setInterval(async () => {
      if (isCalling) return
      isCalling = true
      const res = await checkNewComments()
      isCalling = false
    }, 15000)
  }, [checkNewComments])

  useEffect(() => {
    checkNewMessagesFunc()

    return () => {
      if (interval?.current) {
        clearInterval(interval.current)
      }
    }
  }, [checkNewMessagesFunc])

  return (
    <>
      <Box
        sx={{
          position: 'relative'
        }}
      >
        <CommentIcon
          sx={{
            cursor: 'pointer'
          }}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          Comments
        </CommentIcon>
        {listComments?.length > 0 && (
          <Box
            sx={{
              fontSize: '0.75rem',
              background: theme.palette.mode === 'dark' ? 'white' : 'black',
              color: theme.palette.mode === 'dark' ? 'black' : 'white',
              borderRadius: '50%',
              position: 'absolute',
              top: '-15px',
              right: '-15px',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {listComments.length < 10 ? listComments.length : '9+'}
          </Box>
        )}
      </Box>

      <Drawer
        variant="persistent"
        hideBackdrop={true}
        anchor="right"
        open={isOpen}
        onClose={() => {}}
        ModalProps={{
          keepMounted: true // Better performance on mobile
        }}
        sx={{
          '& .MuiPaper-root': {
            width: '400px'
          }
        }}
      >
        <Panel>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: '0 0',
              padding: '10px',
              width: '100%'
            }}
          >
            <Box
              sx={{
                display: 'flex'
              }}
            >
              {newMessages > 0 && (
                <Button
                  onClick={() => getComments(true, listComments.length)}
                  variant="contained"
                  size="small"
                >
                  Load {newMessages} new{' '}
                  {newMessages > 1 ? 'messages' : 'message'}
                </Button>
              )}
            </Box>
            <CloseIcon
              sx={{
                cursor: 'pointer'
              }}
              onClick={() => setIsOpen(false)}
            />
          </Box>

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              flex: '1',
              overflow: 'auto'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                margin: '25px 0px 50px 0px',
                maxWidth: '400px',
                width: '100%',
                gap: '10px',
                padding: '0px 5px'
              }}
            >
              {structuredCommentList.map((comment: any) => {
                return (
                  <Comment
                    key={comment?.identifier}
                    comment={comment}
                    onSubmit={onSubmit}
                    postId={postId}
                  />
                )
              })}
            </Box>
          </Box>
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              flex: '0 0 100px'
            }}
          >
            <CommentEditor onSubmit={onSubmit} postId={postId} />
          </Box>
        </Panel>
      </Drawer>
    </>
  )
}
