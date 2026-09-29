import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton, Slider } from '@mui/material'
import { CircularProgress, Typography } from '@mui/material'
import AudioPlyr from 'philliplm-react-modern-audio-player'
import LinearProgress from '@mui/material/LinearProgress'

import {
  PlayArrow,
  Pause,
  VolumeUp,
  Fullscreen,
  PictureInPicture
} from '@mui/icons-material'
import { styled } from '@mui/system'
import {
  removeAudio,
  setShowingAudioPlayer
} from '../../state/features/globalSlice'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'

const VideoContainer = styled(Box)`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 20px 0px;
  z-index: 501;
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
  title?: string
  description?: string
  playlist?: IPlaylist[]
  currAudio: number | null
}

export interface IPlaylist {
  name: string
  identifier: string
  service: string
  title: string
  description: string
}
interface CustomWindow extends Window {
  _qdnTheme: any // Replace 'any' with the appropriate type if you know it
}
const customWindow = window as unknown as CustomWindow
const themeColor = customWindow?._qdnTheme

export const AudioPlayer: React.FC<VideoPlayerProps> = ({ currAudio }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { downloads, showingAudioPlayer } = useSelector(
    (state: RootState) => state.global
  )
  const dispatch = useDispatch()
  const downloadsLength: number = useMemo(
    () =>
      Object.keys(downloads)
        .map((item) => {
          return downloads[item]
        })
        .filter(
          (download: any) =>
            download?.service === 'AUDIO' &&
            download?.status?.status === 'READY' &&
            !!download.url
        ).length,
    [downloads]
  )

  const audioPlayList = useMemo(() => {
    const filterAudios = Object.keys(downloads)
      .map((item) => {
        return downloads[item]
      })
      .filter(
        (download: any) =>
          download?.service === 'AUDIO' &&
          download?.url &&
          download?.status?.status === 'READY'
      )
    return filterAudios.map((audio: any, index: number) => {
      return {
        name: audio?.blogPost?.audioTitle,
        src: audio?.url,
        id: index + 1,
        identifier: audio?.identifier,
        description: audio?.blogPost?.audioDescription || ''
      }
    })
  }, [downloadsLength])

  const currAudioMemo: number | null = useMemo(() => {
    const findIndex = audioPlayList.findIndex(
      (item) => item?.identifier === currAudio
    )
    if (findIndex !== -1) {
      return findIndex
    }
    return null
  }, [audioPlayList, currAudio])

  if (isLoading)
    return (
      <Box
        sx={{
          isolation: 'isolate',
          width: '100%',
          position: 'fixed',
          colorScheme: 'light',
          bottom: '0px',
          padding: '10px',
          height: '50px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        <Typography
          sx={{
            fontSize: '0.625rem'
          }}
        >
          Loading playlist...
        </Typography>
        <LinearProgress
          sx={{
            width: '100%'
          }}
        />
      </Box>
    )

  if (audioPlayList.length === 0 || !showingAudioPlayer) return null
  return (
    <VideoContainer>
      <AudioPlyr
        rootContainerProps={{
          defaultColorScheme: themeColor === 'dark' ? 'dark' : 'light',
          colorScheme: themeColor === 'dark' ? 'dark' : 'light'
        }}
        currentIndex={currAudioMemo}
        playList={audioPlayList}
        activeUI={{
          all: true
        }}
        placement={{
          player: 'bottom',

          playList: 'top',
          volumeSlider: 'top'
        }}
        closeCallback={() => {
          dispatch(setShowingAudioPlayer(false))
        }}
        // rootContainerProps={{
        //   colorScheme: theme,
        //   width
        // }}
      />
    </VideoContainer>
  )
}
