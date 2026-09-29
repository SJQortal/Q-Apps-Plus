import React, { FC, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import EditIcon from '@mui/icons-material/Edit'
import {
  Box,
  Button,
  List,
  ListItem,
  Typography,
  useTheme
} from '@mui/material'
import BlogPostPreview from './PostPreview'
import { useFetchPosts } from '../../hooks/useFetchPosts'
import LazyLoad from '../../components/common/LazyLoad'
import { removePrefix } from '../../utils/blogIdformats'
import Masonry from 'react-masonry-css'

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1300: 3,
  940: 2,
  700: 1,
  500: 1
}
interface BlogListProps {
  mode?: string
}
export const BlogList = ({ mode }: BlogListProps) => {
  const theme = useTheme()
  const prevVal = useRef('')
  const { user } = useSelector((state: RootState) => state.auth)
  const hashMapPosts = useSelector(
    (state: RootState) => state.blog.hashMapPosts
  )
  const favoritesLocal = useSelector(
    (state: RootState) => state.blog.favoritesLocal
  )
  const subscriptionPosts = useSelector(
    (state: RootState) => state.blog.subscriptionPosts
  )
  const countNewPosts = useSelector(
    (state: RootState) => state.blog.countNewPosts
  )
  const isFiltering = useSelector((state: RootState) => state.blog.isFiltering)
  const filterValue = useSelector((state: RootState) => state.blog.filterValue)
  const filteredPosts = useSelector(
    (state: RootState) => state.blog.filteredPosts
  )

  const { posts: globalPosts, favorites } = useSelector(
    (state: RootState) => state.blog
  )
  const navigate = useNavigate()
  const {
    getBlogPosts,
    getBlogPostsFavorites,
    getBlogPostsSubscriptions,
    checkNewMessages,
    getNewPosts,
    getBlogFilteredPosts
  } = useFetchPosts()
  const getPosts = React.useCallback(async () => {
    if (isFiltering) {
      getBlogFilteredPosts(filterValue)
      return
    }
    if (mode === 'favorites') {
      getBlogPostsFavorites()
      return
    }
    if (mode === 'subscriptions' && user?.name) {
      getBlogPostsSubscriptions(user.name)
      return
    }
    await getBlogPosts()
  }, [getBlogPosts, mode, favoritesLocal, user?.name, isFiltering, filterValue])

  let posts = globalPosts

  if (mode === 'favorites') {
    posts = favorites
  }
  if (mode === 'subscriptions') {
    posts = subscriptionPosts
  }
  if (isFiltering) {
    posts = filteredPosts
  }
  const interval = useRef<any>(null)

  const checkNewMessagesFunc = useCallback(() => {
    let isCalling = false
    interval.current = setInterval(async () => {
      if (isCalling) return
      isCalling = true
      const res = await checkNewMessages()
      isCalling = false
    }, 30000) // 1 second interval
  }, [checkNewMessages])

  useEffect(() => {
    if (!mode) {
      checkNewMessagesFunc()
    }
    return () => {
      if (interval?.current) {
        clearInterval(interval.current)
      }
    }
  }, [mode, checkNewMessagesFunc])

  useEffect(() => {
    if (isFiltering && filterValue !== prevVal?.current) {
      prevVal.current = filterValue
      getPosts()
    }
  }, [filterValue, isFiltering, filteredPosts])
  // if (!favoritesLocal) return null
  return (
    <>
      {/* <List
        sx={{
          margin: '0px',
          padding: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}
      > */}
      {!mode && countNewPosts > 0 && !isFiltering && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography>
            {countNewPosts === 1
              ? `There is ${countNewPosts} new post`
              : `There are ${countNewPosts} new posts`}
          </Typography>
          <Button
            sx={{
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.text.primary,
              fontFamily: 'Arial'
            }}
            onClick={getNewPosts}
          >
            Load new Posts
          </Button>
        </Box>
      )}

      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {posts.map((post, index) => {
          const existingPost = hashMapPosts[post.id]
          let blogPost = post
          if (existingPost) {
            blogPost = existingPost
          }
          return (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                width: 'auto',
                position: 'relative',
                ' @media (max-width: 450px)': {
                  width: '100%'
                }
              }}
              key={blogPost.id}
            >
              <BlogPostPreview
                onClick={() => {
                  const str = blogPost.id
                  const arr = str.split('-post-')
                  const str1 = arr[0]
                  const str2 = arr[1]
                  const blogId = removePrefix(str1)
                  navigate(`/${blogPost.user}/${blogId}/${str2}`)
                }}
                description={blogPost?.description}
                title={blogPost?.title}
                createdAt={blogPost?.createdAt}
                author={blogPost.user}
                postImage={blogPost?.postImage}
                blogPost={blogPost}
                isValid={blogPost?.isValid}
              />

              {blogPost.user === user?.name && (
                <EditIcon
                  className="edit-btn"
                  sx={{
                    position: 'absolute',
                    zIndex: 10,
                    bottom: '25px',
                    right: '25px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const str = blogPost.id
                    const arr = str.split('-post-')
                    const str1 = arr[0]
                    const str2 = arr[1]
                    const blogId = removePrefix(str1)
                    navigate(`/${blogPost.user}/${blogId}/${str2}/edit`)
                  }}
                />
              )}
            </Box>
          )
        })}
      </Masonry>
      {/* </List> */}
      <LazyLoad onLoadMore={getPosts}></LazyLoad>
    </>
  )
}
