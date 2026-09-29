import { MAIL_SERVICE_TYPE } from '../constants/mail'
import { checkStructure, checkStructureMailMessages } from './checkStructure'
import { extractTextFromSlate } from './extractTextFromSlate'
import {
  base64ToUint8Array,
  objectToUint8ArrayFromResponse,
  uint8ArrayToObject
} from './toBase64'

export const fetchAndEvaluateMail = async (data: any) => {
  const getBlogPost = async () => {
    const { user, messageIdentifier, content, otherUser } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    try {
      // throw new Error('hello')
      if (!user || !messageIdentifier) return obj
      const url = `/arbitrary/${MAIL_SERVICE_TYPE}/${user}/${messageIdentifier}`
      let res = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: user,
        service: MAIL_SERVICE_TYPE,
        identifier: messageIdentifier,
        encoding: 'base64'
      })
      const base64 = res
      const resName = await qortalRequest({
        action: 'GET_NAME_DATA',
        name: otherUser
      })
      if (!resName?.owner) return obj

      const recipientAddress = resName.owner
      const resAddress = await qortalRequest({
        action: 'GET_ACCOUNT_DATA',
        address: recipientAddress
      })
      if (!resAddress?.publicKey) return obj
      const recipientPublicKey = resAddress.publicKey
      let requestEncryptBody: any = {
        action: 'DECRYPT_DATA',
        encryptedData: base64,
        publicKey: recipientPublicKey
      }
      const resDecrypt = await qortalRequest(requestEncryptBody)

      if (!resDecrypt) return obj
      const decryptToUnit8Array = base64ToUint8Array(resDecrypt)
      const responseData = uint8ArrayToObject(decryptToUnit8Array)

      if (checkStructureMailMessages(responseData)) {
        obj = {
          ...content,
          ...responseData,
          user,
          title: responseData.title,
          createdAt: responseData.createdAt,
          id: messageIdentifier,
          isValid: true
        }
      }
      return obj
    } catch (error) {
      console.log({ error })
    }
  }

  const res = await getBlogPost()
  return res
}
