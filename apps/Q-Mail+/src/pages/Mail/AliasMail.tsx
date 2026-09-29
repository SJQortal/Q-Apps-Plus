import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import EditIcon from '@mui/icons-material/Edit'
import { Box, Button, Input, Typography, useTheme } from '@mui/material'
import LazyLoad from '../../components/common/LazyLoad'
import { removePrefix } from '../../utils/blogIdformats'
import { NewMessage } from './NewMessage'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { useFetchMail } from '../../hooks/useFetchMail'
import { ShowMessage } from './ShowMessage'
import { addToHashMapMail } from '../../state/features/mailSlice'
import {
  setIsLoadingGlobal,
  setUserAvatarHash
} from '../../state/features/globalSlice'
import SimpleTable from './MailTable'
import { MAIL_SERVICE_TYPE } from '../../constants/mail'
import { BlogPost } from '../../state/features/blogSlice'
import { useModal } from '../../components/common/useModal'
import { OpenMail } from './OpenMail'
import { MessagesContainer } from './Mail-styles'
import { MailMessageRow } from './MailMessageRow'

interface AliasMailProps {
  value: string;
  onOpen: (user: string, identifier: string, content: any)=> Promise<void>
  messageOpenedId: number
}
export const AliasMail = ({ value, onOpen, messageOpenedId}: AliasMailProps) => {
  const {isShow, onCancel, onOk, show} = useModal()

  const theme = useTheme()
  const { user } = useSelector((state: RootState) => state.auth)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [message, setMessage] = useState<any>(null)
  const [replyTo, setReplyTo] = useState<any>(null)
  const [forwardInfo, setForwardInfo] = useState<any>(null);
  const [valueTab, setValueTab] = React.useState(0)
  const [aliasValue, setAliasValue] = useState('')
  const [alias, setAlias] = useState<string[]>([])
  const [mailInfo, setMailInfo] = useState<any>(null)
  const hashMapPosts = useSelector(
    (state: RootState) => state.blog.hashMapPosts
  )
  const [mailMessages, setMailMessages] = useState<any[]>([])
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  )

  const fullMailMessages = useMemo(() => {
    return mailMessages.map((msg) => {
      let message = msg
      const existingMessage = hashMapMailMessages[msg.id]
      if (existingMessage) {
        message = existingMessage
      }
      return message
    })
  }, [mailMessages, hashMapMailMessages, user])
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const getAvatar = async (user: string) => {
    try {
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: user,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar'
      })
      dispatch(
        setUserAvatarHash({
          name: user,
          url
        })
      )
    } catch (error) {}
  }

  const mapMailResources = useCallback((resources: any[]): BlogPost[] => {
    return resources.map((post: any): BlogPost => {
      return {
        title: post?.metadata?.title,
        category: post?.metadata?.category,
        categoryName: post?.metadata?.categoryName,
        tags: post?.metadata?.tags || [],
        description: post?.metadata?.description,
        createdAt: post?.created,
        updated: post?.updated,
        user: post.name,
        id: post.identifier
      }
    })
  }, [])

  const fetchAliasMailboxMessages = useCallback(async (): Promise<BlogPost[]> => {
    if (!value || !user?.address) return []

    const addressSuffix = user.address.slice(-6)
    if (!addressSuffix) return []
    const normalizedAddressSuffix = `_${addressSuffix}_mail_`.toLowerCase()
    const byAddressQuery = `qortal_qmail_${value.slice(0, 20)}_${addressSuffix}_mail_`
    const byAliasQuery = `qortal_qmail_${value}_mail_`

    const queryConfigs: Array<{
      query: string
      matches: (identifier: string) => boolean
    }> = [
      {
        query: byAddressQuery,
        matches: (identifier: string) => {
          const normalizedIdentifier = identifier.toLowerCase()
          return (
            normalizedIdentifier.startsWith(`_mail_${byAddressQuery}`.toLowerCase()) &&
            normalizedIdentifier.includes(normalizedAddressSuffix)
          )
        }
      },
      {
        query: byAliasQuery,
        matches: (identifier: string) => {
          return identifier
            .toLowerCase()
            .startsWith(`_mail_${byAliasQuery}`.toLowerCase())
        }
      }
    ]

    const allResources: any[] = []
    const pageSize = 200

    for (const queryConfig of queryConfigs) {
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          mode: 'ALL',
          service: MAIL_SERVICE_TYPE,
          query: queryConfig.query,
          limit: String(pageSize),
          includemetadata: 'true',
          offset: String(offset),
          reverse: 'true',
          excludeblocked: 'true'
        })

        const response = await fetch(`/arbitrary/resources/search?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()

        if (!Array.isArray(responseData) || responseData.length === 0) {
          break
        }

        const filteredResponse = responseData.filter((item: any) => {
          const identifier =
            typeof item?.identifier === 'string' ? item.identifier : ''
          if (!identifier) return false
          return queryConfig.matches(identifier)
        })
        allResources.push(...filteredResponse)

        if (responseData.length < pageSize) {
          hasMore = false
        } else {
          offset += responseData.length
        }
      }
    }

    const mapped = mapMailResources(allResources)
    const deduped = new Map<string, BlogPost>()
    mapped.forEach(item => {
      if (!item?.id) return
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item)
      }
    })

    return Array.from(deduped.values()).sort((a, b) => {
      return Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
    })
  }, [mapMailResources, user?.address, value])

  const refreshMailboxMessages = useCallback(async () => {
    try {
      const nextMessages = await fetchAliasMailboxMessages()
      setMailMessages(nextMessages)

      for (const content of nextMessages) {
        if (content.user && content.id) {
          getAvatar(content.user)
        }
      }
    } catch (error) {}
  }, [fetchAliasMailboxMessages])

  const getMessages = useCallback(async () => {
    await refreshMailboxMessages()
  }, [refreshMailboxMessages])

  const interval = useRef<any>(null)

  const checkNewMessagesFunc = useCallback(() => {
    if (!user?.address || !value) return
    let isCalling = false
    interval.current = setInterval(async () => {
      if (isCalling || !user?.address || !value) return
      isCalling = true
      await refreshMailboxMessages()
      isCalling = false
    }, 30000)
  }, [refreshMailboxMessages, user?.address, value])

  useEffect(() => {
    checkNewMessagesFunc()
    return () => {
      if (interval?.current) {
        clearInterval(interval.current)
      }
    }
  }, [checkNewMessagesFunc])

  const openMessage = async (
    user: string,
    messageIdentifier: string,
    content: any
  ) => {
    try {
      onOpen(user, messageIdentifier, {})
      // const existingMessage: any = hashMapMailMessages[messageIdentifier]
      // if (existingMessage && existingMessage.isValid && !existingMessage.unableToDecrypt) {
      //   setMessage(existingMessage)
      //   setIsOpen(true)
      //   return
      // }
      // setMailInfo({
      //   identifier: messageIdentifier,
      //   name: user,
      //   service: MAIL_SERVICE_TYPE
      // })
      // const res: any = await show()
      // setMailInfo(null)
      // const existingMessageAgain = hashMapMailMessages[messageIdentifier]
      // if (res && res.isValid && !res.unableToDecrypt) {
      //   setMessage(res)
      //   setIsOpen(true)
      //   return
      // }
    } catch (error) {
    } finally {
    }
  }

  useEffect(() => {
    if (user?.address && value) {
      setMailMessages([])
      void refreshMailboxMessages()
    }
  }, [refreshMailboxMessages, user?.address, value])

  return (
    <>
      <NewMessage
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        setForwardInfo={setForwardInfo}
        forwardInfo={forwardInfo}
        recipientAlias={value}
        requireSenderAlias={false}
        hideButton
      />
      <ShowMessage
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        message={message}
        setReplyTo={setReplyTo}
        alias={value}
      />
       <MessagesContainer>
                {fullMailMessages.map(item => {
                  return (
                    <MailMessageRow
                      key={item?.id || item?.identifier}
                      messageData={item}
                      openMessage={openMessage}
                      useFullTimestamp
                      isOpen={messageOpenedId === (item?.id || item?.identifier)}
                    />
                  );
                })}
                <LazyLoad onLoadMore={getMessages}></LazyLoad>
              </MessagesContainer>
      {/* <SimpleTable
        openMessage={openMessage}
        data={fullMailMessages}
      ></SimpleTable> */}
      <Box
        sx={{
          width: '100%',
          justifyContent: 'center'
        }}
      >
        {mailMessages.length > 20 && (
          <Button onClick={getMessages}>Load Older Messages</Button>
        )}
      </Box>
      {mailInfo && isShow && (
              <OpenMail open={isShow} handleClose={onOk} fileInfo={mailInfo}/>
      )}
      {/* <LazyLoad onLoadMore={getMessages}></LazyLoad> */}
    </>
  )
}
