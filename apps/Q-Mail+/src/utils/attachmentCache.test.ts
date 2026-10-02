import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import {
  attachmentCacheStats,
  fetchResourceStatus,
  getCachedAttachment,
  loadAttachment,
  normalizeStatus,
  resetAttachmentCache,
  saveAttachment,
  setAttachmentCacheLimit,
  startResourceDownload,
} from './attachmentCache'

const ref = (identifier: string, extra: Record<string, any> = {}) => ({
  name: 'alice',
  service: 'ATTACHMENT_PRIVATE',
  identifier,
  filename: `${identifier}.png`,
  originalFilename: 'cat.png',
  type: null,
  ...extra,
})

function mockBytes(plain: string, encrypted = 'ENC') {
  mockQortalAction('FETCH_QDN_RESOURCE', () => encrypted)
  mockQortalAction('DECRYPT_DATA', (req: Record<string, any>) => (req.encryptedData === encrypted ? btoa(plain) : null))
}

describe('attachmentCache', () => {
  beforeEach(() => {
    resetAttachmentCache()
  })

  it('normalises Core status answers', () => {
    expect(normalizeStatus({ status: 'DOWNLOADING', percentLoaded: 42.4 }).percentLoaded).toBeCloseTo(42.4)
    expect(normalizeStatus({ status: 'downloading', localChunkCount: 1, totalChunkCount: 4 })).toMatchObject({
      status: 'DOWNLOADING',
      percentLoaded: 25,
    })
    expect(normalizeStatus({ status: 'READY' }).percentLoaded).toBe(100)
    expect(normalizeStatus(null)).toEqual({ status: '', percentLoaded: undefined, localChunkCount: undefined, totalChunkCount: undefined })
  })

  it('fetches, decrypts and types the bytes with the exact call shapes', async () => {
    mockBytes('hello')
    const entry = await loadAttachment(ref('att1'))
    expect(await entry.blob.text()).toBe('hello')
    expect(entry.mimeType).toBe('image/png')
    expect(entry.size).toBe(5)
    expect(entry.filename).toBe('cat.png')
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toEqual([
      { action: 'FETCH_QDN_RESOURCE', name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'att1', encoding: 'base64' },
    ])
    expect(qortalCalls('DECRYPT_DATA')).toEqual([{ action: 'DECRYPT_DATA', encryptedData: 'ENC' }])
  })

  it('serves repeats from the cache and merges loads in flight', async () => {
    mockBytes('hello')
    const [a, b] = await Promise.all([loadAttachment(ref('att1')), loadAttachment(ref('att1'))])
    expect(a).toBe(b)
    const c = await loadAttachment(ref('att1'))
    expect(c).toBe(a)
    expect(getCachedAttachment(ref('att1'))).toBe(a)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(1)
    expect(attachmentCacheStats()).toMatchObject({ loads: 1, merged: 1, cacheHits: 1, entries: 1, bytes: 5 })
  })

  it('prefers the reference type, then the MIME type Core reported, then the extension', async () => {
    mockBytes('x')
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', { mimeType: 'text/plain', filename: 'id.bin' })
    await startResourceDownload(ref('withProps'))
    const fromProps = await loadAttachment(ref('withProps', { originalFilename: 'thing.bin', filename: undefined }))
    expect(fromProps.mimeType).toBe('text/plain')
    expect(fromProps.filename).toBe('thing.bin')
    const fromRef = await loadAttachment(ref('withType', { type: 'audio/mpeg' }))
    expect(fromRef.mimeType).toBe('audio/mpeg')
  })

  it('throws when the fetch or the decrypt fails', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw new Error('node down')
    })
    await expect(loadAttachment(ref('bad'))).rejects.toThrow('node down')
    mockQortalAction('FETCH_QDN_RESOURCE', () => 'ENC')
    mockQortalAction('DECRYPT_DATA', () => null)
    await expect(loadAttachment(ref('bad'))).rejects.toThrow(/decrypted/)
    expect(attachmentCacheStats().entries).toBe(0)
    expect(attachmentCacheStats().inFlight).toBe(0)
  })

  it('caps the cache, evicting least recently used entries and revoking their URLs', async () => {
    const created: string[] = []
    const revoked: string[] = []
    const urlAny = URL as any
    urlAny.createObjectURL = vi.fn((blob: Blob) => {
      const u = `blob:${blob.size}-${created.length}`
      created.push(u)
      return u
    })
    urlAny.revokeObjectURL = vi.fn((u: string) => revoked.push(u))
    setAttachmentCacheLimit(10)
    mockBytes('aaaa') // 4 bytes
    const a = await loadAttachment(ref('a'))
    mockBytes('bbbb', 'ENC2')
    const b = await loadAttachment(ref('b'))
    expect(attachmentCacheStats().bytes).toBe(8)
    getCachedAttachment(ref('a')) // a is now the most recently used
    mockBytes('cccc', 'ENC3')
    await loadAttachment(ref('c'))
    expect(getCachedAttachment(ref('b'))).toBeUndefined()
    expect(getCachedAttachment(ref('a'))).toBe(a)
    expect(revoked).toEqual([b.url])
    expect(attachmentCacheStats()).toMatchObject({ entries: 2, bytes: 8, evictions: 1 })
    delete urlAny.createObjectURL
    delete urlAny.revokeObjectURL
  })

  it('saves through SAVE_FILE with the original filename and MIME type', async () => {
    mockBytes('hello')
    mockQortalAction('SAVE_FILE', true)
    const entry = await loadAttachment(ref('att1'))
    await saveAttachment(entry, ref('att1'))
    const [call] = qortalCalls('SAVE_FILE')
    expect(call).toMatchObject({ action: 'SAVE_FILE', filename: 'cat.png', mimeType: 'image/png' })
    expect(call.blob).toBe(entry.blob)
  })

  it('a declined save prompt resolves false and is not an error; other failures throw their message', async () => {
    mockBytes('hello')
    const entry = await loadAttachment(ref('att2'))
    for (const decline of ['User declined to save file', 'Benutzer hat das Speichern der Datei abgelehnt', '用户拒绝保存文件']) {
      mockQortalAction('SAVE_FILE', () => {
        throw decline
      })
      expect(await saveAttachment(entry, ref('att2'))).toBe(false)
    }
    mockQortalAction('SAVE_FILE', () => {
      throw { error: 'Missing filename', message: 'Missing filename' }
    })
    await expect(saveAttachment(entry, ref('att2'))).rejects.toThrow('Missing filename')
    mockQortalAction('SAVE_FILE', true)
    expect(await saveAttachment(entry, ref('att2'))).toBe(true)
  })

  it('keys the cache by publisher name and identifier: another name under the same identifier is another file', async () => {
    mockBytes('from alice')
    const alice = await loadAttachment(ref('shared'))
    mockBytes('from bob', 'ENC-BOB')
    const bob = await loadAttachment(ref('shared', { name: 'bob' }))
    expect(await alice.blob.text()).toBe('from alice')
    expect(await bob.blob.text()).toBe('from bob')
    expect(getCachedAttachment({ name: 'Alice', identifier: 'shared' })).toBe(alice)
    expect(getCachedAttachment({ name: 'bob', identifier: 'shared' })).toBe(bob)
    expect(attachmentCacheStats().entries).toBe(2)
  })

  it('reports a deleted attachment (a "D" body) and caches nothing', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', () => btoa('D'))
    await expect(loadAttachment(ref('gone'))).rejects.toMatchObject({ deleted: true, message: /removed by its sender/ })
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(0)
    expect(attachmentCacheStats().entries).toBe(0)
  })

  it('asks again at 2, 4, 8 and 16 s while the node has not got the data yet', async () => {
    let calls = 0
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      calls += 1
      if (calls < 3) throw { error: 1401, message: 'Data unavailable. Please try again later.' }
      return 'ENC'
    })
    mockQortalAction('DECRYPT_DATA', btoa('late'))
    const waits: number[] = []
    const entry = await loadAttachment(ref('late'), { retries: 4, sleep: async (ms) => void waits.push(ms) })
    expect(await entry.blob.text()).toBe('late')
    expect(waits).toEqual([2000, 4000])
  })

  it('reads the status and asks Core to fetch with GET_QDN_RESOURCE_PROPERTIES', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'DOWNLOADING', percentLoaded: 10 })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', () => {
      throw new Error('not yet')
    })
    expect(await fetchResourceStatus(ref('s'))).toMatchObject({ status: 'DOWNLOADING', percentLoaded: 10 })
    await expect(startResourceDownload(ref('s'))).resolves.toBeUndefined()
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS')).toEqual([
      { action: 'GET_QDN_RESOURCE_STATUS', name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 's' },
    ])
    expect(qortalCalls('GET_QDN_RESOURCE_PROPERTIES')).toHaveLength(1)
  })
})
