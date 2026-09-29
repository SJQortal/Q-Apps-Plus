import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { useParams } from 'react-router-dom'
import { Typography, Box, Button, useTheme } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import BlogPostPreview from '../BlogList/PostPreview'
import {
  setIsLoadingGlobal,
  setVisitingBlog,
  toggleEditBlogModal
} from '../../state/features/globalSlice'
import {
  addSubscription,
  BlogPost,
  removeSubscription
} from '../../state/features/blogSlice'
import { useFetchPosts } from '../../hooks/useFetchPosts'
import LazyLoad from '../../components/common/LazyLoad'
import { addPrefix, removePrefix } from '../../utils/blogIdformats'
import Masonry from 'react-masonry-css'

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1300: 3,
  940: 2,
  700: 1,
  500: 1
}
export const BlogIndividualProfile = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const { user } = useSelector((state: RootState) => state.auth)
  const { currentBlog } = useSelector((state: RootState) => state.global)
  const subscriptions = useSelector(
    (state: RootState) => state.blog.subscriptions
  )

  const { blog: blogShortVersion, user: username } = useParams()
  const blog = React.useMemo(() => {
    if (!blogShortVersion) return ''
    return addPrefix(blogShortVersion)
  }, [blogShortVersion])
  const dispatch = useDispatch()
  const [userBlog, setUserBlog] = React.useState<any>(null)
  const { checkAndUpdatePost, getBlogPost, hashMapPosts } = useFetchPosts()

  const [blogPosts, setBlogPosts] = React.useState<BlogPost[]>([])

  const getBlogPosts = React.useCallback(async () => {
    let name = username

    if (!name) return
    if (!blog) return

    try {
      dispatch(setIsLoadingGlobal(true))
      const offset = blogPosts.length
      //TODO - NAME SHOULD BE EXACT
      const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&query=${blog}-post-&limit=20&exactmatchnames=true&name=${name}&includemetadata=true&offset=${offset}&reverse=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()

      const structureData = responseData.map((post: any): BlogPost => {
        return {
          title: post?.metadata?.title,
          category: post?.metadata?.category,
          categoryName: post?.metadata?.categoryName,
          tags: post?.metadata?.tags || [],
          description: post?.metadata?.description,
          createdAt: '',
          user: post.name,
          postImage: '',
          id: post.identifier
        }
      })
      setBlogPosts(structureData)
      const copiedBlogPosts: BlogPost[] = [...blogPosts]
      structureData.forEach((post: BlogPost) => {
        const index = blogPosts.findIndex((p) => p.id === post.id)
        if (index !== -1) {
          copiedBlogPosts[index] = post
        } else {
          copiedBlogPosts.push(post)
        }
      })
      setBlogPosts(copiedBlogPosts)

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePost(content)

          if (res) {
            getBlogPost(content.user, content.id, content)
          }
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [username, blog, blogPosts])
  const getBlog = React.useCallback(async () => {
    let name = username

    if (!name) return
    if (!blog) return
    try {
      const urlBlog = `/arbitrary/BLOG/${name}/${blog}`
      const response = await fetch(urlBlog, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      dispatch(setVisitingBlog({ ...responseData, name }))
      setUserBlog(responseData)
    } catch (error) {}
  }, [username, blog])

  React.useEffect(() => {
    getBlog()
  }, [username, blog])
  const getPosts = React.useCallback(async () => {
    await getBlogPosts()
  }, [getBlogPosts])

  const subscribe = async () => {
    try {
      if (!user?.name) return
      const body = {
        items: [username]
      }

      const listName = `q-blog-subscriptions-${user.name}`

      const response = await qortalRequest({
        action: 'ADD_LIST_ITEMS',
        list_name: listName,
        items: [username]
      })
      if (response === true) {
        dispatch(addSubscription(username))
      }
    } catch (error) {}
  }
  const unsubscribe = async () => {
    try {
      if (!user?.name) return

      const listName = `q-blog-subscriptions-${user.name}`

      const response = await qortalRequest({
        action: 'DELETE_LIST_ITEM',
        list_name: listName,
        item: username
      })
      if (response === true) {
        dispatch(removeSubscription(username))
      }
    } catch (error) {}
  }
  if (!userBlog) return null
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography
          variant="h1"
          color="textPrimary"
          sx={{
            textAlign: 'center',
            marginTop: '20px'
          }}
        >
          {currentBlog?.blogId === blog ? currentBlog?.title : userBlog.title}
        </Typography>
        {currentBlog?.blogId === blog && (
          <EditIcon
            sx={{
              cursor: 'pointer'
            }}
            onClick={() => {
              dispatch(toggleEditBlogModal(true))
            }}
          ></EditIcon>
        )}
        {subscriptions.includes(username) && (
          <Button
            sx={{
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.text.primary,
              fontFamily: 'Arial'
            }}
            onClick={unsubscribe}
          >
            Unsubscribe
          </Button>
        )}
        {!subscriptions.includes(username) && (
          <Button
            sx={{
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.text.primary,
              fontFamily: 'Arial'
            }}
            onClick={subscribe}
          >
            Subscribe
          </Button>
        )}
      </Box>

      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
        style={{ backgroundColor: theme.palette.background.default }}
      >
        {blogPosts.map((post, index) => {
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
            >
              <BlogPostPreview
                onClick={() => {
                  const str = blogPost.id
                  const arr = str.split('-post-')
                  const str1 = arr[0]

                  const blogId = removePrefix(str1)
                  const str2 = arr[1]
                  navigate(`/${blogPost.user}/${blogId}/${str2}`)
                }}
                description={blogPost?.description}
                title={blogPost?.title}
                createdAt={blogPost?.createdAt}
                author={blogPost.user}
                postImage={blogPost?.postImage}
                blogPost={blogPost}
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
      <LazyLoad onLoadMore={getPosts}></LazyLoad>
    </>
  )
}
