import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import { resetNameCache } from './nameCache'
import {
  peekSentRecipientName,
  resetSentRecipientCache,
  resolveSentRecipientName,
  sentRecipientCacheStats,
} from './sentRecipientCache'

describe('sentRecipientCache', () => {
  beforeEach(() => {
    resetNameCache()
    resetSentRecipientCache()
  })

  it('resolves a short name with one GET_NAME_DATA per group and no SEARCH_NAMES', async () => {
    mockQortalAction('GET_NAME_DATA', (request: any) =>
      request.name === 'bob' ? { name: 'bob', owner: 'QBobAddress123456' } : {}
    )
    mockQortalAction('SEARCH_NAMES', [])
    const [a, b, c] = await Promise.all([
      resolveSentRecipientName('bob', '123456'),
      resolveSentRecipientName('bob', '123456'),
      resolveSentRecipientName('Bob', '123456'),
    ])
    expect([a, b, c]).toEqual(['bob', 'bob', 'bob'])
    expect(await resolveSentRecipientName('bob', '123456')).toBe('bob')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(0)
    expect(peekSentRecipientName('bob', '123456')).toBe('bob')
    expect(sentRecipientCacheStats().hits).toBe(1)
  })

  it('falls back to one prefix search for a truncated name, and rejects a same-prefix name with another owner', async () => {
    mockQortalAction('GET_NAME_DATA', { name: 'alexanderthegreat123', owner: 'QSomeoneElse999999' })
    mockQortalAction('SEARCH_NAMES', (request: any) => {
      expect(request.prefix).toBe(true)
      expect(request.limit).toBe(10)
      return [
        { name: 'alexanderthegreat1234', owner: 'QOther000000' },
        { name: 'alexanderthegreat12345', owner: 'QRightOwnerABCDEF' },
      ]
    })
    expect(await resolveSentRecipientName('alexanderthegreat123', 'ABCDEF')).toBe('alexanderthegreat12345')
    expect(await resolveSentRecipientName('alexanderthegreat123', 'abcdef')).toBe('alexanderthegreat12345')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(1)
  })

  it('remembers a miss so the row never asks again', async () => {
    mockQortalAction('GET_NAME_DATA', {})
    mockQortalAction('SEARCH_NAMES', [])
    expect(await resolveSentRecipientName('ghost', 'ZZZZZZ')).toBeNull()
    expect(await resolveSentRecipientName('ghost', 'ZZZZZZ')).toBeNull()
    expect(peekSentRecipientName('ghost', 'ZZZZZZ')).toBeNull()
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(1)
  })
})
