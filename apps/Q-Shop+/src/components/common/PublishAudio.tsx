import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setNotification } from '../../state/features/notificationsSlice'
import { RootState } from '../../state/store'
import ShortUniqueId from 'short-unique-id'

const uid = new ShortUniqueId()

interface IPublishVideo {
  title: string
  description: string
  base64: string
  category: string
    editVideoIdentifier?: string | null | undefined

}

export const usePublishAudio = () => {
  const { user } = useSelector((state: RootState) => state.auth)
  const dispatch = useDispatch()
  const publishAudio = async ({
    editVideoIdentifier,
    title,
    description,
    base64,
    category,
    ...rest
  }: IPublishVideo) => {
    let address
    let name
    let errorMsg = ''

    address = user?.address
    name = user?.name || ''

    const missingFields = []
    if (!address) {
      errorMsg = "Cannot post: your address isn't available"
    }
    if (!name) {
      errorMsg = 'Cannot post without a name'
    }
    if (!title) missingFields.push('title')
    if (missingFields.length > 0) {
      const missingFieldsString = missingFields.join(', ')
      const errMsg = `Missing: ${missingFieldsString}`
      errorMsg = errMsg
    }

    if (errorMsg) {
      dispatch(
        setNotification({
          msg: errorMsg,
          alertType: 'error'
        })
      )
      throw new Error(errorMsg)
    }

    try {
      const id = uid()

      let identifier = `qaudio_qblog_${id}`
      if(editVideoIdentifier){
        identifier = editVideoIdentifier
      }
      const resourceResponse = await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        name: name,
        service: 'AUDIO',
        data64: base64,
        title: title,
        description: description,
        category: category,
        ...rest,
        identifier: identifier
      })
      dispatch(
        setNotification({
          msg: 'Audio successfully published',
          alertType: 'success'
        })
      )
      return resourceResponse
    } catch (error: any) {
      let notificationObj = null
      if (typeof error === 'string') {
        notificationObj = {
          msg: error || 'Failed to publish audio',
          alertType: 'error'
        }
      } else if (typeof error?.error === 'string') {
        notificationObj = {
          msg: error?.error || 'Failed to publish audio',
          alertType: 'error'
        }
      } else {
        notificationObj = {
          msg: error?.message || error?.message || 'Failed to publish audio',
          alertType: 'error'
        }
      }
      if (!notificationObj) return
      dispatch(setNotification(notificationObj))
     
    }
  }
  return {
    publishAudio
  }
}
