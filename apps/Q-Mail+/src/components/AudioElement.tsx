import * as React from 'react'
import { styled, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import AudiotrackIcon from '@mui/icons-material/Audiotrack'
import { MyContext } from '../wrappers/DownloadWrapper'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../state/store'
import { CircularProgress } from '@mui/material'
import {
  setCurrAudio,
  setShowingAudioPlayer
} from '../state/features/globalSlice'

const Widget = styled('div')(({ theme }) => ({
  padding: 16,
  borderRadius: 16,
  maxWidth: '100%',
  position: 'relative',
  zIndex: 1,
  //   backgroundColor:
  //     theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)',
  backdropFilter: 'blur(40px)',
  background: 'skyblue',
  transition: '0.2s all',
  '&:hover': {
    opacity: 0.75
  }
}))

const CoverImage = styled('div')({
  width: 100,
  height: 100,
  objectFit: 'cover',
  overflow: 'hidden',
  flexShrink: 0,
  borderRadius: 8,
  backgroundColor: 'rgba(0,0,0,0.08)',
  '& > img': {
    width: '100%'
  }
})

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  opacity: 0.38,
  fontWeight: 500,
  letterSpacing: 0.2
})

interface IAudioElement {
  onClick: () => void
  title: string
  description: string
  author: string
  audioInfo?: any
  postId?: string
  user?: string
}

export default function AudioElement({
  onClick,
  title,
  description,
  author,
  audioInfo,
  postId,
  user
}: IAudioElement) {
  const { downloadVideo } = React.useContext(MyContext)
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const { downloads } = useSelector((state: RootState) => state.global)
  const dispatch = useDispatch()
  const download = React.useMemo(() => {
    if (!downloads || !audioInfo?.identifier) return {}
    const findDownload = downloads[audioInfo?.identifier]

    if (!findDownload) return {}
    return findDownload
  }, [downloads, audioInfo])

  const resourceStatus = React.useMemo(() => {
    return download?.status || {}
  }, [download])
  const handlePlay = () => {
    if (!postId) return
    const { name, service, identifier } = audioInfo

    if (download && resourceStatus?.status === 'READY') {
      dispatch(setShowingAudioPlayer(true))
      dispatch(setCurrAudio(identifier))
      return
    }
    setIsLoading(true)
    downloadVideo({
      name,
      service,
      identifier,
      blogPost: {
        postId,
        user,
        audioTitle: title,
        audioDescription: description,
        audioAuthor: author
      }
    })
    dispatch(setCurrAudio(identifier))
    dispatch(setShowingAudioPlayer(true))
  }

  React.useEffect(() => {
    if (resourceStatus?.status === 'READY') {
      setIsLoading(false)
    }
  }, [resourceStatus])
  return (
    <Box
      onClick={handlePlay}
      sx={{
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer'
      }}
    >
      <Widget>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CoverImage>
            <AudiotrackIcon
              sx={{
                width: '90%',
                height: 'auto'
              }}
            />
          </CoverImage>
          <Box sx={{ ml: 1.5, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={500}
            >
              {author}
            </Typography>
            <Typography noWrap>
              <b>{title}</b>
            </Typography>
            <Typography noWrap letterSpacing={-0.25}>
              {description}
            </Typography>
          </Box>
        </Box>
        {((resourceStatus.status && resourceStatus?.status !== 'READY') ||
          isLoading) && (
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
              gap: '10px',
              padding: '16px',
              borderRadius: '16px'
            }}
          >
            <CircularProgress color="secondary" />
            {resourceStatus && (
              <Typography
                variant="subtitle2"
                component="div"
                sx={{
                  color: 'white',
                  fontSize: '14px'
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
                  <>Download Completed: building audio...</>
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
                  <>Download Completed: fetching audio...</>
                )}
              </Typography>
            )}
          </Box>
        )}
      </Widget>
    </Box>
  )
}
