import React from 'react'
import { useDispatch, useSelector } from 'react-redux'


import {
  setAddToDownloads,
  updateDownloads
} from '../state/features/globalSlice'

import { DownloadTaskManager } from '../components/common/DownloadTaskManager'
import { RootState } from '../state/store'

interface Props {
  children: React.ReactNode
}


const defaultValues: MyContextInterface = {
  downloadVideo: () => {}
}
interface IDownloadVideoParams {
  name: string
  service: string
  identifier: string
  properties: any
}
interface MyContextInterface {
  downloadVideo: ({
    name,
    service,
    identifier,
    properties
  }: IDownloadVideoParams) => void
}
export const MyContext = React.createContext<MyContextInterface>(defaultValues)

const DownloadWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch()
  const downloads  = useSelector((state: RootState) => state.global?.downloads);


  const fetchResource = async ({ name, service, identifier }: any) => {
    try {
      await qortalRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier
      })
    } catch (error) {}
  }

  const fetchVideoUrl = async ({ name, service, identifier }: any) => {
    try {
      fetchResource({ name, service, identifier })
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        service: service,
        name: name,
        identifier: identifier
      })
      if (url) {
        dispatch(
          updateDownloads({
            name,
            service,
            identifier,
            url
          })
        )
      }
    } catch (error) {}
  }

  const performDownload = ({
    name,
    service,
    identifier,
    properties
  }: IDownloadVideoParams) => {
    if(downloads[identifier]) return
    dispatch(
      setAddToDownloads({
        name,
        service,
        identifier,
        properties
      })
    )

    let isCalling = false
    let percentLoaded = 0
    let timer = 24
    let failures = 0
    const stop = () => clearInterval(intervalId)
    // Poll the download status every 5 s while the tab is visible, and stop
    // for good once the file is ready, missing, or the node keeps failing.
    const intervalId = setInterval(async () => {
      if (isCalling) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      isCalling = true
      try {
        const res = await qortalRequest({
          action: 'GET_QDN_RESOURCE_STATUS',
          name: name,
          service: service,
          identifier: identifier
        })
        if (!res) return
        failures = 0
        if (res?.status === 'NOT_PUBLISHED') {
          dispatch(updateDownloads({ name, service, identifier, status: res }))
          stop()
          return
        }
        if (res.localChunkCount) {
          if (res.percentLoaded) {
            if (res.percentLoaded === percentLoaded && res.percentLoaded !== 100) {
              timer = timer - 5
            } else {
              timer = 24
            }
            if (timer < 0) {
              timer = 24
              isCalling = true
              dispatch(
                updateDownloads({
                  name,
                  service,
                  identifier,
                  status: { ...res, status: 'REFETCHING' }
                })
              )
              setTimeout(() => {
                isCalling = false
                fetchResource({ name, service, identifier })
              }, 25000)
              return
            }
            percentLoaded = res.percentLoaded
          }
          dispatch(updateDownloads({ name, service, identifier, status: res }))
        }
        if (res?.status === 'READY') {
          stop()
          dispatch(updateDownloads({ name, service, identifier, status: res }))
        }
      } catch (error) {
        failures += 1
        if (failures >= 6) stop()
      } finally {
        if (timer >= 0) isCalling = false
      }
    }, 5000)

    fetchVideoUrl({
      name,
      service,
      identifier
    })
  }

  const downloadVideo = async ({
    name,
    service,
    identifier,
    properties
  }: IDownloadVideoParams) => {
    try {


      performDownload({
        name,
        service,
        identifier,
        properties
      })
      return 'addedToList'
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <>
      <MyContext.Provider value={{ downloadVideo }}>
        {/* <DownloadTaskManager /> */}
        {children}
      </MyContext.Provider>
    </>
  )
}

export default DownloadWrapper
