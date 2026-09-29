import React, { useState, useEffect } from 'react'
import { styled, Box } from '@mui/system'
import {
  Drawer,
  List,
  ListItem,
  ListItemText,
  Typography,
  ButtonBase,
  Button,
  Tooltip
} from '@mui/material'
import VideoCallIcon from '@mui/icons-material/VideoCall'
import VideoModal from './VideoPublishModal'
import { useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { AudioModal } from './AudioPublishModal'
import AudioFileIcon from '@mui/icons-material/AudioFile'
interface VideoPanelProps {
  onSelect: (video: Video) => void
  height?: string
  width?: string
}

interface VideoApiResponse {
  videos: Video[]
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

const PublishButton = styled(Button)`
  /* position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  margin: auto; */
  max-width: 80%;
`

export const AudioPanel: React.FC<VideoPanelProps> = ({
  onSelect,
  height,
  width
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [videos, setVideos] = useState<Video[]>([])
  const [isOpenVideoModal, setIsOpenVideoModal] = useState<boolean>(false)
  const { user } = useSelector((state: RootState) => state.auth)

  const fetchVideos = React.useCallback(async (): Promise<Video[]> => {
    if (!user?.name) return []

    let res
    try {
      res = await qortalRequest({
        action: 'LIST_QDN_RESOURCES',
        service: 'AUDIO',
        name: user.name,
        includeMetadata: true,
        limit: 100,
        offset: 0,
        reverse: true
      })
    } catch (error) {

    }

    // Replace this URL with the actual API endpoint

    return res
  }, [user])
  useEffect(() => {
    fetchVideos().then((fetchedVideos) => setVideos(fetchedVideos))
  }, [])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleClick = (video: Video) => {
    onSelect(video)
  }

  return (
    <Box
      sx={{
        display: 'flex'
      }}
    >
      <Tooltip title="Add an audio file" arrow>
        <AudioFileIcon
          onClick={handleToggle}
          sx={{
            height: height || '30px',
            width: width || 'auto',
            cursor: 'pointer'
          }}
        ></AudioFileIcon>
      </Tooltip>
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={handleToggle}
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
              flexDirection: 'column',
              alignItems: 'center',
              flex: '0 0'
            }}
          >
            <Typography
              variant="h5"
              component="div"
              sx={{ flexGrow: 1, mt: 2, mb: 1 }}
            >
              Select Audio
            </Typography>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{ flexGrow: 1, mb: 2 }}
            >
              List of audios in QDN under your name
            </Typography>
          </Box>

          <List
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              flex: '1',
              overflow: 'auto'
            }}
          >
            {videos.map((video) => (
              <ListItem key={video.identifier}>
                <ButtonBase
                  onClick={() => handleClick(video)}
                  sx={{ width: '100%' }}
                >
                  <ListItemText
                    primary={video?.metadata?.title || ''}
                    secondary={video?.metadata?.description || ''}
                  />
                </ButtonBase>
              </ListItem>
            ))}
          </List>
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              flex: '0 0 50px'
            }}
          >
            <PublishButton
              variant="contained"
              onClick={() => setIsOpenVideoModal(true)}
            >
              Publish new audio file
            </PublishButton>
          </Box>
        </Panel>
      </Drawer>
      <AudioModal
        onClose={() => {
          setIsOpenVideoModal(false)
        }}
        open={isOpenVideoModal}
        onPublish={(value) => {
          fetchVideos().then((fetchedVideos) => setVideos(fetchedVideos))
          setIsOpenVideoModal(false)
        }}
      />
    </Box>
  )
}

// Add this to your 'types.ts' file
export interface Video {
  name: string
  service: string
  identifier: string
  metadata: {
    title: string
    description: string
    tags: string[]
    category: string
    categoryName: string
  }
  size: number
  created: number
  updated: number
}
