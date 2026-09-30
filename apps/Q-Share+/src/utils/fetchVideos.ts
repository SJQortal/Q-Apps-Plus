import { checkStructure } from './checkStructure'
import { errorMessage } from './hubErrors'

/**
 * A share body is a JSON object. Torq and qapp-core delete a share by
 * republishing it as "D" (or "\n"), and Core's FETCH_QDN_RESOURCE hands any
 * text that isn't JSON back as a plain string, so anything else is not a
 * share (see notShareFlags). Missing optional fields (no files, no
 * description) are still a share.
 */
export const isShareBody = (body: unknown): body is Record<string, unknown> =>
  !!body && typeof body === 'object' && !Array.isArray(body)

/**
 * Names that Core's q-apps.js can't fetch: it builds "/arbitrary/<service>/<name>/…"
 * without encoding, so "Vallot-/8/" gets an HTTP 400 HTML page (read back as
 * a string) and "#", "?", "%" or "\" break the URL too.
 */
export const needsEncodedFetch = (name: string): boolean => /[/#?%\\]/.test(name)

/**
 * GET a QDN resource with the name encoded, answering the way FETCH_QDN_RESOURCE
 * does: parsed JSON, or the raw text when it isn't JSON; an empty body, an
 * HTTP error or a Core `{error}` rejects.
 */
export async function fetchQdnResource(service: string, name: string, identifier: string): Promise<unknown> {
  const response = await fetch(
    `/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`,
    { method: 'GET' }
  )
  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // Not JSON: keep the text, as q-apps.js does.
  }
  if (!response.ok || (isShareBody(body) && 'error' in body)) {
    // Core errors are JSON ({error: 1401, message}); Jetty's are HTML pages.
    const fallback = `QDN fetch failed (${response.status})`
    throw new Error(isShareBody(body) ? errorMessage(body, fallback) : fallback)
  }
  if (!text) throw new Error('Empty response')
  return body
}

/** The fields of a list row that come from the node's search, not from the publisher. */
export interface ShareRow {
  id: string
  user: string
  created?: number | string
  updated?: number | string
  service?: string
}

/**
 * A share's hash-map entry: the publisher's JSON over the search row, except
 * that the row's identifier, name, dates and service always win and the body
 * can't mark itself deleted. Otherwise a body could file itself under another
 * share's identifier or name, or date itself so far ahead that the real body
 * is never fetched again. Q-Share bodies carry none of these fields.
 */
export function shareFromBody<Row extends ShareRow>(row: Row, body: Record<string, unknown>) {
  const { deleted: _deleted, isValid: _isValid, ...fields } = body
  return {
    ...row,
    ...fields,
    id: row.id,
    user: row.user,
    created: row.created,
    updated: row.updated,
    service: row.service,
    isValid: true as const
  }
}

export const fetchAndEvaluateVideos = async (data: any) => {
  const getVideo = async () => {
    const { user, videoId, content } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!user || !videoId) return obj

    try {
      const service = content?.service || 'DOCUMENT'
      const responseData = needsEncodedFetch(user)
        ? await fetchQdnResource(service, user, videoId)
        : await qortalRequest({
            action: 'FETCH_QDN_RESOURCE',
            name: user,
            service,
            identifier: videoId
          })
      if (isShareBody(responseData) && checkStructure(responseData)) {
        obj = shareFromBody({ ...content, id: videoId, user, service }, responseData)
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
