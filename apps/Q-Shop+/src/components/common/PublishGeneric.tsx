import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setNotification } from '../../state/features/notificationsSlice'
import { RootState } from '../../state/store'
import ShortUniqueId from 'short-unique-id'

const uid = new ShortUniqueId()

interface IPublishGeneric {
  title: string
  description: string
  base64: string
  category: string
  service: string
  identifierPrefix: string
  filename: string
  editVideoIdentifier?: string | null | undefined
  
}

export const usePublishGeneric = () => {
  const { user } = useSelector((state: RootState) => state.auth)
  const dispatch = useDispatch()
  const publishGeneric = async ({
    editVideoIdentifier,
    service,
    identifierPrefix,
    filename,
    title,
    description,
    base64,
    category,
    ...rest
  }: IPublishGeneric) => {
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

      let identifier = `${identifierPrefix}_${id}`
      if(editVideoIdentifier){
        identifier = editVideoIdentifier
      }

      const resourceResponse = await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        name: name,
        service: service,
        data64: base64,
        title: title,
        description: description,
        category: category,
        filename,
        ...rest,
        identifier: identifier
      })
      dispatch(
        setNotification({
          msg: `${service} successfully published`,
          alertType: 'success'
        })
      )
      return resourceResponse
    } catch (error: any) {
      let notificationObj = null
      if (typeof error === 'string') {
        notificationObj = {
          msg: error || `Failed to publish ${service}`,
          alertType: 'error'
        }
      } else if (typeof error?.error === 'string') {
        notificationObj = {
          msg: error?.error || `Failed to publish ${service}`,
          alertType: 'error'
        }
      } else {
        notificationObj = {
          msg:
            error?.message || error?.message || `Failed to publish ${service}`,
          alertType: 'error'
        }
      }
      if (!notificationObj) return
      dispatch(setNotification(notificationObj))
    }
  }
  return {
    publishGeneric
  }
}
