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
import ReactDOM from 'react-dom'
import {
  Box,
  Button,
  Input,
  Skeleton,
  Typography,
  useTheme
} from '@mui/material'
import { MAIL_SERVICE_TYPE } from '../../constants/mail'
import { base64ToUint8Array, uint8ArrayToObject } from '../../utils/toBase64'
import { ShowMessage } from './ShowMessageWithoutModal'
import { generateHTML } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import ShortUniqueId from 'short-unique-id'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { NewThread } from './NewThread'
import {
  setIsLoadingCustom,
  setIsLoadingGlobal
} from '../../state/features/globalSlice'
import { addToHashMapMail } from '../../state/features/mailSlice'
import { ShowChatMessage } from './ShowChatMessage'
import LazyLoad from '../../components/common/LazyLoad'
import { ChatInput } from './ChatInput'

interface ThreadProps {
  currentThread: any
  groupInfo: any
  closeThread: () => void
}
export const Chat = ({
  currentThread,
  groupInfo,
  closeThread
}: ThreadProps) => {
  const theme = useTheme()
  const { user } = useSelector((state: RootState) => state.auth)
  const [messages, setMessages] = useState<any[]>([])
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  )
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const parentMessagesRef = useRef<HTMLDivElement | null>(null)
  const initialLoadRef = useRef(true) // Ref to track initial load
  const [isInitialLoad, setIsInitialLoad] = useState(false) // Ref to track initial load
  const targetMessageRef = useRef<any>(null)

  const getOldMailMessages = React.useCallback(
    async (groupInfo: any, reset?: boolean) => {
      try {
        let lastMsg = messages?.slice(0, 20)?.at(-1)?.signature

        const findEl = document.getElementById(lastMsg)
        lastMsg = ''
        setIsLoading(true)
        dispatch(setIsLoadingCustom('Loading messages. This may take time.'))
        const offset = messages.length
        const response = await qortalRequest({
          action: 'SEARCH_CHAT_MESSAGES',
          txGroupId: groupInfo?.threadData?.groupId, // Optional (must specify either txGroupId or two involving addresses)
          encoding: 'BASE64', // Optional (defaults to BASE58 if omitted)
          limit: 20,
          offset,
          reverse: true
        })
        let fullArrayMsg = reset ? [] : [...messages]
        if (response.length < 2) return
        for (const message of response) {
          try {
            const binaryString = atob(message.data)
            const binaryLength = binaryString.length
            const bytes = new Uint8Array(binaryLength)

            for (let i = 0; i < binaryLength; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }

            const decoder = new TextDecoder()
            const decodedString = decoder.decode(bytes)
            const obj = JSON.parse(decodedString)
            const messageHTML = generateHTML(obj?.messageText, [
              StarterKit,
              Underline,
              Highlight
              // other extensions …
            ])
            const messageObj = {
              ...message,
              messageData: obj,
              messageHTML
            }
            const index = fullArrayMsg.findIndex(
              (p) => p.signature === messageObj.signature
            )
            if (index !== -1) {
              fullArrayMsg[index] = messageObj
            } else {
              fullArrayMsg.unshift(messageObj)
            }
          } catch (error) {}
        }
        targetMessageRef.current = fullArrayMsg?.[0].signature
        setMessages(fullArrayMsg)

        if (findEl) {
          setTimeout(() => {
            findEl?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }

        // if (initialLoadRef.current) {

        // }

        // Update ref to indicate initial load complete
      } catch (error) {
        console.log({ error })
      } finally {
        dispatch(setIsLoadingCustom(null))
        setIsLoading(false)
      }
    },
    [messages]
  )

  const getMailMessages = React.useCallback(
    async (groupInfo: any, reset?: boolean) => {
      try {
        setIsLoading(true)
        dispatch(setIsLoadingCustom('Loading messages. This may take time.'))
        const offset = messages.length
        const response = await qortalRequest({
          action: 'SEARCH_CHAT_MESSAGES',
          txGroupId: groupInfo?.threadData?.groupId, // Optional (must specify either txGroupId or two involving addresses)
          encoding: 'BASE64', // Optional (defaults to BASE58 if omitted)
          limit: 20,
          offset,
          reverse: true
        })
        let fullArrayMsg = reset ? [] : [...messages]
        for (const message of response.reverse()) {
          try {
            const binaryString = atob(message.data)
            const binaryLength = binaryString.length
            const bytes = new Uint8Array(binaryLength)

            for (let i = 0; i < binaryLength; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }

            const decoder = new TextDecoder()
            const decodedString = decoder.decode(bytes)
            const obj = JSON.parse(decodedString)
            const messageHTML = generateHTML(obj?.messageText, [
              StarterKit,
              Underline,
              Highlight
              // other extensions …
            ])
            const messageObj = {
              ...message,
              messageData: obj,
              messageHTML
            }
            const index = fullArrayMsg.findIndex(
              (p) => p.signature === messageObj.signature
            )
            if (index !== -1) {
              fullArrayMsg[index] = messageObj
            } else {
              fullArrayMsg.push(messageObj)
            }
          } catch (error) {}
        }

        setMessages(fullArrayMsg)
      
        // Update ref to indicate initial load complete
      } catch (error) {
        console.log({ error })
      } finally {
        dispatch(setIsLoadingCustom(null))
        setIsLoading(false)
      }
    },
    [messages]
  )

  useEffect(() => {
    if (messages.length > 0 && !isInitialLoad) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight
      }
      setIsInitialLoad(true)
    }
  }, [messages])
  const getMessages = React.useCallback(async () => {
    if (!user?.name || !currentThread) return
    await getMailMessages(currentThread, true)
  }, [getMailMessages, user, currentThread])
  const firstMount = useRef(false)
  useEffect(() => {
    if (user?.name && currentThread) {
      getMessages()
      firstMount.current = true
    }
  }, [user, currentThread])

  const interval = useRef<any>(null)

  const checkNewMessages = React.useCallback(
    async (groupInfo: any) => {
      try {
        const after = messages[0]?.timestamp
        if (!after) return
        const txGroupId = groupInfo?.threadData?.groupId
        if (txGroupId === undefined || txGroupId === null) return
        const params = new URLSearchParams({
          after: String(after),
          txGroupId: String(txGroupId),
          encoding: 'BASE64',
          limit: '20'
        })
        const url = `/chat/messages/count?${params.toString()}`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        if (responseData === 0) return
        let fullArrayMsg = [...messages]
        const responseNewMessages = await qortalRequest({
          action: 'SEARCH_CHAT_MESSAGES',
          txGroupId: groupInfo?.threadData?.groupId, // Optional (must specify either txGroupId or two involving addresses)
          // involving: ["QZLJV7wbaFyxaoZQsjm6rb9MWMiDzWsqM2", "QSefrppsDCsZebcwrqiM1gNbWq7YMDXtG2"], // Optional (must specify either txGroupId or two involving addresses)
          // reference: "reference", // Optional
          // chatReference: "chatreference", // Optional
          // hasChatReference: true, // Optional
          encoding: 'BASE64', // Optional (defaults to BASE58 if omitted)
          limit: responseData,
          reverse: true,
          after: after
        })

        for (const message of responseNewMessages.reverse()) {
          const binaryString = atob(message.data)
          const binaryLength = binaryString.length
          const bytes = new Uint8Array(binaryLength)

          for (let i = 0; i < binaryLength; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          const decoder = new TextDecoder()
          const decodedString = decoder.decode(bytes)
          const obj = JSON.parse(decodedString)
          const messageHTML = generateHTML(obj?.messageText, [
            StarterKit,
            Underline,
            Highlight
            // other extensions …
          ])
          const messageObj = {
            ...message,
            messageData: obj,
            messageHTML
          }
          const index = fullArrayMsg.findIndex(
            (p) => p.signature === messageObj.signature
          )
          if (index !== -1) {
            fullArrayMsg[index] = messageObj
          } else {
            fullArrayMsg.push(messageObj)
          }
        }
        setMessages(fullArrayMsg)
      } catch (error) {
      } finally {
      }
    },
    [messages]
  )

  const checkNewMessagesFunc = useCallback(() => {
    if (!user?.name || !user?.address) return
    let isCalling = false
    interval.current = setInterval(async () => {
      if (isCalling || !user?.name || !user?.address) return
      isCalling = true
      const res = await checkNewMessages(currentThread)
      isCalling = false
    }, 8000)
  }, [checkNewMessages, user, currentThread])

  useEffect(() => {
    checkNewMessagesFunc()
    return () => {
      if (interval?.current) {
        clearInterval(interval.current)
      }
    }
  }, [checkNewMessagesFunc])

  const postChatMessage = async (msg: string) => {
    try {
      if (!currentThread?.threadData?.groupId || !msg) return
      const response = await qortalRequest({
        action: 'SEND_CHAT_MESSAGE',
        groupId: currentThread?.threadData?.groupId,
        message: msg
      })
      
    } catch (error) {
      console.error({ error })
      throw new Error('error')
    }
  }

  if (!currentThread) return null
  return (
    <>
      <div
        style={{
          backgroundColor: 'var(--qmail-chat-bg)',
          width: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1
        }}
        ref={messagesContainerRef}
        className="chatScroller"
      >
        <Box
          sx={{
            width: '100%',
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography variant="h2">Chat</Typography>
          <Typography variant="h6">Group: {groupInfo?.groupName}</Typography>
        </Box>
        {isInitialLoad && (
          <LazyLoad
            onLoadMore={() => getOldMailMessages(currentThread)}
          ></LazyLoad>
        )}
        <div ref={parentMessagesRef}>
          {messages.map((message) => {
            return (
              <ShowChatMessage key={message?.identifier} message={message} />
            )
          })}
        </div>
        <div ref={bottomRef} />
      </div>
      <div
        style={{
          backgroundColor: 'var(--qmail-chat-bg)',
          width: '100%',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}
      >
        <ChatInput onSendMessage={postChatMessage} />
      </div>
    </>
  )
}
