import { describe, expect, it } from 'vitest'
import { mockFetchRoute, mockQortalAction, qortalCalls } from '../test/setup'
import { readPublishedMailStateFromQdn } from './publishedMailStateRemote'
import { objectToBase64 } from './toBase64'

describe('readPublishedMailStateFromQdn', () => {
  it('resolves to null without fetching when the name never published a state', async () => {
    mockFetchRoute('/arbitrary/resources/search', [])
    await expect(readPublishedMailStateFromQdn('bob')).resolves.toBeNull()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
  })

  it('fetches, decrypts and parses the published document', async () => {
    mockFetchRoute('/arbitrary/resources/search', [{ name: 'bob', identifier: 'qmail_state_v1' }])
    const encoded = await objectToBase64({ version: 1, messages: { m1: { read: true } }, archived: { a: { at: 3 } } })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ciphertext')
    mockQortalAction('DECRYPT_DATA', encoded)
    const parsed = await readPublishedMailStateFromQdn('bob')
    expect(parsed?.messages).toEqual({ m1: { read: true } })
    expect(parsed?.archived).toEqual({ a: { at: 3 } })
    expect(qortalCalls('FETCH_QDN_RESOURCE')[0]).toMatchObject({
      name: 'bob',
      service: 'DOCUMENT_PRIVATE',
      identifier: 'qmail_state_v1',
    })
  })

  it('throws when the document exists but cannot be fetched, so the publish is refused', async () => {
    mockFetchRoute('/arbitrary/resources/search', [{ name: 'bob', identifier: 'qmail_state_v1' }])
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw new Error('timeout')
    })
    await expect(readPublishedMailStateFromQdn('bob')).rejects.toThrow()
  })
})
