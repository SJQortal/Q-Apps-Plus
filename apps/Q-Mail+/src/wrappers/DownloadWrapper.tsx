/**
 * Download context kept for the older components that call `downloadVideo`.
 *
 * It no longer polls: asking for a resource registers it in Redux
 * `global.downloads` and sends one GET_QDN_RESOURCE_PROPERTIES so Core fetches
 * it from peers. Components that need progress use `useResourceReady` /
 * `useAttachment` (src/components/AttachmentPreview), which poll politely
 * through `usePolling` and stop on unmount. The unused GET_QDN_RESOURCE_URL
 * fetch is gone.
 */
import React from 'react'
import { useDispatch } from 'react-redux'

import { setAddToDownloads } from '../state/features/globalSlice'
import { startResourceDownload } from '../utils/attachmentCache'

interface Props {
  children: React.ReactNode
}

interface IDownloadVideoParams {
  name: string
  service: string
  identifier: string
  properties?: any
  blogPost?: any
}
interface MyContextInterface {
  downloadVideo: ({
    name,
    service,
    identifier,
    properties,
    blogPost
  }: IDownloadVideoParams) => void
}

const defaultValues: MyContextInterface = {
  downloadVideo: () => {}
}

export const MyContext = React.createContext<MyContextInterface>(defaultValues)

const DownloadWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch()

  const downloadVideo = React.useCallback(
    ({ name, service, identifier, properties, blogPost }: IDownloadVideoParams) => {
      if (!name || !service || !identifier) return
      dispatch(
        setAddToDownloads({
          name,
          service,
          identifier,
          properties: properties ?? blogPost ?? {}
        })
      )
      void startResourceDownload({ name, service, identifier })
    },
    [dispatch]
  )

  const value = React.useMemo(() => ({ downloadVideo }), [downloadVideo])

  return <MyContext.Provider value={value}>{children}</MyContext.Provider>
}

export default DownloadWrapper
