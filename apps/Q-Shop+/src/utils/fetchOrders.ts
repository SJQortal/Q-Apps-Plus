import { Status } from '../state/features/orderSlice'
import { checkStructure, checkStructureOrders } from './checkStructure'
import { base64ToObject } from './toBase64'

export const fetchAndEvaluateOrders = async (data: any) => {
  const getOrders = async () => {

    const { user, orderId, content } = data
    
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!user || !orderId) return obj

    try {
      const data = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: user,
        service: 'DOCUMENT_PRIVATE',
        identifier: orderId,
        encoding: 'base64'
      })
      const decryptedData = await qortalRequest({
        action: 'DECRYPT_DATA',
        encryptedData: data
      })
      let statusDocument: any = {
        status: 'Received',
        note: ''
      }
      const dataToObject = await base64ToObject(decryptedData)

      if (checkStructureOrders(dataToObject)) {
          obj = {
            ...dataToObject,
            ...content,
            ...statusDocument,
            user,
            id: orderId,
            isValid: true
          }
        }
        return obj
    } catch (error) {
      console.error(error);
    }
  }
  const res = await getOrders()
  return res
}
