import { MAIL_SERVICE_TYPE } from '../constants/mail'
import { checkStructureMailMessages } from './checkStructure'
import { errorMessage } from './hubErrors'
import { resolveName } from './nameCache'
import {
  base64ToUint8Array,
  objectToBase64,
  uint8ArrayToObject
} from './toBase64'

/**
 * Backoff for a resource the node has not got yet: 2, 4, 8 and 16 s
 * (docs/QORTAL.md → Hub & GO pitfalls 14). Four retries, then the caller
 * says "Not available on your node right now".
 */
/** The attachments' display names for the subject cache: at most 8, newline-free. */
export function attachmentNamesForCache(attachments: unknown): string[] {
  if (!Array.isArray(attachments)) return []
  return attachments
    .map((item: any) => String(item?.originalFilename || item?.filename || '').replace(/[\r\n]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8)
}

export const NOT_YET_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000]

export interface FetchMailOptions {
  /** How many of NOT_YET_RETRY_DELAYS_MS to use when the node has not got the data yet (default 0: one try). */
  retries?: number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The node answered, but without the data: it is still fetching from peers
 * (Core's 404 "Data unavailable", a 1401 error, or q-apps.js's own timeout
 * while the fetch blocks). Worth trying again shortly; anything else is not.
 */
export function isNotYetAvailable(error: unknown): boolean {
  const text = errorMessage(error, '').toLowerCase()
  const code = (error as { error?: unknown } | null)?.error
  if (code === 1401 || code === 404) return true
  return /data unavailable|not (yet )?downloaded|unavailable|404|timed out|failed to fetch|network/.test(text)
}

/**
 * True for the body Core serves for a deleted resource: the delete marker
 * Hub and qapp-core publish is "D" (some tools "\n"). With `encoding: base64`
 * it arrives encoded, so both forms are checked (pitfall 14).
 */
export function isDeletedBody(body: unknown): boolean {
  if (typeof body !== 'string') return false
  const raw = body.trim()
  if (raw === 'D') return true
  if (!raw || raw.length > 8) return false
  try {
    const decoded = atob(raw).trim()
    return decoded === 'D' || decoded === ''
  } catch {
    return false
  }
}

/**
 * Fetches and decrypts one MAIL_PRIVATE message (the original app's exact
 * call shapes: FETCH_QDN_RESOURCE base64 → GET_NAME_DATA/GET_ACCOUNT_DATA
 * for the other party → DECRYPT_DATA), saves the encrypted subject locally
 * and resolves the message object. It never throws; the object says what
 * happened:
 *
 * - `isValid: true` with the decrypted fields;
 * - `unableToDecrypt: true` when it was not encrypted to this key;
 * - `deleted: true` when the sender removed it (a "D" body);
 * - `fetchError` (+ `notAvailable: true` once the retries are used up) when
 *   the node could not provide it.
 *
 * The search row's `user` and `id` always win over anything the body claims
 * (pitfall 15): another name can publish under the same identifier, and a
 * body can name a different publisher.
 */
export const fetchAndEvaluateMail = async (
  data: any,
  saveToHash?: (val: any) => void,
  username?: string,
  options: FetchMailOptions = {}
) => {
  const retries = Math.max(0, Math.min(options.retries ?? 0, NOT_YET_RETRY_DELAYS_MS.length))
  const sleep = options.sleep ?? defaultSleep

  const fetchBody = async (user: string, messageIdentifier: string): Promise<string> => {
    let attempt = 0
    for (;;) {
      try {
        const res = await qortalRequest({
          action: 'FETCH_QDN_RESOURCE',
          name: user,
          service: MAIL_SERVICE_TYPE,
          identifier: messageIdentifier,
          encoding: 'base64'
        })
        return res
      } catch (error) {
        if (attempt >= retries || !isNotYetAvailable(error)) throw error
        await sleep(NOT_YET_RETRY_DELAYS_MS[attempt])
        attempt += 1
      }
    }
  }

  const getBlogPost = async () => {
    const { user, messageIdentifier, content, otherUser } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    try {
      if (!user || !messageIdentifier) return obj
      const base64 = await fetchBody(user, messageIdentifier)
      if (isDeletedBody(base64)) {
        obj = { ...obj, deleted: true, id: messageIdentifier, user }
        if (saveToHash) saveToHash(obj)
        return obj
      }
      // The other party's key through the session name cache: one
      // GET_NAME_DATA per name and one GET_ACCOUNT_DATA per address, not one
      // pair per message. Transport errors still throw (caught below).
      const resolved = await resolveName(otherUser)
      if (!resolved) return obj
      const recipientPublicKey = resolved.publicKey
      const requestEncryptBody: any = {
        action: 'DECRYPT_DATA',
        encryptedData: base64,
        publicKey: recipientPublicKey
      }
      let resDecrypt = null
      try {
        resDecrypt = await qortalRequest(requestEncryptBody)
      } catch (error) {
        // Not encrypted to this key: reported below.
      }
      if (!resDecrypt) {
        obj = {
          ...obj,
          unableToDecrypt: true,
          id: messageIdentifier,
          user
        }
        if (saveToHash) {
          saveToHash(obj)
        }
        return obj
      }
      const decryptToUnit8Array = base64ToUint8Array(resDecrypt)
      const responseData = uint8ArrayToObject(decryptToUnit8Array)
      if (checkStructureMailMessages(responseData)) {
        obj = {
          ...content,
          ...responseData,
          // The row's publisher and identifier, never the body's.
          user,
          title: responseData.title,
          createdAt: responseData.createdAt,
          id: messageIdentifier,
          isValid: true
        }

        try {
          const encryptData = async (data: any) => {
            const dataToBase64 = await objectToBase64(data)

            const res = await qortalRequest({
              action: 'ENCRYPT_DATA',
              data64: dataToBase64
            })
            if (res) return res
            else return ''
          }
          if (username) {
            const subjects = JSON.parse(localStorage.getItem(`qmail_persistance_${username}`) || '{}')
            const existing = subjects[messageIdentifier]
            // Q-Mail+ also keeps the attachments' names (encrypted like the
            // subject, an extra field Q-Mail ignores) so list rows can show
            // them; an entry from before gets them the next time it decrypts.
            const names = attachmentNamesForCache(obj?.attachments)
            const needsNames = Boolean(existing) && names.length > 0 && !existing.attachmentNames
            if (!existing || needsNames) {
              const copySubjects = structuredClone(subjects)
              let entry = existing ? { ...existing } : null
              if (!entry) {
                let subject = obj?.subject || ''
                if (subject) {
                  subject = await encryptData(subject)
                }
                entry = {
                  timestamp: Date.now(),
                  subject: subject || '',
                  attachments: obj?.attachments?.length > 0 ? true : false
                }
              }
              if (names.length) {
                const encryptedNames = await encryptData(names.join('\n'))
                if (encryptedNames) entry.attachmentNames = encryptedNames
              }
              copySubjects[messageIdentifier] = entry
              localStorage.setItem(`qmail_persistance_${username}`, JSON.stringify(copySubjects))
            }
          }
        } catch (error) {
          console.log({ error })
        }
      }
      if (saveToHash) {
        saveToHash(obj)
      }
      return obj
    } catch (error) {
      // Bugs #3: a thrown FETCH/GET_NAME_DATA/GET_ACCOUNT_DATA used to resolve
      // `undefined` and leave the open-message dialog spinning for ever.
      const notYet = isNotYetAvailable(error)
      return {
        ...obj,
        isValid: false,
        fetchError: errorMessage(error, 'The message could not be fetched.'),
        notAvailable: notYet
      }
    }
  }

  const res = await getBlogPost()
  return res
}
