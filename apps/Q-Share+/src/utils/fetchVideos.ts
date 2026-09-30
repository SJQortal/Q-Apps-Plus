import { checkStructure } from './checkStructure'

/**
 * A share body is a JSON object. Torq and qapp-core delete a share by
 * republishing it as "D" (or "\n"), and Core's FETCH_QDN_RESOURCE hands any
 * text that isn't JSON back as a plain string, so anything else is not a
 * share (see notShareFlags). Missing optional fields (no files, no
 * description) are still a share.
 */
export const isShareBody = (body: unknown): body is Record<string, unknown> =>
  !!body && typeof body === 'object' && !Array.isArray(body)

export const fetchAndEvaluateVideos = async (data: any) => {
  const getVideo = async () => {
    const { user, videoId, content } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!user || !videoId) return obj

    try {

      const responseData = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: user,
        service: content?.service || 'DOCUMENT',
        identifier: videoId
      })
      if (isShareBody(responseData) && checkStructure(responseData)) {
        obj = {
          ...content,
          ...responseData,
          isValid: true
        }
      } else {
        // Kept in the hash map so lists can leave it out and it isn't fetched again.
        obj = { ...content, ...notShareFlags(responseData) }
      }
      return obj
    } catch (error: any) {
      throw new Error(error?.message || 'error')
    }
  }

  const res = await getVideo()
  return res
}

/**
 * The hash-map flags for a body that isn't a share. The delete marker Torq
 * and qapp-core publish ("D", some tools "\n") is `deleted`; JSON that isn't
 * an object can't be read. Any longer text is an error page (Jetty's 400, a
 * proxy's 502) rather than the share, so it throws and the fetch is tried again.
 */
export function notShareFlags(body: unknown): { isValid: false; deleted: boolean } {
  if (typeof body === 'string' && body.trim().length > 1) {
    throw new Error('The node sent a page instead of the share')
  }
  return { isValid: false, deleted: typeof body === 'string' }
}
