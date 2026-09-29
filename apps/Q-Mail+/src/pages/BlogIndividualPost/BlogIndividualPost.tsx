import React, { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Button,
  Box,
  Typography,
  CardHeader,
  Avatar,
  useTheme
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { styled } from '@mui/system'
import AudiotrackIcon from '@mui/icons-material/Audiotrack'
import ReadOnlySlate from '../../components/editor/ReadOnlySlate'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { checkStructure } from '../../utils/checkStructure'
import { BlogContent } from '../../interfaces/interfaces'
import {
  setAudio,
  setCurrAudio,
  setIsLoadingGlobal,
  setVisitingBlog
} from '../../state/features/globalSlice'
import { VideoPlayer } from '../../components/common/VideoPlayer'
import { AudioPlayer, IPlaylist } from '../../components/common/AudioPlayer'
import { Responsive, WidthProvider } from 'react-grid-layout'
import '/node_modules/react-grid-layout/css/styles.css'
import '/node_modules/react-resizable/css/styles.css'
import DynamicHeightItem from '../../components/DynamicHeightItem'
import {
  addPrefix,
  buildIdentifierFromCreateTitleIdAndId
} from '../../utils/blogIdformats'
import { DynamicHeightItemMinimal } from '../../components/DynamicHeightItemMinimal'
import { ReusableModal } from '../../components/modals/ReusableModal'
import AudioElement from '../../components/AudioElement'
import ErrorBoundary from '../../components/common/ErrorBoundary'
import { CommentSection } from '../../components/common/Comments/CommentSection'
import { Tipping } from '../../components/common/Tipping/Tipping'
import FileElement from '../../components/FileElement'
const ResponsiveGridLayout = WidthProvider(Responsive)
const initialMinHeight = 2 // Define an initial minimum height for grid items

const md = [
  { i: 'a', x: 0, y: 0, w: 4, h: initialMinHeight },
  { i: 'b', x: 6, y: 0, w: 4, h: initialMinHeight }
]
const sm = [
  { i: 'a', x: 0, y: 0, w: 6, h: initialMinHeight },
  { i: 'b', x: 6, y: 0, w: 6, h: initialMinHeight }
]
const xs = [
  { i: 'a', x: 0, y: 0, w: 6, h: initialMinHeight },
  { i: 'b', x: 6, y: 0, w: 6, h: initialMinHeight }
]

interface ILayoutGeneralSettings {
  padding: number
  blogPostType: string
}
export const BlogIndividualPost = () => {
  const { user, postId, blog } = useParams()
  const blogFull = React.useMemo(() => {
    if (!blog) return ''
    return addPrefix(blog)
  }, [blog])
  const { user: userState } = useSelector((state: RootState) => state.auth)
  const { audios, audioPostId } = useSelector(
    (state: RootState) => state.global
  )

  const [avatarUrl, setAvatarUrl] = React.useState<string>('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const theme = useTheme()
  // const [currAudio, setCurrAudio] = React.useState<number | null>(null)
  const [layouts, setLayouts] = React.useState<any>({ md, sm, xs })
  const [count, setCount] = React.useState<number>(1)
  const [layoutGeneralSettings, setLayoutGeneralSettings] =
    React.useState<ILayoutGeneralSettings | null>(null)
  const [currentBreakpoint, setCurrentBreakpoint] = React.useState<any>()
  const handleLayoutChange = (layout: any, layoutss: any) => {
    // const redoLayouts = setAutoHeight(layoutss)
    setLayouts(layoutss)
    // saveLayoutsToLocalStorage(layoutss)
  }
  const [blogContent, setBlogContent] = React.useState<BlogContent | null>(null)
  const [isOpenSwitchPlaylistModal, setisOpenSwitchPlaylistModal] =
    useState<boolean>(false)
  const tempSaveAudio = useRef<any>(null)
  const saveAudio = React.useRef<any>(null)

  const fullPostId = useMemo(() => {
    if (!blog || !postId) return ''
    dispatch(setIsLoadingGlobal(true))
    const formBlogId = addPrefix(blog)
    const formPostId = buildIdentifierFromCreateTitleIdAndId(formBlogId, postId)
    return formPostId
  }, [blog, postId])
  const getBlogPost = React.useCallback(async () => {
    try {
      if (!blog || !postId) return
      dispatch(setIsLoadingGlobal(true))
      const formBlogId = addPrefix(blog)
      const formPostId = buildIdentifierFromCreateTitleIdAndId(
        formBlogId,
        postId
      )
      const url = `/arbitrary/BLOG_POST/${user}/${formPostId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()

      if (checkStructure(responseData)) {
        setBlogContent(responseData)
        if (responseData?.layouts) {
          setLayouts(responseData?.layouts)
        }
        if (responseData?.layoutGeneralSettings) {
          setLayoutGeneralSettings(responseData.layoutGeneralSettings)
        }
        const filteredAudios = (responseData?.postContent || []).filter(
          (content: any) => content?.type === 'audio'
        )

        const transformAudios = filteredAudios?.map((fa: any) => {
          return {
            ...(fa?.content || {}),
            id: fa?.id
          }
        })

        if (!audios && transformAudios.length > 0) {
          saveAudio.current = { audios: transformAudios, postId: formPostId }
          dispatch(setAudio({ audios: transformAudios, postId: formPostId }))
        } else if (
          formPostId === audioPostId &&
          audios?.length !== transformAudios.length
        ) {
          tempSaveAudio.current = {
            message:
              "This post's audio playlist has updated. Would you like to switch?"
          }
          setisOpenSwitchPlaylistModal(true)
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [user, postId, blog])
  React.useEffect(() => {
    getBlogPost()
  }, [postId])

  const switchPlayList = () => {
    const filteredAudios = (blogContent?.postContent || []).filter(
      (content) => content?.type === 'audio'
    )

    const formatAudios = filteredAudios.map((fa) => {
      return {
        ...(fa?.content || {}),
        id: fa?.id
      }
    })
    if (!blog || !postId) return
    const formBlogId = addPrefix(blog)
    const formPostId = buildIdentifierFromCreateTitleIdAndId(formBlogId, postId)
    dispatch(setAudio({ audios: formatAudios, postId: formPostId }))
    if (tempSaveAudio?.current?.currentSelection) {
      const findIndex = (formatAudios || []).findIndex(
        (item) =>
          item?.identifier ===
          tempSaveAudio?.current?.currentSelection?.content?.identifier
      )
      if (findIndex >= 0) {
        dispatch(setCurrAudio(findIndex))
      }
    }
    setisOpenSwitchPlaylistModal(false)
  }

  const getAvatar = React.useCallback(async () => {
    try {
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: user,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar'
      })

      setAvatarUrl(url)
    } catch (error) {}
  }, [user])
  React.useEffect(() => {
    getAvatar()
  }, [])

  const onBreakpointChange = React.useCallback((newBreakpoint: any) => {
    setCurrentBreakpoint(newBreakpoint)
  }, [])

  const onResizeStop = React.useCallback((layout: any, layoutItem: any) => {
    // Update the layout state with the new position and size of the component
    setCount((prev) => prev + 1)
  }, [])

  // const audios = React.useMemo<IPlaylist[]>(() => {
  //   const filteredAudios = (blogContent?.postContent || []).filter(
  //     (content) => content.type === 'audio'
  //   )

  //   return filteredAudios.map((fa) => {
  //     return {
  //       ...fa.content,
  //       id: fa.id
  //     }
  //   })
  // }, [blogContent])

  const handleResize = () => {
    setCount((prev) => prev + 1)
  }

  React.useEffect(() => {
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleCount = React.useCallback(() => {
    // Update the layout state with the new position and size of the component
    setCount((prev) => prev + 1)
  }, [])

  const getBlog = React.useCallback(async () => {
    let name = user
    if (!name) return
    if (!blogFull) return
    try {
      const urlBlog = `/arbitrary/BLOG/${name}/${blogFull}`
      const response = await fetch(urlBlog, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      dispatch(setVisitingBlog({ ...responseData, name }))
    } catch (error) {}
  }, [user, blogFull])

  React.useEffect(() => {
    getBlog()
  }, [user, blogFull])

  if (!blogContent) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          maxWidth: '1400px',
          // margin: '15px',
          width: '95%',
          paddingBottom: '50px'
        }}
      >
        {user === userState?.name && (
          <Button
            sx={{ backgroundColor: theme.palette.secondary.main }}
            onClick={() => {
              navigate(`/${user}/${blog}/${postId}/edit`)
            }}
          >
            Edit Post
          </Button>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <CardHeader
            onClick={() => {
              navigate(`/${user}/${blog}`)
            }}
            sx={{
              cursor: 'pointer',
              '& .MuiCardHeader-content': {
                overflow: 'hidden'
              },
              padding: '10px 0px'
            }}
            avatar={<Avatar src={avatarUrl} alt={`${user}'s avatar`} />}
            subheader={
              <Typography
                sx={{ fontFamily: 'Cairo', fontSize: '25px' }}
                color={theme.palette.text.primary}
              >{` ${user}`}</Typography>
            }
          />
          {user && (
            <Tipping
              name={user || ''}
              onSubmit={() => {
                // setNameTip('')
              }}
              onClose={() => {
                // setNameTip('')
              }}
            />
          )}
        </Box>
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
              textAlign: 'center'
            }}
          >
            {blogContent?.title}
          </Typography>
          <CommentSection postId={fullPostId} />
        </Box>

        {(layoutGeneralSettings?.blogPostType === 'builder' ||
          !layoutGeneralSettings?.blogPostType) && (
          <Content
            layouts={layouts}
            blogContent={blogContent}
            onResizeStop={onResizeStop}
            onBreakpointChange={onBreakpointChange}
            handleLayoutChange={handleLayoutChange}
          >
            {blogContent?.postContent?.map((section: any) => {
              if (section?.type === 'editor') {
                return (
                  <div key={section?.id} className="grid-item-view">
                    <ErrorBoundary
                      fallback={
                        <Typography>
                          Error loading content: Invalid Data
                        </Typography>
                      }
                    >
                      <DynamicHeightItem
                        layouts={layouts}
                        setLayouts={setLayouts}
                        i={section.id}
                        breakpoint={currentBreakpoint}
                        count={count}
                        padding={layoutGeneralSettings?.padding}
                      >
                        <ReadOnlySlate content={section.content} />
                      </DynamicHeightItem>
                    </ErrorBoundary>
                  </div>
                )
              }
              if (section?.type === 'image') {
                return (
                  <div key={section?.id} className="grid-item-view">
                    <ErrorBoundary
                      fallback={
                        <Typography>
                          Error loading content: Invalid Data
                        </Typography>
                      }
                    >
                      <DynamicHeightItem
                        layouts={layouts}
                        setLayouts={setLayouts}
                        i={section.id}
                        breakpoint={currentBreakpoint}
                        count={count}
                        padding={layoutGeneralSettings?.padding}
                      >
                        <img
                          src={section.content.image}
                          className="post-image"
                        />
                      </DynamicHeightItem>
                    </ErrorBoundary>
                  </div>
                )
              }
              if (section?.type === 'video') {
                return (
                  <div key={section?.id} className="grid-item-view">
                    <ErrorBoundary
                      fallback={
                        <Typography>
                          Error loading content: Invalid Data
                        </Typography>
                      }
                    >
                      <DynamicHeightItem
                        layouts={layouts}
                        setLayouts={setLayouts}
                        i={section.id}
                        breakpoint={currentBreakpoint}
                        count={count}
                        padding={layoutGeneralSettings?.padding}
                      >
                        <VideoPlayer
                          name={section.content.name}
                          service={section.content.service}
                          identifier={section.content.identifier}
                          setCount={handleCount}
                          user={user}
                          postId={fullPostId}
                        />
                      </DynamicHeightItem>
                    </ErrorBoundary>
                  </div>
                )
              }
              if (section?.type === 'audio') {
                return (
                  <div key={section?.id} className="grid-item-view">
                    <ErrorBoundary
                      fallback={
                        <Typography>
                          Error loading content: Invalid Data
                        </Typography>
                      }
                    >
                      <DynamicHeightItem
                        layouts={layouts}
                        setLayouts={setLayouts}
                        i={section.id}
                        breakpoint={currentBreakpoint}
                        count={count}
                        padding={layoutGeneralSettings?.padding}
                      >
                        <AudioElement
                          key={section.id}
                          audioInfo={section.content}
                          postId={fullPostId}
                          user={user ? user : ''}
                          onClick={() => {
                            if (!blog || !postId) return

                            const formBlogId = addPrefix(blog)
                            const formPostId =
                              buildIdentifierFromCreateTitleIdAndId(
                                formBlogId,
                                postId
                              )
                            if (audioPostId && formPostId !== audioPostId) {
                              tempSaveAudio.current = {
                                ...(tempSaveAudio.current || {}),
                                currentSelection: section,
                                message:
                                  'You are current on a playlist. Would you like to switch?'
                              }
                              setisOpenSwitchPlaylistModal(true)
                            } else {
                              if (!audios && saveAudio?.current) {
                                const findIndex = (
                                  saveAudio?.current?.audios || []
                                ).findIndex(
                                  (item: any) =>
                                    item.identifier ===
                                    section.content.identifier
                                )
                                dispatch(setAudio(saveAudio?.current))
                                dispatch(setCurrAudio(findIndex))
                                return
                              }

                              const findIndex = (audios || []).findIndex(
                                (item) =>
                                  item.identifier === section.content.identifier
                              )
                              if (findIndex >= 0) {
                                dispatch(setCurrAudio(findIndex))
                              }
                            }
                          }}
                          title={section.content?.title}
                          description={section.content?.description}
                          author=""
                        />
                      </DynamicHeightItem>
                    </ErrorBoundary>
                  </div>
                )
              }
              if (section?.type === 'file') {
                return (
                  <div key={section?.id} className="grid-item">
                    <ErrorBoundary
                      fallback={
                        <Typography>
                          Error loading content: Invalid Data
                        </Typography>
                      }
                    >
                      <DynamicHeightItemMinimal
                        layouts={layouts}
                        setLayouts={setLayouts}
                        i={section.id}
                        breakpoint={currentBreakpoint}
                        count={count}
                        padding={0}
                      >
                        <FileElement
                          key={section.id}
                          fileInfo={section.content}
                          postId={fullPostId}
                          user={user ? user : ''}
                          title={section.content?.title}
                          description={section.content?.description}
                          mimeType={section.content?.mimeType}
                          author=""
                        />
                      </DynamicHeightItemMinimal>
                    </ErrorBoundary>
                  </div>
                )
              }
            })}
          </Content>
        )}
        {layoutGeneralSettings?.blogPostType === 'minimal' && (
          <>
            {layouts?.rows?.map((row: any, rowIndex: number) => {
              return (
                <Box
                  sx={{
                    display: 'flex',
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '25px',
                    gap: 2
                  }}
                >
                  {row?.ids?.map((elementId: string) => {
                    const section: any = blogContent?.postContent?.find(
                      (el) => el?.id === elementId
                    )
                    if (!section) return null
                    if (section?.type === 'editor') {
                      return (
                        <div
                          key={section?.id}
                          className="grid-item"
                          style={{
                            maxWidth: '800px',
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%'
                          }}
                        >
                          <ErrorBoundary
                            fallback={
                              <Typography>
                                Error loading content: Invalid Data
                              </Typography>
                            }
                          >
                            <DynamicHeightItemMinimal
                              layouts={layouts}
                              setLayouts={setLayouts}
                              i={section.id}
                              breakpoint={currentBreakpoint}
                              count={count}
                              padding={0}
                            >
                              <ReadOnlySlate
                                key={section.id}
                                content={section.content}
                              />
                            </DynamicHeightItemMinimal>
                          </ErrorBoundary>
                        </div>
                      )
                    }
                    if (section?.type === 'image') {
                      return (
                        <div key={section.id} className="grid-item">
                          <ErrorBoundary
                            fallback={
                              <Typography>
                                Error loading content: Invalid Data
                              </Typography>
                            }
                          >
                            <DynamicHeightItemMinimal
                              layouts={layouts}
                              setLayouts={setLayouts}
                              i={section.id}
                              breakpoint={currentBreakpoint}
                              count={count}
                              type="image"
                              padding={0}
                            >
                              <Box
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  height: '100%'
                                }}
                              >
                                <img
                                  src={section.content.image}
                                  className="post-image"
                                  style={{
                                    objectFit: 'contain',
                                    maxHeight: '50vh'
                                  }}
                                />
                              </Box>
                            </DynamicHeightItemMinimal>
                          </ErrorBoundary>
                        </div>
                      )
                    }

                    if (section?.type === 'video') {
                      return (
                        <div key={section?.id} className="grid-item">
                          <ErrorBoundary
                            fallback={
                              <Typography>
                                Error loading content: Invalid Data
                              </Typography>
                            }
                          >
                            <DynamicHeightItemMinimal
                              layouts={layouts}
                              setLayouts={setLayouts}
                              i={section.id}
                              breakpoint={currentBreakpoint}
                              count={count}
                              padding={0}
                            >
                              <Box
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  height: '100%'
                                }}
                              >
                                <VideoPlayer
                                  name={section.content.name}
                                  service={section.content.service}
                                  identifier={section.content.identifier}
                                  customStyle={{
                                    height: '50vh'
                                  }}
                                  user={user}
                                  postId={fullPostId}
                                />
                              </Box>
                            </DynamicHeightItemMinimal>
                          </ErrorBoundary>
                        </div>
                      )
                    }
                    if (section?.type === 'audio') {
                      return (
                        <div key={section?.id} className="grid-item">
                          <ErrorBoundary
                            fallback={
                              <Typography>
                                Error loading content: Invalid Data
                              </Typography>
                            }
                          >
                            <DynamicHeightItemMinimal
                              layouts={layouts}
                              setLayouts={setLayouts}
                              i={section.id}
                              breakpoint={currentBreakpoint}
                              count={count}
                              padding={0}
                            >
                              <AudioElement
                                key={section.id}
                                audioInfo={section.content}
                                postId={fullPostId}
                                user={user ? user : ''}
                                onClick={() => {
                                  if (!blog || !postId) return
                                  const formBlogId = addPrefix(blog)
                                  const formPostId =
                                    buildIdentifierFromCreateTitleIdAndId(
                                      formBlogId,
                                      postId
                                    )
                                  if (formPostId !== audioPostId) {
                                    tempSaveAudio.current = {
                                      ...(tempSaveAudio.current || {}),
                                      currentSelection: section,
                                      message:
                                        'You are current on a playlist. Would you like to switch?'
                                    }
                                    setisOpenSwitchPlaylistModal(true)
                                  } else {
                                    const findIndex = (audios || []).findIndex(
                                      (item) =>
                                        item.identifier ===
                                        section.content.identifier
                                    )
                                    if (findIndex >= 0) {
                                      dispatch(setCurrAudio(findIndex))
                                    }
                                  }
                                }}
                                title={section.content?.title}
                                description={section.content?.description}
                                author=""
                              />
                            </DynamicHeightItemMinimal>
                          </ErrorBoundary>
                        </div>
                      )
                    }
                    if (section?.type === 'file') {
                      return (
                        <div key={section?.id} className="grid-item">
                          <ErrorBoundary
                            fallback={
                              <Typography>
                                Error loading content: Invalid Data
                              </Typography>
                            }
                          >
                            <DynamicHeightItemMinimal
                              layouts={layouts}
                              setLayouts={setLayouts}
                              i={section.id}
                              breakpoint={currentBreakpoint}
                              count={count}
                              padding={0}
                            >
                              <FileElement
                                key={section.id}
                                fileInfo={section.content}
                                postId={fullPostId}
                                user={user ? user : ''}
                                title={section.content?.title}
                                description={section.content?.description}
                                mimeType={section.content?.mimeType}
                                author=""
                              />
                            </DynamicHeightItemMinimal>
                          </ErrorBoundary>
                        </div>
                      )
                    }
                  })}
                </Box>
              )
            })}
          </>
        )}
        <ReusableModal open={isOpenSwitchPlaylistModal}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography>
              {tempSaveAudio?.current?.message
                ? tempSaveAudio?.current?.message
                : 'You are current on a playlist. Would you like to switch?'}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => setisOpenSwitchPlaylistModal(false)}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={switchPlayList}>
            Switch
          </Button>
        </ReusableModal>
      </Box>
    </Box>
  )
}

const Content = ({
  children,
  layouts,
  blogContent,
  onResizeStop,
  onBreakpointChange,
  handleLayoutChange
}: any) => {
  if (layouts && blogContent?.layouts) {
    return (
      <ErrorBoundary
        fallback={
          <Typography>Error loading content: Invalid Layout</Typography>
        }
      >
        <ResponsiveGridLayout
          layouts={layouts}
          breakpoints={{ md: 996, sm: 768, xs: 480 }}
          cols={{ md: 4, sm: 3, xs: 1 }}
          measureBeforeMount={false}
          onLayoutChange={handleLayoutChange}
          autoSize={true}
          compactType={null}
          isBounded={true}
          resizeHandles={['se', 'sw', 'ne', 'nw']}
          rowHeight={25}
          onResizeStop={onResizeStop}
          onBreakpointChange={onBreakpointChange}
          isDraggable={false}
          isResizable={false}
          margin={[0, 0]}
        >
          {children}
        </ResponsiveGridLayout>
      </ErrorBoundary>
    )
  }
  return children
}
