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
import { NewThread } from './NewThread'
import {
  setIsLoadingCustom,
  setIsLoadingGlobal
} from '../../state/features/globalSlice'
import { addToHashMapMail } from '../../state/features/mailSlice'
import { ComposeP, GroupContainer, GroupNameP, MailIconImg, ShowMessageReturnButton, SingleThreadParent, ThreadContainer, ThreadContainerFullWidth } from './Mail-styles'
import { Spacer } from '../../components/common/Spacer'
import ReturnSVG from '../../assets/svgs/Return.svg'
import LazyLoad from '../../components/common/LazyLoad'
import { executeEvent } from "../../utils/events";
interface ThreadProps {
  currentThread: any
  groupInfo: any
  closeThread: () => void
  members?: any
}
export const Thread = ({
  currentThread,
  groupInfo,
  closeThread,
  members
}: ThreadProps) => {
  const theme = useTheme()
  const { user } = useSelector((state: RootState) => state.auth)
  const [messages, setMessages] = useState<any[]>([])
  const dispatch = useDispatch()
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  )
  const getIndividualMsg = async (message: any) => {
    try {
      let messageRes = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: message.name,
        service: MAIL_SERVICE_TYPE,
        identifier: message.identifier,
        encoding: 'base64'
      })
      let requestEncryptBody: any = {
        action: 'DECRYPT_DATA',
        encryptedData: messageRes
      }
      const resDecrypt = await qortalRequest(requestEncryptBody)
      const decryptToUnit8ArrayMessage = base64ToUint8Array(resDecrypt)
      const responseDataMessage = uint8ArrayToObject(decryptToUnit8ArrayMessage)

      const fullObject = {
        ...message,
        ...(responseDataMessage || {}),
        id: message.identifier
      }
      dispatch(addToHashMapMail(fullObject))
    } catch (error) {}
  }
  
  const getMailMessages = React.useCallback(
    async (groupInfo: any, reset?: boolean, hideAlert?: boolean) => {
      try {
        if(!hideAlert){
          dispatch(setIsLoadingCustom('Loading messages'))

        }
        let str = groupInfo.threadId
        let parts = str.split('_').reverse()
        let result = parts[0]
        const threadId = result
        const offset = messages.length
        const query = `qortal_qmail_thmsg_group${groupInfo?.threadData?.groupId}_${threadId}`
        const encodedQuery = encodeURIComponent(query)
        const url = `/arbitrary/resources/search?mode=ALL&service=${MAIL_SERVICE_TYPE}&query=${encodedQuery}&limit=20&includemetadata=false&offset=${offset}&reverse=true&excludeblocked=true`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        let fullArrayMsg = reset ? [] : [...messages]
        let newMessages: any[] = []
        for (const message of responseData) {
          const index = fullArrayMsg.findIndex(
            (p) => p.identifier === message.identifier
          )
          if (index !== -1) {
            fullArrayMsg[index] = message
          } else {
            fullArrayMsg.push(message)
            getIndividualMsg(message)
          }
        }
        setMessages(fullArrayMsg)
      } catch (error) {
      } finally {
        if(!hideAlert){
        dispatch(setIsLoadingCustom(null))
        }
      }
    },
    [messages]
  )
  const getMessages = React.useCallback(async () => {
    if (!user?.name || !currentThread) return
    await getMailMessages(currentThread, true)
  }, [getMailMessages, user, currentThread])
  const firstMount = useRef(false)

  const saveTimestamp = useCallback((currentThread: any, username?: string)=> {
    if(!currentThread?.threadData?.groupId || !currentThread?.threadId || !username) return
    const threadIdForLocalStorage = `qmail_threads_${currentThread?.threadData?.groupId}_${currentThread?.threadId}`
    const threads = JSON.parse(
      localStorage.getItem(`qmail_threads_viewedtimestamp_${username}`) || "{}"
    );
    // Convert to an array of objects with identifier and all fields
    let dataArray = Object.entries(threads).map(([identifier, value]) => ({
      identifier,
      ...(value as any),
    }));

    // Sort the array based on timestamp in descending order
    dataArray.sort((a, b) => b.timestamp - a.timestamp);

    // Slice the array to keep only the first 500 elements
    let latest500 = dataArray.slice(0, 500);

    // Convert back to the original object format
    let latest500Data: any = {};
    latest500.forEach(item => {
      const { identifier, ...rest } = item;
      latest500Data[identifier] = rest;
    });
    latest500Data[threadIdForLocalStorage] = {
      timestamp: Date.now(),
    }
    localStorage.setItem(
      `qmail_threads_viewedtimestamp_${username}`,
      JSON.stringify(latest500Data)
    );
  }, [])
  useEffect(() => {
    if (user?.name && currentThread) {
      getMessages()
      firstMount.current = true
      saveTimestamp(currentThread, user.name)
    }
  }, [user, currentThread])
  const messageCallback = useCallback((msg: any) => {
    dispatch(addToHashMapMail(msg))
    setMessages((prev) => [msg, ...prev])
  }, [])

  const interval = useRef<any>(null)

  const checkNewMessages = React.useCallback(
    async (groupInfo: any) => {
      try {
        let str = groupInfo.threadId
        let parts = str.split('_').reverse()
        let result = parts[0]
        const threadId = result
        const query = `qortal_qmail_thmsg_group${groupInfo?.threadData?.groupId}_${threadId}`
        const encodedQuery = encodeURIComponent(query)
        const url = `/arbitrary/resources/search?mode=ALL&service=${MAIL_SERVICE_TYPE}&query=${encodedQuery}&limit=20&includemetadata=false&offset=${0}&reverse=true&excludeblocked=true`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        const latestMessage = messages[0]
        if (!latestMessage) return
        const findMessage = responseData?.findIndex(
          (item: any) => item?.identifier === latestMessage?.identifier
        )
        let sliceLength = responseData.length
        if (findMessage !== -1) {
          sliceLength = findMessage
        }
        const newArray = responseData.slice(0, findMessage).reverse()
        let fullArrayMsg = [...messages]
        for (const message of newArray) {
          try {
            let messageRes = await qortalRequest({
              action: 'FETCH_QDN_RESOURCE',
              name: message.name,
              service: MAIL_SERVICE_TYPE,
              identifier: message.identifier,
              encoding: 'base64'
            })
            let requestEncryptBody: any = {
              action: 'DECRYPT_DATA',
              encryptedData: messageRes
            }
            const resDecrypt = await qortalRequest(requestEncryptBody)
            const decryptToUnit8ArrayMessage = base64ToUint8Array(resDecrypt)
            const responseDataMessage = uint8ArrayToObject(
              decryptToUnit8ArrayMessage
            )

            const fullObject = {
              ...message,
              ...(responseDataMessage || {}),
              id: message.identifier
            }
            dispatch(addToHashMapMail(fullObject))
            const index = messages.findIndex(
              (p) => p.identifier === fullObject.identifier
            )
            if (index !== -1) {
              fullArrayMsg[index] = fullObject
            } else {
              fullArrayMsg.unshift(fullObject)
            }
          } catch (error) {}
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



  if (!currentThread) return null
  return (
    <GroupContainer
      sx={{
        position: "relative",
        overflow: 'auto',
        width: '100%'
      }}
    >
      
       <NewThread
          groupInfo={groupInfo}
          isMessage={true}
          currentThread={currentThread}
          messageCallback={messageCallback}
          members={members}
        />
      <ThreadContainerFullWidth>
      <ThreadContainer>
      <Spacer height="60px" />
          <Box sx={{
            width: '100%',
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
          <GroupNameP>{currentThread?.threadData?.title}</GroupNameP>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <ShowMessageReturnButton
              onClick={() => {
                executeEvent("openNewThreadMessageModal", {});
              }}
            >
              <ComposeP>Post Message</ComposeP>
            </ShowMessageReturnButton>
            <ShowMessageReturnButton onClick={() => {
                      setMessages([])
                      closeThread()
                    }}>
                      <MailIconImg src={ReturnSVG} />
                      <ComposeP>Return to Threads</ComposeP>
                    </ShowMessageReturnButton>
          </Box>
          </Box>
          <Spacer height="60px" />
          {messages.map((message) => {
        let fullMessage = message

        if (hashMapMailMessages[message?.identifier]) {
          fullMessage = hashMapMailMessages[message.identifier]
          return <ShowMessage key={message?.identifier} message={fullMessage} />
        }

        return (
          <SingleThreadParent>
            
              <Skeleton
                variant="rectangular"
                style={{
                  width: '100%',
                  height: 60,
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              />
           
            </SingleThreadParent>
        )
      })}
    </ThreadContainer>
      </ThreadContainerFullWidth>
      {messages.length >= 20 && (
              <LazyLoad onLoadMore={()=> getMailMessages(currentThread, false, true)}></LazyLoad>

      )}
     
    </GroupContainer>
  )
}
