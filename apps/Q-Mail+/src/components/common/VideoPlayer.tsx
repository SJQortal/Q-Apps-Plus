import React, { useContext, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Box, IconButton, Slider } from '@mui/material'
import { CircularProgress, Typography } from '@mui/material'

import {
  PlayArrow,
  Pause,
  VolumeUp,
  Fullscreen,
  PictureInPicture
} from '@mui/icons-material'
import { styled } from '@mui/system'
import { MyContext } from '../../wrappers/DownloadWrapper'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'

const VideoContainer = styled(Box)`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0px;
  padding: 0px;
`

const VideoElement = styled('video')`
  width: 100%;
  height: auto;
  background: rgb(33, 33, 33);
`

const ControlsContainer = styled(Box)`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: space-between;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.6);
`

interface VideoPlayerProps {
  src?: string
  poster?: string
  name?: string
  identifier?: string
  service?: string
  autoplay?: boolean
  from?: string | null
  setCount?: () => void
  customStyle?: any
  user?: string
  postId?: string
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  poster,
  name,
  identifier,
  service,
  autoplay = true,
  from = null,
  setCount,
  customStyle = {},
  user = '',
  postId = ''
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [startPlay, setStartPlay] = useState(false)

  const { downloads } = useSelector((state: RootState) => state.global)

  const download = useMemo(() => {
    if (!downloads || !identifier) return {}
    const findDownload = downloads[identifier]

    if (!findDownload) return {}
    return findDownload
  }, [downloads, identifier])

  const src = useMemo(() => {
    return download?.url || ''
  }, [download?.url])
  const resourceStatus = useMemo(() => {
    return download?.status || {}
  }, [download])

  const toggleRef = useRef<any>(null)
  const { downloadVideo } = useContext(MyContext)
  const togglePlay = async () => {
    if (!videoRef.current) return
    setStartPlay(true)
    if (!src) {
      const el = document.getElementById('videoWrapper')
      if (el) {
        el?.parentElement?.removeChild(el)
      }
      ReactDOM.flushSync(() => {
        setIsLoading(true)
      })
      getSrc()
    }
    if (playing) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setPlaying(!playing)
  }

  const onVolumeChange = (_: any, value: number | number[]) => {
    if (!videoRef.current) return
    videoRef.current.volume = value as number
    setVolume(value as number)
  }

  const onProgressChange = (_: any, value: number | number[]) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = value as number
    setProgress(value as number)
    if (!playing) {
      videoRef.current.play()
      setPlaying(true)
    }
  }

  const handleEnded = () => {
    setPlaying(false)
  }

  const updateProgress = () => {
    if (!videoRef.current) return
    setProgress(videoRef.current.currentTime)
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  const enterFullscreen = () => {
    if (!videoRef.current) return
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen()
    }
  }

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      enterFullscreen()
    } else {
      exitFullscreen()
    }
  }
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return
    if (document.pictureInPictureElement === videoRef.current) {
      await document.exitPictureInPicture()
    } else {
      await videoRef.current.requestPictureInPicture()
    }
  }

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const handleLoadedMetadata = () => {
    setIsLoading(false)
  }

  const handleCanPlay = () => {
    if (setCount) {
      setCount()
    }
    setIsLoading(false)
  }

  const getSrc = React.useCallback(async () => {
    if (!name || !identifier || !service || !postId || !user) return
    try {
      downloadVideo({
        name,
        service,
        identifier,
        blogPost: {
          postId,
          user
        }
      })
    } catch (error) {}
  }, [identifier, name, service])

  React.useEffect(() => {
    const videoElement = videoRef.current

    const handleLeavePictureInPicture = async (event: any) => {
      const target = event?.target
      if (target) {
        target.pause()
        if (setPlaying) {
          setPlaying(false)
        }
      }
    }

    if (videoElement) {
      videoElement.addEventListener(
        'leavepictureinpicture',
        handleLeavePictureInPicture
      )
    }

    return () => {
      if (videoElement) {
        videoElement.removeEventListener(
          'leavepictureinpicture',
          handleLeavePictureInPicture
        )
      }
    }
  }, [])

  React.useEffect(() => {
    const videoElement = videoRef.current

    const minimizeVideo = async () => {
      if (!videoElement) return
      const handleClose = () => {
        if (videoElement && videoElement.parentElement) {
          const el = document.getElementById('videoWrapper')
          if (el) {
            el?.parentElement?.removeChild(el)
          }
        }
      }
      const createCloseButton = (): HTMLButtonElement => {
        const closeButton = document.createElement('button')
        closeButton.textContent = 'X'
        closeButton.style.position = 'absolute'
        closeButton.style.top = '0'
        closeButton.style.right = '0'
        closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'
        closeButton.style.border = 'none'
        closeButton.style.fontWeight = 'bold'
        closeButton.style.fontSize = '1.2rem'
        closeButton.style.cursor = 'pointer'
        closeButton.style.padding = '2px 8px'
        closeButton.style.borderRadius = '0 0 0 4px'

        closeButton.addEventListener('click', handleClose)

        return closeButton
      }
      const buttonClose = createCloseButton()
      const videoWrapper = document.createElement('div')
      videoWrapper.id = 'videoWrapper'
      videoWrapper.style.position = 'fixed'
      videoWrapper.style.zIndex = '900000009'
      videoWrapper.style.bottom = '0px'
      videoWrapper.style.right = '0px'

      videoElement.parentElement?.insertBefore(videoWrapper, videoElement)
      videoWrapper.appendChild(videoElement)

      videoWrapper.appendChild(buttonClose)
      videoElement.controls = true
      videoElement.style.height = 'auto'
      videoElement.style.width = '300px'

      document.body.appendChild(videoWrapper)
    }

    return () => {
      if (videoElement) {
        if (videoElement && !videoElement.paused && !videoElement.ended) {
          minimizeVideo()
        }
      }
    }
  }, [])

  function formatTime(seconds: number): string {
    seconds = Math.floor(seconds)

    let minutes: number | string = Math.floor(seconds / 60)
    let remainingSeconds: number | string = seconds % 60

    if (minutes < 10) {
      minutes = '0' + minutes
    }
    if (remainingSeconds < 10) {
      remainingSeconds = '0' + remainingSeconds
    }

    return minutes + ':' + remainingSeconds
  }

  return (
    <VideoContainer
      style={{
        padding: from === 'create' ? '8px' : 0
      }}
    >
      {isLoading && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          justifyContent="center"
          alignItems="center"
          zIndex={4999}
          bgcolor="rgba(0, 0, 0, 0.6)"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <CircularProgress color="secondary" />
          {resourceStatus && (
            <Typography
              variant="subtitle2"
              component="div"
              sx={{
                color: 'white',
                fontSize: '18px'
              }}
            >
              {resourceStatus?.status === 'REFETCHING' ? (
                <>
                  <>
                    {(
                      (resourceStatus?.localChunkCount /
                        resourceStatus?.totalChunkCount) *
                      100
                    )?.toFixed(0)}
                    %
                  </>

                  <> Refetching in 2 minutes</>
                </>
              ) : resourceStatus?.status === 'DOWNLOADED' ? (
                <>Download Completed: building video...</>
              ) : resourceStatus?.status !== 'READY' ? (
                <>
                  {(
                    (resourceStatus?.localChunkCount /
                      resourceStatus?.totalChunkCount) *
                    100
                  )?.toFixed(0)}
                  %
                </>
              ) : (
                <>Download Completed: fetching video...</>
              )}
            </Typography>
          )}
        </Box>
      )}
      {((!src && !isLoading) || !startPlay) && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          justifyContent="center"
          alignItems="center"
          zIndex={500}
          bgcolor="rgba(0, 0, 0, 0.6)"
          onClick={() => {
            if (from === 'create') return

            togglePlay()
          }}
          sx={{
            cursor: 'pointer'
          }}
        >
          <PlayArrow
            sx={{
              width: '50px',
              height: '50px',
              color: 'white'
            }}
          />
        </Box>
      )}

      <VideoElement
        ref={videoRef}
        src={!startPlay ? '' : src}
        poster={poster}
        onTimeUpdate={updateProgress}
        autoPlay={autoplay}
        onEnded={handleEnded}
        // onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        preload="metadata"
        style={{
          ...customStyle
        }}
      />
      <ControlsContainer
        style={{
          bottom: from === 'create' ? '15px' : 0
        }}
      >
        <IconButton
          sx={{
            color: 'rgba(255, 255, 255, 0.7)'
          }}
          onClick={togglePlay}
        >
          {playing ? <Pause /> : <PlayArrow />}
        </IconButton>
        <Slider
          value={progress}
          onChange={onProgressChange}
          min={0}
          max={videoRef.current?.duration || 100}
          sx={{ flexGrow: 1, mx: 2 }}
        />
        <Typography
          sx={{
            fontSize: '14px',
            marginRight: '5px',
            color: 'rgba(255, 255, 255, 0.7)',
            visibility:
              !videoRef.current?.duration || !progress ? 'hidden' : 'visible'
          }}
        >
          {progress && videoRef.current?.duration && formatTime(progress)}/
          {progress &&
            videoRef.current?.duration &&
            formatTime(videoRef.current?.duration)}
        </Typography>
        <VolumeUp />
        <Slider
          value={volume}
          onChange={onVolumeChange}
          min={0}
          max={1}
          step={0.01}
        />
        <IconButton
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            marginLeft: '15px'
          }}
          ref={toggleRef}
          onClick={togglePictureInPicture}
        >
          <PictureInPicture />
        </IconButton>
        <IconButton
          sx={{
            color: 'rgba(255, 255, 255, 0.7)'
          }}
          onClick={toggleFullscreen}
        >
          <Fullscreen />
        </IconButton>
      </ControlsContainer>
    </VideoContainer>
  )
}
