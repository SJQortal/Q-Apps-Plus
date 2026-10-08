import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import {
  EARLIER_FETCH_CONCURRENCY,
  cachedEarlierMessage,
  decryptCandidates,
  earlierEntriesOf,
  earlierWindow,
  extendEarlierEntries,
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

describe('extendEarlierEntries (walking back)', () => {
  const refs = (name: string, ids: string[]) => ids.map((id) => ref(name, id))
  const replyWith = (thread: any[]) => ({ id: 'x', user: 'z', generalData: { threadV2: thread } })

  it('adds the references a known message lists, before it, in its order', () => {
    // The open reply links m5..m9; m5 itself linked m0..m4.
    const base = earlierEntriesOf(replyWith(refs('bob', ['m5', 'm6', 'm7', 'm8', 'm9'])))
    const m5 = { id: 'm5', user: 'bob', generalData: { threadV2: refs('bob', ['m0', 'm1', 'm2', 'm3', 'm4']) } }
    const walked = extendEarlierEntries(base, [{ key: 'bob|m5', message: m5 }])
    expect(walked.map((entry) => entry.reference?.identifier)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'])
  })

  it('places what it finds between the entries it already has, and adds nothing twice', () => {
    const base = earlierEntriesOf(replyWith(refs('bob', ['a', 'c', 'e'])))
    // e lists a..d: b and d are new and land in their places.
    const e = { id: 'e', user: 'bob', generalData: { threadV2: refs('bob', ['a', 'b', 'c', 'd']) } }
    const once = extendEarlierEntries(base, [{ key: 'bob|e', message: e }])
    expect(once.map((entry) => entry.reference?.identifier)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(extendEarlierEntries(once, [{ key: 'bob|e', message: e }])).toHaveLength(5)
  })

  it('never adds the open message, and keeps embedded copies as copies', () => {
    const base = earlierEntriesOf(replyWith(refs('bob', ['m1'])))
    const m1 = {
      id: 'm1',
      user: 'bob',
      generalData: { threadV2: [{ ...ref('alice', 'm0'), data: { id: 'm0', user: 'alice', subject: 'first' } }, ref('z', 'x')] },
    }
    const walked = extendEarlierEntries(base, [{ key: 'bob|m1', message: m1 }], ['z|x'])
    expect(walked.map((entry) => entry.key)).toEqual(['alice|m0', 'bob|m1'])
    expect(walked[0].data).toEqual({ id: 'm0', user: 'alice', subject: 'first' })
  })

  it('stops at a safety bound', () => {
    const base = earlierEntriesOf(replyWith(refs('bob', ['last'])))
    const huge = { id: 'last', user: 'bob', generalData: { threadV2: refs('bob', Array.from({ length: 800 }, (_, i) => `m${i}`)) } }
    const walked = extendEarlierEntries(base, [{ key: 'bob|last', message: huge }])
    expect(walked).toHaveLength(500)
    expect(walked[walked.length - 1].key).toBe('bob|last')
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

  it('decrypts our own earlier mail to a long name or an alias with the next key', async () => {
    // The identifier keeps only 20 characters of the recipient, so that name
    // resolves to nothing; the publisher (one of ours) still opens it.
    const ownToLongName = { name: 'Me', identifier: '_mail_qortal_qmail_Custom Node on Qorta_AbCdEf_mail_x1', service: 'MAIL_PRIVATE' }
    mockQortalAction('GET_NAME_DATA', (request: any) => (request.name === 'Me' ? { owner: 'QMe' } : {}))
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson('Mine'))))
    const result = await loadEarlierMessage(ownToLongName, { ownNames: ['Me'] })
    expect(result).toMatchObject({ status: 'loaded', message: { subject: 'Mine', user: 'Me' } })
    expect(qortalCalls('GET_NAME_DATA').map((request) => request.name)).toEqual(['Custom Node on Qorta', 'Me'])
  })

  it('stops at a node error instead of trying more keys', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw new Error('Something broke')
    })
    const ownToLongName = { name: 'Me', identifier: '_mail_qortal_qmail_Custom Node on Qorta_AbCdEf_mail_x2', service: 'MAIL_PRIVATE' }
    expect(await loadEarlierMessage(ownToLongName, { ownNames: ['Me'] })).toEqual({ status: 'failed' })
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
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
