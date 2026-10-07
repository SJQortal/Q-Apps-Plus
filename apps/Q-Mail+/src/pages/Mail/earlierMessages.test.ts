import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import {
  EARLIER_FETCH_CONCURRENCY,
  cachedEarlierMessage,
  decryptCandidates,
  earlierEntriesOf,
  earlierWindow,
  loadEarlierMessage,
  needsFetch,
  resetEarlierMessagesCache,
  settledEarlierLoad,
} from './earlierMessages'

const ref = (name: string, identifier: string, service = 'MAIL_PRIVATE') => ({ reference: { name, identifier, service } })
const mailJson = (subject: string) => ({ subject, createdAt: 1700000000000, version: 1, attachments: [], textContentV2: `<p>${subject}</p>`, generalData: { thread: [], threadV2: [] } })
const noSleep = async () => {}

describe('earlierEntriesOf', () => {
  it('keeps references and embedded copies in array order, minus markers, itself, repeats and other services', () => {
    const message = {
      id: 'm3',
      user: 'alice',
      generalData: {
        threadV2: [
          ref('alice', 'm1'),
          { ...ref('bob', 'm2'), data: { id: 'm2', user: 'bob', subject: 'Re: hi', createdAt: 20 } },
          ref('Alice', 'm1'),
          { reference: { identifier: 'm3', name: 'alice' }, data: { markedAsReadLocally: true } },
          ref('alice', 'm3'),
          ref('alice', 'x', 'MAIL'),
          { reference: { name: '', identifier: 'y' } },
          null,
          'junk',
        ],
      },
    }
    const entries = earlierEntriesOf(message)
    expect(entries.map(entry => entry.key)).toEqual(['alice|m1', 'bob|m2'])
    expect(entries.map(needsFetch)).toEqual([true, false])
  })

  it('a repeat that embeds a copy fills in the first entry', () => {
    const entries = earlierEntriesOf({ id: 'm9', user: 'z', generalData: { threadV2: [ref('bob', 'm2'), { ...ref('bob', 'm2'), data: { user: 'bob', subject: 's' } }] } })
    expect(entries).toHaveLength(1)
    expect(needsFetch(entries[0])).toBe(false)
  })

  it('sorts by date only when every entry embeds a dated copy (the old reader order)', () => {
    const embedded = (id: string, createdAt: number) => ({ ...ref('bob', id), data: { id, user: 'bob', subject: id, createdAt } })
    const allEmbedded = { generalData: { threadV2: [embedded('b', 20), embedded('a', 10)] } }
    expect(earlierEntriesOf(allEmbedded).map(entry => entry.data.id)).toEqual(['a', 'b'])
    const mixed = { generalData: { threadV2: [embedded('b', 20), ref('alice', 'c'), embedded('a', 10)] } }
    expect(earlierEntriesOf(mixed).map(entry => entry.key)).toEqual(['bob|b', 'alice|c', 'bob|a'])
  })

  it('an embedded copy without a usable reference still shows', () => {
    const entries = earlierEntriesOf({ generalData: { threadV2: [{ data: { user: 'bob', subject: 'old' } }] } })
    expect(entries).toEqual([{ key: 'embedded:0', reference: null, data: { user: 'bob', subject: 'old' } }])
    expect(earlierEntriesOf({})).toEqual([])
  })
})

describe('earlierWindow', () => {
  it('shows the newest entries and counts the hidden older ones', () => {
    const entries = earlierEntriesOf({ generalData: { threadV2: Array.from({ length: 12 }, (_, i) => ref('bob', `m${i}`)) } })
    const first = earlierWindow(entries, 5)
    expect(first.visible.map(entry => entry.reference?.identifier)).toEqual(['m7', 'm8', 'm9', 'm10', 'm11'])
    expect(first.hidden).toBe(7)
    expect(earlierWindow(entries, 50).hidden).toBe(0)
  })
})

describe('decryptCandidates and the session cache', () => {
  it('tries the recipient first for mail one of our own names sent', () => {
    const sent = { name: 'Me', identifier: '_mail_qortal_qmail_bob_abc123_mail_x1', service: 'MAIL_PRIVATE' }
    expect(decryptCandidates(sent, ['me'])).toEqual(['bob', 'Me'])
    expect(decryptCandidates({ ...sent, name: 'alice' }, ['me'])).toEqual(['alice'])
  })

  it('uses a decrypted copy only when it is this publisher\'s (pitfall 15)', () => {
    const reference = { name: 'alice', identifier: 'm1', service: 'MAIL_PRIVATE' }
    expect(cachedEarlierMessage(reference, { m1: { isValid: true, user: 'Alice', subject: 's' } })).toMatchObject({ subject: 's' })
    expect(cachedEarlierMessage(reference, { m1: { isValid: true, user: 'mallory' } })).toBeNull()
    expect(cachedEarlierMessage(reference, { m1: { isValid: false, user: 'alice' } })).toBeNull()
    expect(cachedEarlierMessage(reference, undefined)).toBeNull()
  })
})

describe('loadEarlierMessage', () => {
  const reference = { name: 'alice', identifier: '_mail_qortal_qmail_bob_abc123_mail_x1', service: 'MAIL_PRIVATE' }

  beforeEach(() => {
    resetNameCache()
    resetEarlierMessagesCache()
    mockQortalAction('GET_NAME_DATA', { owner: 'Qalice' })
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PKalice' })
  })

  it('fetches and decrypts with the original call shapes, without ENCRYPT_DATA, and keeps it for the session', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify({ ...mailJson('Hi'), user: 'mallory' })))
    const result = await loadEarlierMessage(reference)
    expect(result).toMatchObject({ status: 'loaded', message: { subject: 'Hi', user: 'alice', id: reference.identifier } })
    expect(qortalCalls('FETCH_QDN_RESOURCE')[0]).toEqual({
      action: 'FETCH_QDN_RESOURCE',
      name: 'alice',
      service: 'MAIL_PRIVATE',
      identifier: reference.identifier,
      encoding: 'base64',
    })
    expect(qortalCalls('ENCRYPT_DATA')).toHaveLength(0)
    await loadEarlierMessage(reference)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
    expect(settledEarlierLoad(reference)?.status).toBe('loaded')
  })

  it('merges identical fetches in flight', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson('Hi'))))
    const [a, b] = await Promise.all([loadEarlierMessage(reference), loadEarlierMessage({ ...reference, name: 'ALICE' })])
    expect(a).toBe(b)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
  })

  it('reports a deleted message and one not sent to you, and remembers both', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'D')
    expect(await loadEarlierMessage(reference)).toEqual({ status: 'deleted' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', () => {
      throw new Error('Unable to decrypt')
    })
    const other = { ...reference, identifier: 'other' }
    expect(await loadEarlierMessage(other)).toEqual({ status: 'unableToDecrypt' })
    await loadEarlierMessage(other)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)
  })

  it('reports a sent message its sender deleted (the Q-Mail tombstone) as deleted', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify({
      subject: '__qmail_deleted__',
      createdAt: 5,
      version: 1,
      attachments: [],
      textContentV2: '',
      generalData: { deleted: true, deletedAt: 5, thread: [], threadV2: [] },
      recipient: 'bob',
    })))
    expect(await loadEarlierMessage(reference)).toEqual({ status: 'deleted' })
    expect(cachedEarlierMessage(reference, { [reference.identifier]: { isValid: true, user: 'alice', subject: '__qmail_deleted__' } })).toBeNull()
  })

  it('says "unavailable" after the retries and tries again next time', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Data unavailable. Please try again later.' }
    })
    expect(await loadEarlierMessage(reference, { sleep: noSleep })).toEqual({ status: 'unavailable' })
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(3)
    expect(settledEarlierLoad(reference)).toBeUndefined()
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson('Back'))))
    expect((await loadEarlierMessage(reference)).status).toBe('loaded')
  })

  it(`runs at most ${EARLIER_FETCH_CONCURRENCY} fetches at a time`, async () => {
    let running = 0
    let peak = 0
    mockQortalAction('FETCH_QDN_RESOURCE', async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, 5))
      running -= 1
      return 'ENC'
    })
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson('Hi'))))
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => loadEarlierMessage({ ...reference, identifier: `m${i}` }))
    )
    expect(results.every(result => result.status === 'loaded')).toBe(true)
    expect(peak).toBe(EARLIER_FETCH_CONCURRENCY)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(6)
  })
})
