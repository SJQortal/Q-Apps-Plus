import React, { useState, useEffect } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  Typography,
  useTheme
} from '@mui/material'
import { Movie, ArrowDropDown } from '@mui/icons-material'
import { SxProps } from '@mui/system'
import { Theme } from '@mui/material/styles'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { removePrefix } from '../../utils/blogIdformats'
import { useLocation, useNavigate } from 'react-router-dom'
import AudiotrackIcon from '@mui/icons-material/Audiotrack'
import {
  setCurrAudio,
  setShowingAudioPlayer
} from '../../state/features/globalSlice'
import { MAIL_ATTACHMENT_SERVICE_TYPE } from '../../constants/mail'

type DownloadItem = {
  id: string
  name: string
  progress: number
}

export const DownloadTaskManager: React.FC = () => {
  const { downloads } = useSelector((state: RootState) => state.global)
  const dispatch = useDispatch()
  const location = useLocation()
  const isMailRoute = location.pathname === '/mail'
  const theme = useTheme()
  const [visible, setVisible] = useState(false)
  const [hidden, setHidden] = useState(true)
  const navigate = useNavigate()
  const containerStyles: SxProps<Theme> = {
    position: 'fixed',
    top: '50px',
    right: 0,
    zIndex: 1000,
    maxHeight: '80%',
    overflowY: 'auto',
    backgroundColor: 'background.paper',
    boxShadow: 2,
    display: 'block'
  }

  useEffect(() => {
    // Simulate downloads for demo purposes

    if (visible) {
      setTimeout(() => {
        setHidden(true)
        setVisible(false)
      }, 3000)
    }
  }, [visible])

  const toggleVisibility = () => {
    setVisible(true)
    setHidden(false)
  }

  useEffect(() => {
    if (Object.keys(downloads).length === 0) return
    setVisible(true)
    setHidden(false)
  }, [downloads])

  if (isMailRoute) return null
  if (
    !downloads ||
    Object.keys(downloads).filter(
      (item) => downloads[item].service !== MAIL_ATTACHMENT_SERVICE_TYPE
    ).length === 0
  )
    return null

  return (
    <Box sx={{ position: 'fixed', top: '50px', right: '5px', zIndex: 1000 }}>
      <Accordion
        sx={{
          width: '200px',
          backgroundColor: theme.palette.primary.main
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
          sx={{
            minHeight: 'unset',
            height: '36px',
            backgroundColor: theme.palette.primary.light,
            '&.MuiAccordionSummary-content': {
              padding: 0,
              margin: 0
            },
            '&.Mui-expanded': {
              minHeight: 'unset',
              height: '36px'
            }
          }}
        >
          <Typography
            sx={{
              color: theme.palette.text.primary,
              fontSize: '0.875rem'
            }}
          >
            Downloads
          </Typography>
        </AccordionSummary>
        <AccordionDetails
          sx={{
            padding: '5px'
          }}
        >
          <List
            sx={{
              maxHeight: '50vh',
              overflow: 'auto'
            }}
          >
            {Object.keys(downloads)
              .filter(
                (item) =>
                  downloads[item].service !== MAIL_ATTACHMENT_SERVICE_TYPE
              )
              .map((download: any) => {
                const downloadObj = downloads[download]
                const progress = downloads[download]?.status?.percentLoaded || 0
                const status = downloads[download]?.status?.status
                const service = downloads[download]?.service
                return (
                  <ListItem
                    key={downloadObj?.identifier}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      justifyContent: 'center',
                      background: theme.palette.primary.main,
                      color: theme.palette.text.primary,
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                    onClick={() => {
                      if (service === 'AUDIO' && downloadObj?.identifier) {
                        dispatch(setCurrAudio(downloadObj?.identifier))
                        dispatch(setShowingAudioPlayer(true))
                        return
                      }

                      const str = downloadObj?.blogPost?.postId
                      if (!str) return
                      const arr = str.split('-post-')
                      const str1 = arr[0]
                      const str2 = arr[1]
                      const blogId = removePrefix(str1)
                      navigate(
                        `/${downloadObj?.blogPost.user}/${blogId}/${str2}`
                      )
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <ListItemIcon>
                        {service === 'AUDIO' && (
                          <AudiotrackIcon
                            sx={{ color: theme.palette.text.primary }}
                          />
                        )}
                        {service === 'VIDEO' && (
                          <Movie sx={{ color: theme.palette.text.primary }} />
                        )}
                      </ListItemIcon>

                      <Box
                        sx={{ width: '100px', marginLeft: 1, marginRight: 1 }}
                      >
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            borderRadius: '5px',
                            color: theme.palette.secondary.main
                          }}
                        />
                      </Box>
                      <Typography
                        sx={{
                          color: theme.palette.text.primary
                        }}
                        variant="caption"
                      >
                        {`${progress?.toFixed(0)}%`}{' '}
                        {status && status === 'REFETCHING' && '- refetching'}
                        {status && status === 'DOWNLOADED' && '- building'}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.625rem',
                        width: '100%',
                        textAlign: 'end',
                        color: theme.palette.text.primary
                      }}
                    >
                      {downloadObj?.identifier}
                    </Typography>
                  </ListItem>
                )
              })}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* <IconButton onClick={() => {}} aria-label="toggle download manager">
        <ArrowDropDown />
      </IconButton> */}
      {/* <Box sx={containerStyles}>
        <List
          sx={{
            width: '200px'
          }}
        >
          {Object.keys(downloads).map((download: any) => {
            const downloadObj = downloads[download]
            const progress = downloads[download]?.status?.percentLoaded || 0
            return (
              <ListItem
                key={downloadObj?.identifier}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ListItemIcon>
                    <Movie />
                  </ListItemIcon>

                  <Box sx={{ width: '100px', marginLeft: 1 }}>
                    <LinearProgress variant="determinate" value={progress} />
                  </Box>
                  <Typography variant="caption">{`${progress}%`}</Typography>
                </Box>

                <ListItemText
                  primary={downloadObj?.identifier}
                  sx={{
                    fontSize: '0.875rem',
                    width: '100%',
                    textAlign: 'end'
                  }}
                />
              </ListItem>
            )
          })}
        </List>
      </Box> */}
    </Box>
  )
}
