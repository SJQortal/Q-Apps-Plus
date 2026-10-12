import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import {
  attachmentBytesStats,
  attachmentFileName,
  fetchAttachmentBytes,
  fetchAttachmentFile,
  resetAttachmentBytesCache,
} from './attachmentBytes'

const reference = {
  identifier: 'attachments_qmail_abc_def',
  name: 'Ali',
  service: 'ATTACHMENT_PRIVATE',
  filename: 'abc.txt',
  originalFilename: 'notes.txt',
  type: 'text/plain',
  size: 5,
}

const plainBase64 = btoa('hello')

describe('fetchAttachmentBytes', () => {
  beforeEach(() => {
    resetAttachmentBytesCache()
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY', percentLoaded: 100 })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ZW5jcnlwdGVk')
    mockQortalAction('DECRYPT_DATA', plainBase64)
  })

  it('fetches as base64 and decrypts with the own key, the way FileElement does', async () => {
    const bytes = await fetchAttachmentBytes(reference)
    expect(new TextDecoder().decode(bytes)).toBe('hello')
    const fetches = qortalCalls('FETCH_QDN_RESOURCE')
    expect(fetches).toHaveLength(1)
    expect(fetches[0]).toEqual({
      action: 'FETCH_QDN_RESOURCE',
      name: 'Ali',
      service: 'ATTACHMENT_PRIVATE',
      identifier: 'attachments_qmail_abc_def',
      encoding: 'base64',
    })
    const decrypts = qortalCalls('DECRYPT_DATA')
    expect(decrypts).toEqual([{ action: 'DECRYPT_DATA', encryptedData: 'ZW5jcnlwdGVk' }])
  })

  it('merges concurrent requests and serves repeats from the cache', async () => {
    const [a, b] = await Promise.all([fetchAttachmentBytes(reference), fetchAttachmentBytes(reference)])
    expect(a).toBe(b)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
    const again = await fetchAttachmentBytes(reference)
    expect(again).toBe(a)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
    expect(attachmentBytesStats().cached).toBe(1)
  })

  it('reports progress from the status polls', async () => {
    const seen: string[] = []
    await fetchAttachmentBytes(reference, { onProgress: p => seen.push(p.status) })
    expect(seen).toContain('READY')
  })

  it('explains a missing attachment in plain words', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'MISSING_DATA' })
    mockQortalAction('FETCH_QDN_RESOURCE', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      throw new Error('Resource not available')
    })
    await expect(fetchAttachmentBytes(reference, { retries: 0 })).rejects.toThrow(
      'Not enough peers have this attachment yet'
    )
  })
})

describe('fetchAttachmentFile', () => {
  beforeEach(() => {
    resetAttachmentBytesCache()
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ZW5j')
    mockQortalAction('DECRYPT_DATA', plainBase64)
  })

  it('builds a File with the original name and MIME type', async () => {
    const file = await fetchAttachmentFile(reference)
    expect(file.name).toBe('notes.txt')
    expect(file.type).toBe('text/plain')
    expect(file.size).toBe(5)
    expect(await file.text()).toBe('hello')
  })

  it('falls back to the stored filename, then the identifier', () => {
    expect(attachmentFileName({ ...reference, originalFilename: '' })).toBe('abc.txt')
    expect(attachmentFileName({ identifier: 'x', name: 'n', service: 's' })).toBe('x')
  })
})
