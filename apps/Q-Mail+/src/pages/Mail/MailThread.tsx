import * as React from 'react'
import { styled } from '@mui/material/styles'
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp'
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion'
import MuiAccordionSummary, {
  AccordionSummaryProps
} from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import { Box, CircularProgress } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { formatFullTimestamp } from '../../utils/time'
import ReadOnlySlate from '../../components/editor/ReadOnlySlate'
import { fetchAndEvaluateMail } from '../../utils/fetchMail'
import { addToHashMapMail } from '../../state/features/mailSlice'
import { AvatarWrapper } from './MailTable'
import FileElement from '../../components/FileElement'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { MAIL_SERVICE_TYPE } from '../../constants/mail'

const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  '&:not(:last-child)': {
    borderBottom: 0
  },
  '&:before': {
    display: 'none'
  }
}))

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '16px' }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: 'var(--qmail-thread-summary-bg)',
  flexDirection: 'row-reverse',
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
    transform: 'rotate(90deg)'
  },
  '& .MuiAccordionSummary-content': {
    marginLeft: theme.spacing(1)
  }
}))

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: '1px solid var(--qmail-thread-divider)'
}))

interface IThread {
  identifier: string
  service: string
  name: string
}

export default function MailThread({
  thread,
  users,
  otherUser
}: {
  thread: IThread[]
  users: string[]
  otherUser: string
}) {
  const [expanded, setExpanded] = React.useState<string | false>('panel1')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const dispatch = useDispatch()
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  )
  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false)
    }
  const getThreadMessages = async () => {
    setIsLoading(true)
    try {
      for (const msgId of thread) {
        const existingMessage = hashMapMailMessages[msgId?.identifier]
        if (existingMessage) {
        } else {
          try {
            const query = msgId?.identifier || ''
            const params = new URLSearchParams({
              mode: 'ALL',
              service: MAIL_SERVICE_TYPE,
              query,
              limit: '20',
              includemetadata: 'true',
              offset: '0',
              reverse: 'true',
              excludeblocked: 'true',
              exactmatchnames: 'true'
            })
            if (msgId?.name) {
              params.set('name', msgId.name)
            }
            const url = `/arbitrary/resources/search?${params.toString()}`
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            })

            const responseData = await response.json()
            if (responseData.length !== 0) {
              const data = responseData[0]
              const content = {
                title: data?.metadata?.title,
                category: data?.metadata?.category,
                categoryName: data?.metadata?.categoryName,
                tags: data?.metadata?.tags || [],
                description: data?.metadata?.description,
                createdAt: data?.created,
                updated: data?.updated,
                user: data.name,
                id: data.identifier
              }
              const res = await fetchAndEvaluateMail({
                user: data.name,
                messageIdentifier: data.identifier,
                content,
                otherUser
              })

              dispatch(addToHashMapMail(res))
            }
          } catch (error) {}
        }
      }
    } catch (error) {}
    setIsLoading(false)
  }

  React.useEffect(() => {
    getThreadMessages()
  }, [])

  if (isLoading) return <CircularProgress color="secondary" />
  return (
    <Box
      sx={{
        width: '100%'
      }}
    >
      {thread?.map((message: any) => {
        const findMessage: any = hashMapMailMessages[message?.identifier]
        if (!findMessage) return null

        return (
          <Accordion
            expanded={expanded === message?.identifier}
            onChange={handleChange(message?.identifier)}
          >
            <AccordionSummary
              aria-controls="panel1d-content"
              id="panel1d-header"
              sx={{
                fontSize: '1rem',
                height: '36px'
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <AvatarWrapper user={findMessage?.user} />
                  <Typography
                    sx={{
                      fontSize: '1rem'
                    }}
                  >
                    {findMessage?.user}
                  </Typography>
                  <Typography>{findMessage?.description}</Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '1rem'
                    }}
                  >
                    {formatFullTimestamp(findMessage?.createdAt)}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <>
                {findMessage?.attachments?.length > 0 && (
                  <Box
                    sx={{
                      width: '100%',
                      marginTop: '10px',
                      marginBottom: '20px'
                    }}
                  >
                    {findMessage?.attachments.map((file: any) => {
                      return (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            width: '100%'
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              width: 'auto'
                            }}
                          >
                            <FileElement
                            fileInfo={{...file, mimeTypeSaved: file?.type}}
                              title={file?.filename}
                              mode="mail"
                              otherUser={otherUser}
                            >
                              <AttachFileIcon
                                sx={{
                                  height: '16px',
                                  width: 'auto'
                                }}
                              ></AttachFileIcon>
                              <Typography
                                sx={{
                                  fontSize: '1rem'
                                }}
                              >
                                {file?.originalFilename || file?.filename}
                              </Typography>
                            </FileElement>
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                )}
                {findMessage?.textContent && (
                  <ReadOnlySlate
                    content={findMessage.textContent}
                    mode="mail"
                  />
                )}
              </>
            </AccordionDetails>
          </Accordion>
        )
      })}
      {/* <Accordion
        expanded={expanded === 'panel1'}
        onChange={handleChange('panel1')}
      >
        <AccordionSummary aria-controls="panel1d-content" id="panel1d-header">
          <Typography>Collapsible Group Item #1</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
            malesuada lacus ex, sit amet blandit leo lobortis eget. Lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Suspendisse malesuada
            lacus ex, sit amet blandit leo lobortis eget.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded === 'panel2'}
        onChange={handleChange('panel2')}
      >
        <AccordionSummary aria-controls="panel2d-content" id="panel2d-header">
          <Typography>Collapsible Group Item #2</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
            malesuada lacus ex, sit amet blandit leo lobortis eget. Lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Suspendisse malesuada
            lacus ex, sit amet blandit leo lobortis eget.
          </Typography>
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded === 'panel3'}
        onChange={handleChange('panel3')}
      >
        <AccordionSummary aria-controls="panel3d-content" id="panel3d-header">
          <Typography>Collapsible Group Item #3</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
            malesuada lacus ex, sit amet blandit leo lobortis eget. Lorem ipsum
            dolor sit amet, consectetur adipiscing elit. Suspendisse malesuada
            lacus ex, sit amet blandit leo lobortis eget.
          </Typography>
        </AccordionDetails>
      </Accordion> */}
    </Box>
  )
}
