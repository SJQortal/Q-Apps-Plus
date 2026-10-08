import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import { NOT_YET_RETRY_DELAYS_MS, attachmentNamesForCache, fetchAndEvaluateMail, isDeletedBody, isNotYetAvailable } from './fetchMail'
import { resetNameCache } from './nameCache'

const row = { user: 'alice', messageIdentifier: '_mail_qortal_qmail_bob_abc123_mail_x1', content: { createdAt: 5, user: 'alice', id: 'row' }, otherUser: 'alice' }
const mailJson = { subject: 'Hi', createdAt: 1700000000000, version: 1, attachments: [], textContentV2: '<p>hello</p>', generalData: { threadV2: [] }, recipient: 'bob' }

describe('fetchAndEvaluateMail', () => {
  beforeEach(() => {
    resetNameCache()
    mockQortalAction('GET_NAME_DATA', { owner: 'Qalice' })
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PKalice' })
    mockQortalAction('ENCRYPT_DATA', 'encrypted-subject')
  })

  it('trusts the search row over the body: user and id are the row\'s, the body\'s name and id are ignored', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify({ ...mailJson, user: 'mallory', name: 'mallory', id: 'other' })))
    const res = await fetchAndEvaluateMail(row, undefined, 'bob')
    expect(res).toMatchObject({ isValid: true, user: 'alice', id: row.messageIdentifier, subject: 'Hi' })
    expect(res.name).toBe('mallory') // kept as data, never as the publisher
  })

  it('looks up the sender\'s name and key once for several messages from them', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson)))
    await fetchAndEvaluateMail(row, undefined, 'bob')
    await fetchAndEvaluateMail({ ...row, messageIdentifier: '_mail_qortal_qmail_bob_abc123_mail_x2' }, undefined, 'bob')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(qortalCalls('GET_ACCOUNT_DATA')).toHaveLength(1)
    expect(qortalCalls('DECRYPT_DATA')[1]).toEqual({ action: 'DECRYPT_DATA', encryptedData: 'ENC', publicKey: 'PKalice' })
  })

  it.each(['D', btoa('D'), btoa('D\n'), 'Cg=='])('reports a deleted resource for body %s and fetches nothing else', async (body) => {
    mockQortalAction('FETCH_QDN_RESOURCE', body)
    const saved: any[] = []
    const res = await fetchAndEvaluateMail(row, (v) => saved.push(v))
    expect(res).toMatchObject({ isValid: false, deleted: true, id: row.messageIdentifier, user: 'alice' })
    expect(saved).toHaveLength(1)
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(0)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(0)
  })

  it('keeps the attachments\' names in the subject cache, encrypted, and adds them to an entry from before', async () => {
    localStorage.clear()
    const withFiles = { ...mailJson, attachments: [{ originalFilename: 'plan.pdf' }, { filename: 'x.png' }] }
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(withFiles)))
    // An entry cached by Q-Mail or 1.0.0: subject and the attachments flag only.
    localStorage.setItem('qmail_persistance_bob', JSON.stringify({ [row.messageIdentifier]: { timestamp: 1, subject: 'old-encrypted', attachments: true } }))
    await fetchAndEvaluateMail(row, undefined, 'bob')
    const entry = JSON.parse(localStorage.getItem('qmail_persistance_bob') || '{}')[row.messageIdentifier]
    expect(entry).toEqual({ timestamp: 1, subject: 'old-encrypted', attachments: true, attachmentNames: 'encrypted-subject' })
    const encrypted = qortalCalls('ENCRYPT_DATA').map((call) => JSON.parse(atob(call.data64)))
    expect(encrypted).toEqual(['plan.pdf\nx.png'])
    // Next time nothing is encrypted again.
    await fetchAndEvaluateMail(row, undefined, 'bob')
    expect(qortalCalls('ENCRYPT_DATA')).toHaveLength(1)
  })

  it('names for the cache: at most 8, without line breaks', () => {
    expect(attachmentNamesForCache([{ originalFilename: 'a\nb.txt' }, {}, { filename: 'c.pdf' }])).toEqual(['a b.txt', 'c.pdf'])
    expect(attachmentNamesForCache(Array.from({ length: 10 }, (_, i) => ({ originalFilename: `f${i}` })))).toHaveLength(8)
    expect(attachmentNamesForCache(undefined)).toEqual([])
  })

  it('does not call a real body deleted', () => {
    expect(isDeletedBody(btoa('{"a":1}'))).toBe(false)
    expect(isDeletedBody('ENC')).toBe(false)
    expect(isDeletedBody('')).toBe(false)
    expect(isDeletedBody(null)).toBe(false)
  })

  it('asks again at 2, 4, 8 and 16 s while the node has not got the data yet, then gives up as not available', async () => {
    const waits: number[] = []
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Data unavailable. Please try again later.' }
    })
    const res = await fetchAndEvaluateMail(row, undefined, undefined, { retries: 4, sleep: async (ms) => void waits.push(ms) })
    expect(waits).toEqual(NOT_YET_RETRY_DELAYS_MS)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(5)
    expect(res).toMatchObject({ isValid: false, notAvailable: true })
    expect(res.fetchError).toMatch(/Data unavailable/)
  })

  it('succeeds on a later try', async () => {
    let calls = 0
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      calls += 1
      if (calls < 3) throw new Error('404 Data unavailable')
      return 'ENC'
    })
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson)))
    const waits: number[] = []
    const res = await fetchAndEvaluateMail(row, undefined, undefined, { retries: 4, sleep: async (ms) => void waits.push(ms) })
    expect(res.isValid).toBe(true)
    expect(waits).toEqual([2000, 4000])
  })

  it('does not retry other failures, and never retries without the option', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw new Error('node down')
    })
    const waits: number[] = []
    const res = await fetchAndEvaluateMail(row, undefined, undefined, { retries: 4, sleep: async (ms) => void waits.push(ms) })
    expect(waits).toEqual([])
    expect(res).toMatchObject({ isValid: false, fetchError: 'node down', notAvailable: false })

    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw new Error('Data unavailable')
    })
    const once = await fetchAndEvaluateMail(row)
    expect(once).toMatchObject({ isValid: false, notAvailable: true })
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)
  })

  it('classifies not-yet-available answers', () => {
    expect(isNotYetAvailable({ error: 1401, message: 'Data unavailable' })).toBe(true)
    expect(isNotYetAvailable('The request timed out')).toBe(true)
    expect(isNotYetAvailable(new Error('Failed to fetch'))).toBe(true)
    expect(isNotYetAvailable(new Error('Missing fields: name'))).toBe(false)
    expect(isNotYetAvailable('user declined request')).toBe(false)
  })
})
